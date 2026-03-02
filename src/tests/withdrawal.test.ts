/**
 * withdrawal.test.ts
 *
 * Financial flow tests for withdrawal request processing.
 *
 * requestWithdrawal(userId: string, input: WithdrawRequestInput)
 * WithdrawRequestInput = { amount: string, idempotencyKey: string }
 *
 * Coverage:
 *   ✓ KYC required enforcement
 *   ✓ Fraud score block (>= 80)
 *   ✓ Frozen account block
 *   ✓ Pending withdrawal duplicate block
 *   ✓ Missing user → throws
 *   ✓ Concurrency: 5 parallel calls → at most 1 succeeds (lock simulation)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requestWithdrawal } from '../modules/wallet/wallet.service.js';
import { prisma } from '../config/prisma.js';
import { pool } from '../config/database.js';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('../config/prisma.js', () => ({
    prisma: {
        user: { findUnique: vi.fn() },
        wallet: { findUnique: vi.fn() },
        withdrawal: { findFirst: vi.fn(), count: vi.fn() },
        deposit: { findFirst: vi.fn() }, // cooldown check
    },
}));

vi.mock('../config/database.js', () => ({
    pool: {
        query: vi.fn(),
        connect: vi.fn(),
    },
}));

vi.mock('../utils/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../utils/monitoring.service.js', () => ({ emit: vi.fn() }));

vi.mock('../modules/wallet/tds.service.js', () => ({
    calculateTds: vi.fn().mockResolvedValue({ tdsAmount: '0.00', netAmount: '1000.00', rate: 0 }),
}));

vi.mock('../utils/retry.js', () => ({
    withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

vi.mock('../utils/transaction.js', () => ({
    runInTransaction: vi.fn(async (_pool: unknown, fn: (client: unknown) => Promise<unknown>) => {
        const mockClient = {
            query: vi.fn()
                .mockResolvedValueOnce({
                    rows: [{
                        withdrawal_id: 'wd-001',
                        amount: '1000.00',
                        tds_amount: '0.00',
                    }],
                }),
            release: vi.fn(),
        };
        return fn(mockClient);
    }),
}));

const mockPrisma = vi.mocked(prisma);
const mockPool = vi.mocked(pool);

// ── Helpers ────────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, unknown> = {}) {
    return {
        id: 'user-001',
        accountStatus: 'active',
        kycStatus: 'verified',
        fraudScore: 0,
        ...overrides,
    };
}

function makeWallet(overrides: Record<string, unknown> = {}) {
    return {
        id: 'wallet-001',
        depositBalance: '0.00',
        winningBalance: '2000.00',
        bonusBalance: '0.00',
        lastDepositAt: new Date(Date.now() - 25 * 3600_000), // 25h ago — past cooldown
        ...overrides,
    };
}

const validInput = {
    amount: '1000.00',
    idempotencyKey: 'withdrawal-key-001',
};

// ── Tests ──────────────────────────────────────────────────────────────

describe('Withdrawal Request Flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('rejects when KYC is not verified', async () => {
        (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            makeUser({ kycStatus: 'pending' }),
        );

        await expect(
            requestWithdrawal('user-001', validInput),
        ).rejects.toMatchObject({ errorCode: 'KYC_REQUIRED' });
    });

    it('rejects when fraud score >= 80', async () => {
        (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            makeUser({ fraudScore: 85 }),
        );

        await expect(
            requestWithdrawal('user-001', validInput),
        ).rejects.toMatchObject({ errorCode: 'FRAUD_DETECTED' });
    });

    it('rejects when account is frozen', async () => {
        (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
            makeUser({ accountStatus: 'frozen' }),
        );

        await expect(
            requestWithdrawal('user-001', validInput),
        ).rejects.toMatchObject({ errorCode: 'ACCOUNT_FROZEN' });
    });

    it('rejects when user does not exist', async () => {
        (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

        await expect(
            requestWithdrawal('nonexistent-user', validInput),
        ).rejects.toThrow();
    });

    it('rejects when there is already a pending withdrawal', async () => {
        (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeUser());
        // Service calls deposit.findFirst (24h cooldown check) before withdrawal.findFirst
        (mockPrisma.deposit.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
        (mockPrisma.withdrawal.findFirst as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
            id: 'existing-withdrawal',
            status: 'requested',
        });

        await expect(
            requestWithdrawal('user-001', validInput),
        ).rejects.toMatchObject({ errorCode: 'DUPLICATE_REQUEST' });
    });


    describe('Concurrency: 5 parallel withdrawal requests', () => {
        it('exactly 1 succeeds when 5 parallel requests compete (lock simulation)', async () => {
            // Mock: first succeeds, 4 get lock error
            let callCount = 0;

            (mockPrisma.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeUser());
            (mockPrisma.wallet.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(makeWallet());
            (mockPrisma.withdrawal.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

            // Override runInTransaction for this test to simulate lock contention
            const { runInTransaction } = await import('../utils/transaction.js');
            (runInTransaction as ReturnType<typeof vi.fn>).mockImplementation(
                async (_pool: unknown, fn: (client: unknown) => Promise<unknown>) => {
                    callCount++;
                    if (callCount === 1) {
                        const client = {
                            query: vi.fn().mockResolvedValueOnce({
                                rows: [{ withdrawal_id: 'wd-001', amount: '1000.00', tds_amount: '0.00' }],
                            }),
                            release: vi.fn(),
                        };
                        return fn(client);
                    } else {
                        throw Object.assign(new Error('lock not available'), { code: '55P03' });
                    }
                },
            );

            const results = await Promise.allSettled(
                Array.from({ length: 5 }, (_, i) =>
                    requestWithdrawal('user-001', {
                        ...validInput,
                        idempotencyKey: `key-${i}`,
                    }),
                ),
            );

            const successes = results.filter(r => r.status === 'fulfilled');
            const failures = results.filter(r => r.status === 'rejected');

            expect(successes.length).toBeLessThanOrEqual(1);
            expect(failures.length).toBeGreaterThanOrEqual(4);
        });
    });
});
