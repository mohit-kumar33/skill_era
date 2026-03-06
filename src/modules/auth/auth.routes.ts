import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { registerSchema, loginSchema, refreshSchema, googleAuthSchema } from './auth.schema.js';
import { googleLogin } from './google.service.js';
import {
    registerUser,
    loginUser,
    refreshAccessToken,
    revokeRefreshToken,
    setup2FA,
    enable2FA,
    disable2FA,
    completeAdmin2FALogin,
    resetTotpLockout,
} from './auth.service.js';
import { authenticate } from '../../middleware/authenticate.js';
import { successResponse, validationError } from '../../utils/errors.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { setCsrfCookie, clearCsrfCookie } from '../../middleware/csrfProtection.js';
import { z } from 'zod';
import { requestAccountDeletion, cancelDeletionRequest } from './gdpr.service.js';
import { activateSelfExclusion, getSelfExclusionStatus } from './responsible-gaming.service.js';

const totpTokenSchema = z.object({
    token: z.string().length(6).regex(/^\d{6}$/, 'TOTP token must be a 6-digit number'),
});

const login2FASchema = z.object({
    preAuthToken: z.string().min(1),
    token: z.string().length(6).regex(/^\d{6}$/, 'TOTP token must be a 6-digit number'),
});

// ── Cookie helpers ─────────────────────────────────────

const COOKIE_BASE = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
};

function setAuthCookies(reply: import('fastify').FastifyReply, accessToken: string, refreshToken: string) {
    reply.setCookie('accessToken', accessToken, {
        ...COOKIE_BASE,
        maxAge: 15 * 60, // 15 minutes
    });
    reply.setCookie('refreshToken', refreshToken, {
        ...COOKIE_BASE,
        maxAge: 7 * 24 * 60 * 60, // 7 days
    });
}

function clearAuthCookies(reply: import('fastify').FastifyReply) {
    reply.clearCookie('accessToken', { path: '/' });
    reply.clearCookie('refreshToken', { path: '/' });
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
    // ── POST /register ────────────────────────────────────
    app.post('/register', {
        config: { rateLimit: RATE_LIMITS.register },
    }, async (request, reply) => {
        const parsed = registerSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }
        const meta = { ip: request.ip };
        const result = await registerUser(parsed.data, meta);

        // Set cookies for web clients
        setAuthCookies(reply, result.tokens.accessToken, result.tokens.refreshToken);
        setCsrfCookie(reply);

        return reply.status(201).send(successResponse(result, 'Registration successful'));
    });

    // ── POST /login ───────────────────────────────────────
    app.post('/login', {
        config: { rateLimit: RATE_LIMITS.login },
    }, async (request, reply) => {
        const parsed = loginSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const meta = { ip: request.ip, userAgent: request.headers['user-agent'] ?? 'unknown' };
        const result = await loginUser(parsed.data, meta);

        // If admin 2FA required, return pre-auth token without setting cookies
        if (result.requires2FA) {
            return reply.status(200).send(successResponse({
                requires2FA: true,
                preAuthToken: result.tokens.accessToken,
                user: { id: result.user.id, role: result.user.role },
            }, 'Password verified. 2FA token required.'));
        }

        // Set httpOnly cookies for web clients
        setAuthCookies(reply, result.tokens.accessToken, result.tokens.refreshToken);
        setCsrfCookie(reply);

        return reply.status(200).send(successResponse(result, 'Login successful'));
    });

    // ── POST /login/verify-2fa ────────────────────────────
    // Completes admin login after password + 2FA verification
    app.post('/login/verify-2fa', {
        config: { rateLimit: RATE_LIMITS.login },
    }, async (request, reply) => {
        const parsed = login2FASchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const meta = { ip: request.ip, userAgent: request.headers['user-agent'] ?? 'unknown' };
        const result = await completeAdmin2FALogin(parsed.data.preAuthToken, parsed.data.token, meta);

        setAuthCookies(reply, result.tokens.accessToken, result.tokens.refreshToken);
        setCsrfCookie(reply);

        return reply.status(200).send(successResponse(result, 'Login successful'));
    });

    // ── POST /refresh ─────────────────────────────────────
    app.post('/refresh', async (request, reply) => {
        // Try cookie first, then body
        const cookies = (request as import('fastify').FastifyRequest & { cookies?: Record<string, string> }).cookies;
        const cookieRefreshToken = cookies?.refreshToken;
        const bodyParsed = refreshSchema.safeParse(request.body);

        const refreshToken = cookieRefreshToken ?? (bodyParsed.success ? bodyParsed.data.refreshToken : undefined);

        if (!refreshToken) throw validationError('Refresh token required');

        const tokens = await refreshAccessToken(refreshToken);

        // Set new cookies for web clients
        setAuthCookies(reply, tokens.accessToken, tokens.refreshToken);
        setCsrfCookie(reply);

        return reply.status(200).send(successResponse(tokens, 'Token refreshed'));
    });

    // ── POST /logout ────────────────────────────────────────────
    app.post('/logout', async (request, reply) => {
        // Revoke refresh token server-side
        const cookies = (request as import('fastify').FastifyRequest & { cookies?: Record<string, string> }).cookies;
        const refreshToken = cookies?.refreshToken;
        if (refreshToken) {
            const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
            const userId = request.currentUser?.userId;
            await revokeRefreshToken(tokenHash, {
                userId,
                ip: request.ip,
                userAgent: request.headers['user-agent'] ?? 'unknown',
            });
        }

        clearAuthCookies(reply);
        clearCsrfCookie(reply);
        return reply.status(200).send(successResponse(null, 'Logged out'));
    });

    // ═══════════════════════════════════════════════════════
    // 2FA Endpoints (require JWT auth)
    // ═══════════════════════════════════════════════════════

    // ── POST /2fa/setup ───────────────────────────────────
    app.post('/2fa/setup', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const userId = request.currentUser!.userId;
        const result = await setup2FA(userId);
        return reply.status(200).send(successResponse(result, 'Scan the QR code with your authenticator app, then call /2fa/enable with your first valid token'));
    });

    // ── POST /2fa/enable ──────────────────────────────────
    app.post('/2fa/enable', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const userId = request.currentUser!.userId;
        const parsed = totpTokenSchema.safeParse(request.body);
        if (!parsed.success) throw validationError('token must be a 6-digit number');
        await enable2FA(userId, parsed.data.token);
        return reply.status(200).send(successResponse(null, '2FA enabled successfully'));
    });

    // ── POST /2fa/disable ─────────────────────────────────
    app.post('/2fa/disable', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const userId = request.currentUser!.userId;
        const parsed = totpTokenSchema.safeParse(request.body);
        if (!parsed.success) throw validationError('token must be a 6-digit number');
        await disable2FA(userId, parsed.data.token);
        return reply.status(200).send(successResponse(null, '2FA disabled successfully'));
    });

    // ── POST /2fa/reset-lockout ───────────────────────────
    // Super-admin only: Reset TOTP lockout for a locked-out admin
    app.post('/2fa/reset-lockout', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const adminId = request.currentUser!.userId;
        const body = request.body as { targetUserId?: string };
        if (!body.targetUserId) throw validationError('targetUserId is required');
        await resetTotpLockout(adminId, body.targetUserId);
        return reply.status(200).send(successResponse(null, 'TOTP lockout reset successfully'));
    });

    // ═══════════════════════════════════════════════════════
    // DPDP Act — Account Deletion
    // ═══════════════════════════════════════════════════════

    // ── DELETE /account ───────────────────────────────────
    app.delete('/account', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const userId = request.currentUser!.userId;
        const result = await requestAccountDeletion(userId);
        return reply.send(successResponse(result));
    });

    // ── POST /account/cancel-deletion ─────────────────────
    app.post('/account/cancel-deletion', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const userId = request.currentUser!.userId;
        const result = await cancelDeletionRequest(userId);
        return reply.send(successResponse(result));
    });

    // ═══════════════════════════════════════════════════════
    // Responsible Gaming — Self-Exclusion
    // ═══════════════════════════════════════════════════════

    // ── POST /self-exclusion ─────────────────────────────
    app.post('/self-exclusion', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const userId = request.currentUser!.userId;
        const body = request.body as { durationDays?: number };
        if (!body.durationDays) throw validationError('durationDays is required (1, 7, 30, or 365)');
        const result = await activateSelfExclusion(userId, body.durationDays as 1 | 7 | 30 | 365);
        return reply.send(successResponse(result));
    });

    // ── GET /self-exclusion ──────────────────────────────
    app.get('/self-exclusion', {
        preHandler: [authenticate],
    }, async (request, reply) => {
        const userId = request.currentUser!.userId;
        const status = await getSelfExclusionStatus(userId);
        return reply.send(successResponse(status));
    });
}

