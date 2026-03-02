/**
 * blackbox.auth.test.ts
 *
 * Black-box attack simulation focusing on ALL 8 PHASES.
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// ── Mocks (MUST be before any module imports) ──────────────────────────

vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn(),
    },
}));

vi.mock('../config/prisma.js', () => ({
    prisma: {
        user: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
        refreshToken: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
        fraudFlag: { create: vi.fn() },
        $transaction: vi.fn((p) => Promise.all(p)),
    },
}));

vi.mock('../config/redis.js', () => {
    const mockRedis = {
        status: 'ready',
        get: vi.fn(),
        set: vi.fn(() => Promise.resolve('OK')),
        incr: vi.fn(),
        expire: vi.fn(),
        del: vi.fn(),
        multi: vi.fn(() => ({
            incr: vi.fn().mockReturnThis(),
            expire: vi.fn().mockReturnThis(),
            exec: vi.fn().mockResolvedValue([1, 1]),
        })),
        ping: vi.fn().mockResolvedValue('PONG'),
        connect: vi.fn().mockResolvedValue(undefined),
        on: vi.fn(),
        quit: vi.fn().mockResolvedValue(undefined),
    };
    return {
        connectRedis: vi.fn().mockResolvedValue(mockRedis),
        getRedisClient: vi.fn(() => mockRedis),
    };
});

vi.mock('fastify-plugin', () => ({
    default: (fn: any) => fn,
}));

vi.mock('@fastify/helmet', () => ({
    default: Object.assign((f: any, o: any, d: any) => d(), { [Symbol.for('skip-override')]: true })
}));

vi.mock('@fastify/rate-limit', () => ({
    default: Object.assign((f: any, o: any, d: any) => d(), { [Symbol.for('skip-override')]: true })
}));

vi.mock('jsonwebtoken', async (importOriginal) => {
    const original = await importOriginal() as any;
    return {
        default: {
            ...original,
            verify: vi.fn((token, secret) => {
                if (token === 'valid') return { userId: 'u-1', role: 'user', type: 'access' };
                if (token === 'admin-valid') return { userId: 'admin-1', role: 'admin', type: 'access' };
                return original.verify(token, secret);
            }),
            sign: original.sign,
            decode: original.decode,
        }
    };
});

vi.mock('../utils/monitoring.service.js', () => ({ emit: vi.fn() }));

// ── Imports (AFTER mocks) ──────────────────────────────────────────────

import { buildApp } from '../app.js';
import { prisma } from '../config/prisma.js';

describe('Red Team: Full Black-Box Security Audit', () => {
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

    describe('PHASE 1: Account Abuse', () => {
        it('SECURITY: Block disposable email domains', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/register',
                payload: {
                    mobile: '9876543210',
                    email: 'scammer@10minutemail.com',
                    password: 'Password123',
                    dateOfBirth: '1990-01-01',
                    state: 'Karnataka',
                    cfTurnstileResponse: 'dummy-token',
                },
            });

            expect(res.statusCode).toBe(400);
            expect(res.json().message).toContain('Disposable email');
        });

        it('SECURITY: Rejection of underage registration', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/auth/register',
                payload: {
                    mobile: '9876543210',
                    password: 'Password123',
                    dateOfBirth: '2015-01-01',
                    state: 'Karnataka',
                    cfTurnstileResponse: 'dummy-token',
                },
            });
            expect(res.statusCode).toBe(400);
            expect(res.json().message).toContain('at least 18');
        });
    });

    describe('PHASE 2: Payment Attacks', () => {
        it('SECURITY: Reject unsigned webhook replay', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/webhooks/deposit',
                headers: { 'x-webhook-signature': 'invalid' },
                payload: {
                    deposit_id: 'd-2af3b8e1-5f11-4966-8888-c89b3d99e5a1', // Must be UUID
                    gateway_transaction_id: 'g-1',
                    amount: '500.00',
                    status: 'success',
                    timestamp: new Date().toISOString(),
                    nonce: 'nonce-123456',
                },
            });
            expect(res.statusCode).toBe(401);
        });
    });

    describe('PHASE 3: Wallet & Concurrency', () => {
        it('SECURITY: Prevent withdrawal without KYC (returns 403)', async () => {
            (prisma.user.findUnique as any).mockResolvedValue({ id: 'u-1', kycStatus: 'pending', accountStatus: 'active', fraudScore: 0 });

            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/wallet/withdraw',
                headers: { cookie: 'accessToken=valid; csrfToken=token', 'x-csrf-token': 'token' },
                payload: { amount: '500.00', idempotencyKey: 'withdraw-123' }
            });
            expect(res.statusCode).toBe(403);
            expect(res.json().message).toContain('KYC verification required');
        });
    });

    describe('PHASE 4: Admin Abuse', () => {
        it('SECURITY: Block non-admin from admin routes', async () => {
            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/admin/users',
                headers: { cookie: 'accessToken=valid' } // 'valid' token has role 'user'
            });
            expect(res.statusCode).toBe(403);
        });
    });

    describe('PHASE 5: Financial Edge Cases', () => {
        it('SECURITY: Reject ₹0.00 withdrawal attempts', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/wallet/withdraw',
                headers: { cookie: 'accessToken=valid; csrfToken=token', 'x-csrf-token': 'token' },
                payload: { amount: '0.00', idempotencyKey: 'withdraw-zero' }
            });
            expect(res.statusCode).toBe(400); // Zod validation fails
        });
    });

    describe('PHASE 6: API Hardening', () => {
        it('SECURITY: No stack traces in error responses', async () => {
            (prisma.user.findUnique as any).mockImplementation(() => { throw new Error('DB Crash'); });

            const res = await app.inject({
                method: 'GET',
                url: '/api/v1/users/me',
                headers: { cookie: 'accessToken=valid' }
            });

            expect(res.statusCode).toBe(500);
            expect(JSON.stringify(res.json())).not.toContain('DB Crash');
            expect(JSON.stringify(res.json())).not.toContain('node_modules');
        });
    });

    describe('PHASE 7: Rate Limiting (Observable)', () => {
        it('SECURITY: CSRF protection is active', async () => {
            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/wallet/deposit',
                headers: { cookie: 'accessToken=valid' }, // Missing CSRF header/cookie
                payload: { amount: '100.00', idempotencyKey: 'dep-1' }
            });
            expect(res.statusCode).toBe(403);
        });
    });

    describe('PHASE 8: Fraud Detection', () => {
        it('SECURITY: Trigger fraud flag on KYC reuse', async () => {
            (prisma.user.findUnique as any).mockResolvedValueOnce({ id: 'u-1', kycStatus: 'pending' });
            (prisma.user.findFirst as any).mockResolvedValueOnce({ id: 'u-old', kycStatus: 'verified' }); // Existing PAN found

            const res = await app.inject({
                method: 'POST',
                url: '/api/v1/kyc/submit',
                headers: { cookie: 'accessToken=valid; csrfToken=token', 'x-csrf-token': 'token' },
                payload: {
                    docType: 'pan',
                    docNumber: 'ABCDE1234F',
                    docUrl: 'https://cdn.com/id.jpg'
                }
            });

            expect(res.statusCode).toBe(409);
            expect(prisma.fraudFlag.create).toHaveBeenCalled();
        });
    });
});
