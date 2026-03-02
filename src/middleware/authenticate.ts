import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { unauthorized } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

export interface JwtPayload {
    userId: string;
    role: 'user' | 'admin' | 'finance_admin' | 'super_admin';
}

declare module 'fastify' {
    interface FastifyRequest {
        currentUser?: JwtPayload;
    }
}

/**
 * JWT authentication middleware.
 * Extracts token from:
 *   1. Authorization: Bearer <token> header (API / mobile clients)
 *   2. accessToken httpOnly cookie (admin panel / web clients)
 */
export async function authenticate(
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<void> {
    let token: string | undefined;

    // Priority 1: Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7);
    }

    // Priority 2: httpOnly cookie (admin panel)
    if (!token) {
        const cookies = (request as FastifyRequest & { cookies?: Record<string, string> }).cookies;
        token = cookies?.accessToken;
    }

    if (!token) {
        throw unauthorized('Missing or invalid Authorization header');
    }

    try {
        const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload & { type?: string };

        if (!decoded.userId || !decoded.role) {
            throw unauthorized('Invalid token payload');
        }

        // Reject any token with a non-access type (e.g., pre_auth_2fa, refresh).
        // Future-proof: new token types won't accidentally bypass auth.
        if (decoded.type && decoded.type !== 'access') {
            logger.warn(
                { userId: decoded.userId, tokenType: decoded.type },
                'Rejected non-access token type in authenticate middleware',
            );
            throw unauthorized('Invalid token type');
        }

        request.currentUser = decoded;
    } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
            throw unauthorized('Token expired');
        }
        if (err instanceof jwt.JsonWebTokenError) {
            throw unauthorized('Invalid token');
        }
        logger.error({ err }, 'JWT verification error');
        throw unauthorized('Authentication failed');
    }
}
