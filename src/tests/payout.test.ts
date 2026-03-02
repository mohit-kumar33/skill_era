/**
 * payout.test.ts
 *
 * Unit tests for the hardened payout execution flow.
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
    };
});

// ── Environment mocks ────────────────────────────────────────────────
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

// ── Application mocks ───────────────────────────────────────────────
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

vi.mock('../utils/payout_gateway.js', () => ({
    payoutGateway: mocks.mockGateway,
}));

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

// ── Import after mocks ────────────────────────────────────────────────
import { executePayout } from '../modules/wallet/payout.service.js';

// ── Shared test data ─────────────────────────────────────────────────
const WITHDRAWAL_ID = '11111111-1111-4111-a111-111111111111';
const USER_ID = '22222222-2222-4222-a222-222222222222';
const ADMIN_ID = '33333333-3333-4333-a333-333333333333';
const IP = '192.168.1.1';
const PAYOUT_REF = '44444444-4444-4444-a444-444444444444';

function makeWithdrawal(override: object = {}) {
    return {
        status: 'approved',
        payoutReferenceId: null,
        gatewayPayoutId: null,
        userId: USER_ID,
        amount: { toString: () => '500.00' },
        netAmount: { toString: () => '500.00' },
        tdsAmount: { toString: () => '0.00' },
        ...override,
    };
}

function mockTransactionSuccess() {
    mocks.mockClient.query
        .mockResolvedValueOnce(undefined)                    // BEGIN
        .mockResolvedValueOnce({
            rows: [{                    // SELECT withdrawal FOR UPDATE
                id: WITHDRAWAL_ID, user_id: USER_ID,
                amount: '500.00', tds_amount: '0.00',
                net_amount: '500.00', status: 'approved',
                payout_reference_id: PAYOUT_REF,
            }]
        })
        .mockResolvedValueOnce({
            rows: [{                    // SELECT wallet FOR UPDATE
                id: 'w1', user_id: USER_ID, winning_balance: '500.00',
            }]
        })
        .mockResolvedValueOnce(undefined)                    // UPDATE withdrawal → paid
        .mockResolvedValueOnce({ rows: [{ id: 'lt1' }] })   // INSERT ledger
        .mockResolvedValueOnce({ rows: [{ id: 'lt2' }] })   // INSERT ledger
        .mockResolvedValueOnce(undefined);                   // COMMIT
}

// ─────────────────────────────────────────────────────────────────────
describe('executePayout — State Machine Enforcement', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockPrismaWithdrawal.findUnique.mockResolvedValue(makeWithdrawal());
        mocks.mockPrismaFraudFlag.count.mockResolvedValue(0);
        mocks.mockPrismaUser.findUnique.mockResolvedValue({ accountStatus: 'active', fraudScore: 0 });
    });

    it('returns result when status is "paid" and has reference (idempotent)', async () => {
        mocks.mockPrismaWithdrawal.findUnique.mockResolvedValue(
            makeWithdrawal({ status: 'paid', payoutReferenceId: PAYOUT_REF, gatewayPayoutId: 'gw_123' }),
        );

        const result = await executePayout(WITHDRAWAL_ID, ADMIN_ID, IP);
        expect(result.idempotentReplay).toBe(true);
        expect(result.status).toBe('paid');
    });

    it('throws when status is "rejected" (terminal)', async () => {
        mocks.mockPrismaWithdrawal.findUnique.mockResolvedValue(
            makeWithdrawal({ status: 'rejected', payoutReferenceId: null }),
        );

        await expect(executePayout(WITHDRAWAL_ID, ADMIN_ID, IP))
            .rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    });

    it('throws when status is "requested"', async () => {
        mocks.mockPrismaWithdrawal.findUnique.mockResolvedValue(
            makeWithdrawal({ status: 'requested' }),
        );

        await expect(executePayout(WITHDRAWAL_ID, ADMIN_ID, IP))
            .rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    });

    it('throws when status is "under_review"', async () => {
        mocks.mockPrismaWithdrawal.findUnique.mockResolvedValue(
            makeWithdrawal({ status: 'under_review' }),
        );

        await expect(executePayout(WITHDRAWAL_ID, ADMIN_ID, IP))
            .rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    });

    it('throws when status is "failed" without explicit retry', async () => {
        mocks.mockPrismaWithdrawal.findUnique.mockResolvedValue(
            makeWithdrawal({ status: 'failed', payoutReferenceId: PAYOUT_REF }),
        );

        await expect(executePayout(WITHDRAWAL_ID, ADMIN_ID, IP))
            .rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });
    });
});

// ─────────────────────────────────────────────────────────────────────
describe('executePayout — Idempotency', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockPrismaUser.findUnique.mockResolvedValue({ accountStatus: 'active', fraudScore: 0 });
    });

    it('returns existing result if withdrawal is already Paid', async () => {
        mocks.mockPrismaWithdrawal.findUnique.mockResolvedValue(
            makeWithdrawal({
                status: 'paid',
                payoutReferenceId: PAYOUT_REF,
                gatewayPayoutId: 'gw_existing',
            }),
        );

        const result = await executePayout(WITHDRAWAL_ID, ADMIN_ID, IP);

        expect(result.idempotentReplay).toBe(true);
        expect(result.gatewayTransactionId).toBe('gw_existing');
        expect(result.payoutReferenceId).toBe(PAYOUT_REF);
        expect(mocks.mockGateway.initiatePayout).not.toHaveBeenCalled();
    });

    it('does not call gateway twice if payout_reference_id is already claimed', async () => {
        mocks.mockPrismaWithdrawal.findUnique.mockResolvedValue(makeWithdrawal());
        mocks.mockPrismaWithdrawal.update.mockRejectedValueOnce({ code: 'P2025' });

        await expect(executePayout(WITHDRAWAL_ID, ADMIN_ID, IP))
            .rejects.toMatchObject({ errorCode: 'CONCURRENT_MODIFICATION' });

        expect(mocks.mockGateway.initiatePayout).not.toHaveBeenCalled();
    });
});

// ─────────────────────────────────────────────────────────────────────
describe('executePayout — Fraud Revalidation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockPrismaWithdrawal.findUnique.mockResolvedValue(makeWithdrawal());
        mocks.mockPrismaWithdrawal.update.mockResolvedValue({});
        mocks.mockPrismaUser.findUnique.mockResolvedValue({ accountStatus: 'active', fraudScore: 0 });
    });

    it('blocks payout when account is Frozen', async () => {
        mocks.mockPrismaWithdrawal.findUnique
            .mockResolvedValueOnce(makeWithdrawal({ status: 'approved', payoutReferenceId: null }))
        mocks.mockPrismaUser.findUnique.mockResolvedValueOnce({ accountStatus: 'frozen', fraudScore: 10 });

        await expect(executePayout(WITHDRAWAL_ID, ADMIN_ID, IP))
            .rejects.toMatchObject({ errorCode: 'FRAUD_DETECTED' });
    });

    it('blocks payout when account is Suspended', async () => {
        mocks.mockPrismaWithdrawal.findUnique
            .mockResolvedValueOnce(makeWithdrawal({ status: 'approved', payoutReferenceId: null }))
        mocks.mockPrismaUser.findUnique.mockResolvedValueOnce({ accountStatus: 'suspended', fraudScore: 0 });

        await expect(executePayout(WITHDRAWAL_ID, ADMIN_ID, IP))
            .rejects.toMatchObject({ errorCode: 'FRAUD_DETECTED' });
    });

    it('blocks payout when fraud score >= 80', async () => {
        mocks.mockPrismaWithdrawal.findUnique
            .mockResolvedValueOnce(makeWithdrawal())
        mocks.mockPrismaUser.findUnique.mockResolvedValueOnce({ accountStatus: 'active', fraudScore: 85 });
        mocks.mockPrismaFraudFlag.count.mockResolvedValue(0);

        await expect(executePayout(WITHDRAWAL_ID, ADMIN_ID, IP))
            .rejects.toMatchObject({ errorCode: 'FRAUD_DETECTED' });
    });

    it('blocks payout when there are unresolved fraud flags', async () => {
        mocks.mockPrismaWithdrawal.findUnique
            .mockResolvedValueOnce(makeWithdrawal())
        mocks.mockPrismaUser.findUnique.mockResolvedValueOnce({ accountStatus: 'active', fraudScore: 50 });
        mocks.mockPrismaFraudFlag.count.mockResolvedValue(2);

        await expect(executePayout(WITHDRAWAL_ID, ADMIN_ID, IP))
            .rejects.toMatchObject({ errorCode: 'FRAUD_DETECTED' });
    });
});

// ─────────────────────────────────────────────────────────────────────
describe('executePayout — Gateway Failure Handling', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockPrismaWithdrawal.update.mockResolvedValue({});
        mocks.mockPrismaFraudFlag.count.mockResolvedValue(0);
        // first call = initial withdrawal check, second call = user fraud check
        mocks.mockPrismaWithdrawal.findUnique
            .mockResolvedValueOnce(makeWithdrawal())
        mocks.mockPrismaUser.findUnique.mockResolvedValue({ accountStatus: 'active', fraudScore: 0 });
    });

    it('marks withdrawal as Failed when gateway throws exception', async () => {
        mocks.mockGateway.initiatePayout.mockRejectedValue(new Error('Gateway timeout'));
        mocks.mockPrismaWithdrawal.update.mockResolvedValue({});

        await expect(executePayout(WITHDRAWAL_ID, ADMIN_ID, IP))
            .rejects.toMatchObject({ errorCode: 'SERVICE_UNAVAILABLE' });

        expect(mocks.mockPrismaWithdrawal.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ status: 'failed' }),
            }),
        );
    });

    it('marks withdrawal as Failed when gateway rejects (success: false)', async () => {
        mocks.mockGateway.initiatePayout.mockResolvedValue({
            success: false,
            gatewayTransactionId: '',
            message: 'Account blacklisted',
        });
        mocks.mockPrismaWithdrawal.update.mockResolvedValue({});

        await expect(executePayout(WITHDRAWAL_ID, ADMIN_ID, IP))
            .rejects.toMatchObject({ errorCode: 'VALIDATION_ERROR' });

        expect(mocks.mockPrismaWithdrawal.update).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    status: 'failed',
                    payoutError: expect.stringContaining('Account blacklisted'),
                }),
            }),
        );
    });

    it('does NOT modify wallet balance on gateway failure', async () => {
        mocks.mockGateway.initiatePayout.mockRejectedValue(new Error('Timeout'));
        mocks.mockPrismaWithdrawal.update.mockResolvedValue({});

        await expect(executePayout(WITHDRAWAL_ID, ADMIN_ID, IP)).rejects.toThrow();

        expect(mocks.mockClient.query).not.toHaveBeenCalledWith(
            expect.stringContaining('UPDATE wallets'),
            expect.anything(),
        );
    });
});

// ─────────────────────────────────────────────────────────────────────
describe('executePayout — Success Path', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mockPrismaWithdrawal.update.mockResolvedValue({ id: WITHDRAWAL_ID });
        mocks.mockPrismaFraudFlag.count.mockResolvedValue(0);
        mocks.mockPrismaWithdrawal.findUnique
            .mockResolvedValueOnce(makeWithdrawal())
        mocks.mockPrismaUser.findUnique.mockResolvedValue({ accountStatus: 'active', fraudScore: 5 });
        mocks.mockGateway.initiatePayout.mockResolvedValue({
            success: true,
            gatewayTransactionId: 'gw_success_123',
            message: 'Payout processed',
        });
        mockTransactionSuccess();
    });

    it('returns status=paid with gatewayTransactionId on success', async () => {
        const result = await executePayout(WITHDRAWAL_ID, ADMIN_ID, IP);
        expect(result.status).toBe('paid');
        expect(result.gatewayTransactionId).toBe('gw_success_123');
        expect(result.idempotentReplay).toBe(false);
    });

    it('inserts BOTH a debit and credit ledger entry (double-entry)', async () => {
        await executePayout(WITHDRAWAL_ID, ADMIN_ID, IP);

        const insertCalls = (mocks.mockClient.query.mock.calls as unknown[][]).filter(
            (args) => typeof args[0] === 'string' && (args[0] as string).trim().startsWith('INSERT INTO wallet_transactions'),
        );

        expect(insertCalls).toHaveLength(2);

        // Assert parameters contain the expected idempotency keys
        const debitParams = insertCalls[0]![1] as any[];
        const creditParams = insertCalls[1]![1] as any[];

        expect(debitParams).toContainEqual(expect.stringContaining('payout-debit-'));
        expect(creditParams).toContainEqual(expect.stringContaining('payout-credit-'));
    });
});
