import crypto from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger.js';
import { AppError, ERROR_CODES } from '../utils/errors.js';
import { env } from '../config/env.js';

// ═══════════════════════════════════════════════════════════════════════
// CSRF PROTECTION — Double-Submit Cookie Pattern
// ═══════════════════════════════════════════════════════════════════════
//
// How it works:
//   1. On login/register/refresh, backend sets a `csrfToken` cookie
//      that is NOT httpOnly (so JS can read it).
//   2. Frontend reads `csrfToken` cookie and sends it as `X-CSRF-Token` header.
//   3. This middleware verifies: cookie value === header value.
//
// Why it works:
//   - An attacker on a different origin cannot read our cookies (SameSite + CORS).
//   - So they cannot set the X-CSRF-Token header with the correct value.
//   - The cookie travels automatically, but without the matching header, 403.
//
// Excluded:
//   - GET/HEAD/OPTIONS (safe methods)
//   - /webhooks/* (HMAC-protected, no cookie auth)
//   - /auth/login, /auth/register (no cookie exists yet)
//   - /health (public)
// ═══════════════════════════════════════════════════════════════════════

const CSRF_EXCLUDED_PATHS = new Set([
    '/api/v1/auth/login',
    '/api/v1/auth/register',
    '/api/v1/auth/google',
]);

const CSRF_EXCLUDED_PREFIXES = [
    '/webhooks/',
    '/health',
    '/internal/',
];

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Generate a 256-bit CSRF token.
 */
export function generateCsrfToken(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * CSRF cookie options — NOT httpOnly so frontend JS can read it.
 */
export const CSRF_COOKIE_OPTIONS = {
    httpOnly: false,     // Frontend must be able to read this
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
    path: '/',
    maxAge: 24 * 60 * 60, // 24 hours
};

/**
 * Set CSRF token cookie on the reply.
 * Call this after successful login, register, refresh.
 */
export function setCsrfCookie(reply: FastifyReply): string {
    const token = generateCsrfToken();
    reply.setCookie('csrfToken', token, CSRF_COOKIE_OPTIONS);
    return token;
}

/**
 * Clear CSRF cookie. Call on logout.
 */
export function clearCsrfCookie(reply: FastifyReply): void {
    reply.clearCookie('csrfToken', { path: '/' });
}

/**
 * CSRF verification middleware.
 * Registered as an onRequest hook on the /api/v1 scope.
 */
export async function csrfProtection(
    request: FastifyRequest,
    _reply: FastifyReply,
): Promise<void> {
    // Skip safe methods
    if (SAFE_METHODS.has(request.method)) return;

    // Skip excluded paths
    const urlPath = request.url.split('?')[0] ?? request.url;
    if (CSRF_EXCLUDED_PATHS.has(urlPath)) return;

    // Skip excluded prefixes
    for (const prefix of CSRF_EXCLUDED_PREFIXES) {
        if (urlPath.startsWith(prefix)) return;
    }

    // Extract tokens
    const cookies = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies;
    const cookieToken = cookies?.csrfToken;
    const headerToken = request.headers['x-csrf-token'] as string | undefined;

    if (!cookieToken || !headerToken) {
        logger.warn(
            { ip: request.ip, url: request.url, hasCookie: !!cookieToken, hasHeader: !!headerToken },
            'CSRF: missing token',
        );
        throw new AppError(ERROR_CODES.UNAUTHORIZED, 'CSRF token missing', 403);
    }

    // Timing-safe comparison to prevent timing attacks
    if (cookieToken.length !== headerToken.length) {
        logger.warn({ ip: request.ip, url: request.url }, 'CSRF: token length mismatch');
        throw new AppError(ERROR_CODES.UNAUTHORIZED, 'CSRF token invalid', 403);
    }

    const cookieBuf = Buffer.from(cookieToken);
    const headerBuf = Buffer.from(headerToken);

    if (!crypto.timingSafeEqual(cookieBuf, headerBuf)) {
        logger.warn({ ip: request.ip, url: request.url }, 'CSRF: token mismatch');
        throw new AppError(ERROR_CODES.UNAUTHORIZED, 'CSRF token invalid', 403);
    }
}
