/**
 * payout.concurrency.test.ts
 *
 * Concurrency test: Simulates 10 parallel payout execution attempts
 * on the same withdrawal ID.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Environment and Mock Data Hoisted ──────────────────────────────
const mocks = vi.hoisted(() => {
    return {
        mockPrismaWithdrawal: {
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        mockPrismaFraudFlag: {
            count: vi.fn(),
        },
        mockPrismaAdminLog: {
            create: vi.fn(),
        },
        mockPrismaUser: { findUnique: vi.fn() },
        mockClient: {
            query: vi.fn(),
            release: vi.fn(),
        },
        mockGateway: {
            initiatePayout: vi.fn(),
            _resetForTests: vi.fn(),
        },
        mockCallCount: 0,
    };
});

// ── Environment mocks — must come FIRST ──────────────────────────────
vi.mock('../config/env.js', () => ({
    env: {
        DATABASE_URL: 'postgresql://mock:mock@localhost/mock',
        DB_USER: 'mock',
        DB_PASSWORD: 'mock',
        DB_NAME: 'mock',
        DB_HOST: 'localhost',
        DB_PORT: '5432',
        JWT_ACCESS_SECRET: 'mock-access-secret',
        JWT_REFRESH_SECRET: 'mock-refresh-secret',
        JWT_ACCESS_EXPIRY: '15m',
        JWT_REFRESH_EXPIRY: '7d',
        PAYMENT_WEBHOOK_SECRET: 'mock-webhook-secret',
        NODE_ENV: 'test',
        PORT: '3000',
        ENCRYPTION_KEY: Buffer.from('mock-key-32-bytes-long-1234567890').toString('base64'),
    },
}));

// ── Application mocks ────────────────────────────────────────────────
vi.mock('../config/prisma.js', () => ({
    prisma: {
        withdrawal: mocks.mockPrismaWithdrawal,
        fraudFlag: mocks.mockPrismaFraudFlag,
        adminLog: mocks.mockPrismaAdminLog,
        user: mocks.mockPrismaUser,
    },
}));

vi.mock('../config/database.js', () => ({
    pool: {
        connect: vi.fn().mockResolvedValue(mocks.mockClient),
    },
}));

vi.mock('../utils/payout_gateway.js', () => ({ payoutGateway: mocks.mockGateway }));
vi.mock('../utils/logger.js', () => ({
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../utils/retry.js', () => ({
    withGatewayRetry: vi.fn(async (fn: () => Promise<any>) => fn()),
}));

vi.mock('../utils/transaction.js', () => ({
    runInSerializableTransaction: vi.fn(async (_pool: any, fn: (client: any) => Promise<any>) => {
        await mocks.mockClient.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        try {
            const res = await fn(mocks.mockClient);
            await mocks.mockClient.query('COMMIT');
            return res;
        } catch (err) {
            await mocks.mockClient.query('ROLLBACK');
            throw err;
        }
    }),
}));

import { executePayout } from '../modules/wallet/payout.service.js';

const WITHDRAWAL_ID = 'aaaaaaa1-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const USER_ID = 'bbbbbbb1-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const ADMIN_ID = 'ccccccc1-cccc-4ccc-cccc-cccccccccccc';
const IP = '127.0.0.1';

// ─────────────────────────────────────────────────────────────────────
describe('Concurrency Protection — 10 parallel payout executions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockCallCount = 0;

        // All calls see an 'approved' withdrawal initially
        mocks.mockPrismaWithdrawal.findUnique.mockResolvedValue({
            status: 'approved',
            payoutReferenceId: null,
            gatewayPayoutId: null,
            userId: USER_ID,
            amount: { toString: () => '500.00' },
            netAmount: { toString: () => '500.00' },
        });

        mocks.mockPrismaUser.findUnique.mockResolvedValue({
            accountStatus: 'active',
            fraudScore: 10,
        });
        mocks.mockPrismaFraudFlag.count.mockResolvedValue(0);

        // Simulate: first call claims the payout_reference_id, all others fail
        mocks.mockPrismaWithdrawal.update.mockImplementation(() => {
            mocks.mockCallCount++;
            if (mocks.mockCallCount === 1) {
                // First call succeeds in claiming the UUID
                return Promise.resolve({ id: WITHDRAWAL_ID });
            }
            // All subsequent concurrent calls hit unique constraint simulation
            return Promise.reject({ code: 'P2025' });
        });

        // Gateway succeeds for the one request that gets through
        mocks.mockGateway.initiatePayout.mockResolvedValue({
            success: true,
            gatewayTransactionId: 'gw_concurrency_winner',
            message: 'Payout processed',
        });

        // Mock transaction client for the winner
        mocks.mockClient.query
            .mockResolvedValue({ rows: [] })  // default — overridden per call below
            .mockResolvedValueOnce(undefined) // BEGIN
            .mockResolvedValueOnce({
                rows: [{
                    id: WITHDRAWAL_ID, user_id: USER_ID,
                    amount: '500.00', net_amount: '500.00',
                    td_amount: '0.00', status: 'approved',
                    payout_reference_id: 'new-uuid',
                }]
            })                             // SELECT withdrawal FOR UPDATE
            .mockResolvedValueOnce({
                rows: [{
                    id: 'w1', user_id: USER_ID, winning_balance: '500.00',
                }]
            })                             // SELECT wallet FOR UPDATE
            .mockResolvedValueOnce(undefined) // UPDATE withdrawal → paid
            .mockResolvedValueOnce({ rows: [{ id: 'lt1' }] }) // INSERT debit
            .mockResolvedValueOnce({ rows: [{ id: 'lt2' }] }) // INSERT credit
            .mockResolvedValueOnce(undefined); // COMMIT
    });

    it('exactly 1 of 10 concurrent requests succeeds with status=paid', async () => {
        const PARALLEL = 10;

        const results = await Promise.allSettled(
            Array.from({ length: PARALLEL }, () =>
                executePayout(WITHDRAWAL_ID, ADMIN_ID, IP),
            ),
        );

        const successes = results.filter(r => r.status === 'fulfilled');
        const failures = results.filter(r => r.status === 'rejected');

        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(PARALLEL - 1);

        const winner = (successes[0] as PromiseFulfilledResult<any>).value;
        expect(winner.status).toBe('paid');
        expect(winner.idempotentReplay).toBe(false);
    });

    it('gateway is called EXACTLY ONCE across 10 parallel attempts', async () => {
        await Promise.allSettled(
            Array.from({ length: 10 }, () =>
                executePayout(WITHDRAWAL_ID, ADMIN_ID, IP),
            ),
        );

        expect(mocks.mockGateway.initiatePayout).toHaveBeenCalledTimes(1);
    });

    it('all 9 failures carry CONCURRENT_MODIFICATION error code', async () => {
        const results = await Promise.allSettled(
            Array.from({ length: 10 }, () =>
                executePayout(WITHDRAWAL_ID, ADMIN_ID, IP),
            ),
        );

        const failures = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

        for (const failure of failures) {
            expect(failure.reason).toMatchObject({ errorCode: 'CONCURRENT_MODIFICATION' });
        }
    });
});
