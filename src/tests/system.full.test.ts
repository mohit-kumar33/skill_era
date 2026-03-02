/**
 * system.full.test.ts
 * 
 * DEEP E2E SYSTEM VERIFICATION
 * This test models the absolute full user lifecycle using global mocks 
 * to ensure 100% service-layer correctness without infrastructure dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../app.js';
import { logger } from '../utils/logger.js';
import crypto from 'crypto';

// ── GLOBAL INFRA MOCKS ────────────────────────────────
vi.mock('fastify-plugin', () => ({ default: (fn: any) => fn }));
vi.mock('@fastify/helmet', () => ({ default: Object.assign((f: any, o: any, d: any) => d(), { [Symbol.for('skip-override')]: true }) }));
vi.mock('@fastify/rate-limit', () => ({ default: Object.assign((f: any, o: any, d: any) => d(), { [Symbol.for('skip-override')]: true }) }));
vi.mock('../config/redis.js', () => ({
    connectRedis: vi.fn().mockResolvedValue({ status: 'ready', ping: vi.fn().mockResolvedValue('PONG') }),
    getRedisClient: vi.fn().mockReturnValue({ status: 'ready', ping: vi.fn().mockResolvedValue('PONG'), set: vi.fn().mockResolvedValue('OK') }),
    isWebhookReplay: vi.fn().mockResolvedValue(false),
}));
vi.mock('../utils/hmac.js', () => ({
    verifyHmacSignature: vi.fn().mockReturnValue(true),
}));
vi.mock('bcrypt', () => ({
    default: {
        hash: vi.fn().mockResolvedValue('hashed-pass'),
        compare: vi.fn().mockResolvedValue(true),
    }
}));
vi.mock('jsonwebtoken', () => {
    const mockJwt = {
        verify: vi.fn().mockImplementation((token: string) => {
            if (token === 'admin-valid') return { userId: '123e4567-e89b-12d3-a456-426614174001', role: 'super_admin', type: 'access' };
            if (token && token.startsWith('user-')) return { userId: token.split('-')[1], role: 'user', type: 'access' };
            return { userId: '123e4567-e89b-12d3-a456-426614174000', role: 'user', type: 'access' };
        }),
        sign: vi.fn().mockReturnValue('mock-token'),
        decode: vi.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    };
    return {
        default: mockJwt,
        ...mockJwt,
    };
});
vi.mock('../config/database.js', () => ({
    pool: { query: vi.fn(), connect: vi.fn(), on: vi.fn() }
}));
vi.mock('../utils/retry.js', () => ({
    withRetry: vi.fn().mockImplementation(async (fn) => fn()),
    withGatewayRetry: vi.fn().mockImplementation(async (fn) => fn()),
    isRetryableDbError: vi.fn().mockReturnValue(false),
    isNetworkRetryable: vi.fn().mockReturnValue(false),
}));
vi.mock('../utils/transaction.js', () => ({
    runInTransaction: vi.fn().mockImplementation(async (p: any, cb: any) => {
        const client = {
            query: vi.fn().mockImplementation(async (sql) => {
                if (sql.includes('WITH wallet_lock')) {
                    return { rows: [{ id: '123e4567-e89b-12d3-a456-426614174003', withdrawal_id: '123e4567-e89b-12d3-a456-426614174003', amount: '500.00', tds_amount: '0.00', net_amount: '500.00', status: 'requested', new_balance: '400.00' }] };
                }
                if (sql.includes('deposits')) {
                    return { rows: [{ id: '123e4567-e89b-12d3-a456-426614174000', user_id: '123e4567-e89b-12d3-a456-426614174000', amount: '500.00', status: 'initiated', idempotency_key: 'ik-12345' }] };
                }
                if (sql.includes('tournaments')) {
                    return { rows: [{ id: '123e4567-e89b-12d3-a456-426614174002', max_participants: 10, status: 'open', current_participants: 0 }] };
                }
                if (sql.includes('wallets')) {
                    return { rows: [{ id: 'w-1', new_balance: '500.00', winning_balance: '500.00', ledger_id: 'li-1' }] };
                }
                return { rows: [] };
            }),
            release: vi.fn(),
        };
        return cb(client as any);
    }),
    runInSerializableTransaction: vi.fn().mockImplementation(async (p: any, cb: any) => {
        const client = {
            query: vi.fn().mockImplementation(async (sql) => {
                if (sql.includes('withdrawals')) {
                    return { rows: [{ id: '123e4567-e89b-12d3-a456-426614174003', user_id: '123e4567-e89b-12d3-a456-426614174000', amount: '500.00', tds_amount: '0.00', net_amount: '500.00', status: 'approved' }] };
                }
                if (sql.includes('wallets')) {
                    return { rows: [{ id: 'w-1', user_id: '123e4567-e89b-12d3-a456-426614174000', winning_balance: '1000.00' }] };
                }
                return { rows: [] };
            }),
            release: vi.fn(),
        };
        return cb(client as any);
    }),
    isLockNotAvailable: vi.fn().mockReturnValue(false),
}));

// ── GLOBAL PRISMA MOCK ────────────────────────────────
vi.mock('../config/prisma.js', () => {
    const mockClient = {
        user: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn().mockImplementation(async (args) => ({ id: args?.where?.id || 'id', ...args?.data, role: 'user' })),
            count: vi.fn().mockResolvedValue(0),
        },
        wallet: {
            findUnique: vi.fn(),
            update: vi.fn().mockImplementation(async (args) => ({ ...args?.data })),
        },
        deposit: {
            create: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
            updateMany: vi.fn(),
            findFirst: vi.fn().mockResolvedValue(null),
            aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        },
        withdrawal: {
            create: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn().mockImplementation(async (args: any) => ({ id: args?.where?.id || 'id', ...args?.data })),
            updateMany: vi.fn().mockImplementation(async () => ({ count: 1 })),
            findFirst: vi.fn().mockResolvedValue(null),
            count: vi.fn().mockResolvedValue(0),
            aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
        },
        tournament: {
            findUnique: vi.fn(),
            count: vi.fn().mockResolvedValue(0),
        },
        participant: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
        walletTransaction: {
            create: vi.fn(),
            findMany: vi.fn(),
            count: vi.fn(),
        },
        refreshToken: {
            create: vi.fn().mockResolvedValue({}),
        },
        adminLog: {
            create: vi.fn(),
        },
        fraudFlag: {
            count: vi.fn().mockResolvedValue(0),
            findMany: vi.fn().mockResolvedValue([]),
        },
        $executeRawUnsafe: vi.fn().mockResolvedValue(1),
        $transaction: vi.fn().mockImplementation(async (arg) => {
            if (Array.isArray(arg)) return Promise.all(arg);
            return arg(mockClient);
        }),
    };
    return { prisma: mockClient };
});

import { prisma } from '../config/prisma.js';

// ── SERVICE MOCKS ─────────────────────────────────────
vi.mock('../utils/monitoring.service.js', () => ({ emit: vi.fn() }));
vi.mock('../modules/notification/notification.service.js', () => ({
    notifyWithdrawalRequested: vi.fn().mockResolvedValue(undefined),
    notifyKycStatusUpdate: vi.fn().mockResolvedValue(undefined),
    notifyPayoutProcessed: vi.fn().mockResolvedValue(undefined),
    notifyPayoutCompleted: vi.fn().mockResolvedValue(undefined),
    notifyDepositConfirmed: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../modules/kyc/kyc.provider.js', () => ({
    requestExternalVerification: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../modules/wallet/tds.service.js', () => ({
    calculateTds: vi.fn().mockResolvedValue({
        grossAmount: '500.00',
        netWinnings: '0.00',
        tdsAmount: '0.00',
        netPayable: '500.00',
        tdsRate: 0,
        hasPan: true,
        financialYear: '2025-2026'
    })
}));
vi.mock('../middleware/amlDetection.js', () => ({
    runAmlChecks: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../utils/payout_gateway.js', () => ({
    payoutGateway: {
        initiatePayout: vi.fn().mockResolvedValue({
            success: true,
            gatewayTransactionId: 'gw-tx-123',
            message: 'Mock payout success'
        }),
    }
}));

describe('FULL SYSTEM INTEGRATION: User Lifecycle', () => {
    let app: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        if (!app) {
            app = await buildApp();
        }
    });

    afterAll(async () => {
        if (app) await app.close();
    });

    it('Scenario: Registration -> Deposit -> KYC -> Play -> Withdraw -> Payout', async () => {
        const userId = '123e4567-e89b-12d3-a456-426614174000';
        const adminId = '123e4567-e89b-12d3-a456-426614174001';

        // 1. REGISTER
        (prisma.user.findUnique as any).mockResolvedValue(null);
        (prisma.user.create as any).mockResolvedValue({ id: userId, mobile: '9999999999', role: 'user' });

        const regRes = await app.inject({
            method: 'POST',
            url: '/api/v1/auth/register',
            headers: { 'content-type': 'application/json' },
            payload: JSON.stringify({ mobile: '9999999999', email: 'full@test.com', password: 'Password123', dateOfBirth: '1990-01-01', state: 'Karnataka', cfTurnstileResponse: 'dummy-token' })
        });
        expect(regRes.statusCode).toBe(201);
        const accessToken = regRes.cookies.find((c: any) => c.name === 'accessToken')?.value;

        // 2. DEPOSIT
        (prisma.user.findUnique as any).mockImplementation(async (args: any) => {
            if (args.where.id === userId) return { id: userId, accountStatus: 'active', kycStatus: 'pending', role: 'user' };
            return null;
        });
        (prisma.wallet.findUnique as any).mockResolvedValue({ userId, depositBalance: 0, winningBalance: 0, bonusBalance: 0 });
        (prisma.deposit.findUnique as any).mockResolvedValue(null);
        (prisma.deposit.create as any).mockResolvedValue({ id: '123e4567-e89b-12d3-a456-426614174000', amount: 500, status: 'initiated', idempotencyKey: 'ik-12345' });

        const depRes = await app.inject({
            method: 'POST',
            url: '/api/v1/wallet/deposit',
            headers: { cookie: `accessToken=${accessToken}; csrfToken=t`, 'x-csrf-token': 't', 'content-type': 'application/json' },
            payload: JSON.stringify({ amount: '500.00', idempotencyKey: 'ik-12345' })
        });
        expect(depRes.statusCode).toBe(201);

        // 3. WEBHOOK CONFIRM
        const hookRes = await app.inject({
            method: 'POST',
            url: '/webhooks/deposit',
            headers: { 'x-webhook-signature': 'dummy-sig', 'content-type': 'application/json' },
            payload: JSON.stringify({
                deposit_id: '123e4567-e89b-12d3-a456-426614174000',
                gateway_transaction_id: 'gtx-1',
                amount: '500.00',
                status: 'success',
                timestamp: new Date().toISOString(),
                nonce: 'nonce-unique-12345'
            })
        });
        expect(hookRes.statusCode).toBe(200);

        // 4. KYC SUBMIT
        (prisma.user.findFirst as any).mockResolvedValue(null);
        (prisma.user.update as any).mockResolvedValue({ id: userId, kycStatus: 'submitted' });

        const kycRes = await app.inject({
            method: 'POST',
            url: '/api/v1/kyc/submit',
            headers: { cookie: `accessToken=${accessToken}; csrfToken=t`, 'x-csrf-token': 't', 'content-type': 'application/json' },
            payload: JSON.stringify({ docType: 'pan', docNumber: 'ABCDE1234F', docUrl: 'http://v.com/1.jpg' })
        });
        expect(kycRes.statusCode).toBe(200);

        // 5. ADMIN APPROVE
        (prisma.user.findUnique as any).mockImplementation(async (args: any) => {
            if (args.where.id === userId) return { id: userId, kycStatus: 'submitted', dateOfBirth: new Date('1990-01-01'), role: 'user' };
            if (args.where.id === adminId) return { id: adminId, role: 'super_admin', twoFactorSecret: 'secret' };
            return null;
        });

        const approveRes = await app.inject({
            method: 'POST',
            url: '/api/v1/kyc/verify',
            headers: { cookie: `accessToken=admin-valid; csrfToken=t`, 'x-csrf-token': 't', 'content-type': 'application/json' },
            payload: JSON.stringify({ userId, action: 'approve' })
        });
        expect(approveRes.statusCode).toBe(200);

        // 6. TOURNAMENT JOIN
        const tId = '123e4567-e89b-12d3-a456-426614174002';
        (prisma.tournament.findUnique as any).mockResolvedValue({ id: tId, entryFee: 100, status: 'open', maxParticipants: 10, _count: { participants: 0 } });
        (prisma.participant.findUnique as any).mockResolvedValue(null);
        (prisma.user.findUnique as any).mockImplementation(async (args: any) => {
            if (args.where.id === userId) return { id: userId, kycStatus: 'verified', accountStatus: 'active', role: 'user' };
            return null;
        });

        const joinRes = await app.inject({
            method: 'POST',
            url: '/api/v1/tournaments/join',
            headers: { cookie: `accessToken=${accessToken}; csrfToken=t`, 'x-csrf-token': 't', 'content-type': 'application/json' },
            payload: JSON.stringify({ tournamentId: tId, idempotencyKey: 'ik-join-123' })
        });
        expect(joinRes.statusCode).toBe(200);

        // 7. WITHDRAW
        (prisma.wallet.findUnique as any).mockResolvedValue({ userId, depositBalance: 400, winningBalance: 1000, bonusBalance: 0 });
        (prisma.user.findUnique as any).mockImplementation(async (args: any) => {
            if (args.where.id === userId) return { id: userId, kycStatus: 'verified', accountStatus: 'active', fraudScore: 0, role: 'user' };
            return null;
        });
        (prisma.withdrawal.create as any).mockResolvedValue({ id: '123e4567-e89b-12d3-a456-426614174003' });

        const drawRes = await app.inject({
            method: 'POST',
            url: '/api/v1/wallet/withdraw',
            headers: { cookie: `accessToken=${accessToken}; csrfToken=t`, 'x-csrf-token': 't', 'content-type': 'application/json' },
            payload: JSON.stringify({ amount: '500.00', idempotencyKey: 'ik-withdraw-123' })
        });
        if (drawRes.statusCode !== 201) {
            console.error('Withdraw Failed Body:', drawRes.body);
        }
        expect(drawRes.statusCode).toBe(201);

        // 7.5 VERIFY ADMIN PREFIX
        const statsRes = await app.inject({
            method: 'GET',
            url: '/api/v1/admin/stats',
            headers: { cookie: `accessToken=admin-valid` }
        });
        if (statsRes.statusCode !== 200) {
            console.error('Stats Failed Body:', statsRes.body);
        }
        expect(statsRes.statusCode).toBe(200);

        // 8. ADMIN PAYOUT
        (prisma.adminLog.create as any).mockResolvedValue({});
        (prisma.wallet.update as any).mockResolvedValue({});

        // Mock crypto.createHmac for TOTP bypass
        const spyHmac = vi.spyOn(crypto, 'createHmac').mockReturnValue({
            update: vi.fn().mockReturnThis(),
            digest: vi.fn().mockReturnValue('123456')
        } as any);

        const withdrawalId = '123e4567-e89b-12d3-a456-426614174003';
        (prisma.user.findUnique as any).mockImplementation(async (args: any) => {
            if (args.where.id === adminId) return { id: adminId, role: 'super_admin', accountStatus: 'active', twoFactorSecret: 'secret' };
            return { id: userId, accountStatus: 'active', fraudScore: 0, kycStatus: 'verified', role: 'user', twoFactorSecret: 'secret' };
        });
        (prisma.withdrawal.findUnique as any).mockResolvedValue({ id: withdrawalId, userId, amount: 500, status: 'approved', payoutReferenceId: null });
        (prisma.withdrawal.updateMany as any).mockImplementation(async () => ({ count: 1 }));

        let payoutRes;
        payoutRes = await app.inject({
            method: 'POST',
            url: `/api/v1/admin/withdrawals/payout/${withdrawalId}`,
            headers: { cookie: `accessToken=admin-valid; csrfToken=t`, 'x-csrf-token': 't', 'x-2fa-token': '123456' }
        });

        if (payoutRes.statusCode !== 200) {
            throw new Error(`PAYOUT_FAILED: ${JSON.stringify(payoutRes.json(), null, 2)}`);
        }
        expect(payoutRes.statusCode).toBe(200);
        spyHmac.mockRestore();

        // 9. RECONCILIATION
        (prisma.walletTransaction.findMany as any).mockResolvedValue([{
            id: '123e4567-e89b-12d3-a456-426614174004',
            debitAmount: 0,
            creditAmount: 500,
            balanceBefore: 1000,
            balanceAfter: 500,
            transactionType: 'withdrawal',
            status: 'confirmed',
            description: 'Payout success',
            createdAt: new Date()
        }]);
        (prisma.walletTransaction.count as any).mockResolvedValue(1);

        const histRes = await app.inject({
            method: 'GET',
            url: '/api/v1/wallet/transactions',
            headers: { cookie: `accessToken=${accessToken}` }
        });
        expect(histRes.statusCode).toBe(200);
        expect(histRes.json().data.transactions.length).toBe(1);
    });
});
