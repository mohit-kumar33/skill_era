import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import { AppError, ERROR_CODES } from '../utils/errors.js';
import { BLOCKED_STATES } from '../config/constants.js';

// ═══════════════════════════════════════════════════════════════════════
// GEO-RESTRICTION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════
//
// Blocks financial operations for users registered in legally restricted
// Indian states. Real-money gaming is prohibited in these jurisdictions.
//
// Design:
//   - Checks `user.state` field (set at registration)
//   - Only blocks financial endpoints (deposit, withdraw, tournament join)
//   - Non-financial endpoints (profile, KYC, etc.) remain accessible
//   - Returns 403 with compliance message
//   - Does NOT terminate accounts — users can still view balance
//
// Restricted states:
//   Assam, Andhra Pradesh, Odisha, Telangana, Nagaland, Sikkim
// ═══════════════════════════════════════════════════════════════════════

const BLOCKED_STATES_SET = new Set(BLOCKED_STATES.map((s: string) => s.toLowerCase()));

// Financial path prefixes that require geo-checks
const FINANCIAL_PATHS = [
    '/api/v1/wallet/deposit',
    '/api/v1/wallet/withdraw',
    '/api/v1/tournaments',
];

/**
 * Geo-restriction hook. Apply on the `/api/v1` scope.
 * Only checks on authenticated requests to financial endpoints.
 */
export async function geoRestrictionHook(
    request: FastifyRequest,
    _reply: FastifyReply,
): Promise<void> {
    // Skip non-financial routes
    const isFinancialPath = FINANCIAL_PATHS.some(p => request.url.startsWith(p));
    if (!isFinancialPath) return;

    // Skip if not authenticated (auth middleware will handle)
    const user = request.currentUser;
    if (!user) return;

    // Only check POST/PATCH — not GET (viewing is allowed)
    if (request.method === 'GET') return;

    try {
        const dbUser = await prisma.user.findUnique({
            where: { id: user.userId },
            select: { state: true },
        });

        if (!dbUser?.state) return; // No state recorded — allow (registration may not require it)

        if (BLOCKED_STATES_SET.has(dbUser.state.toLowerCase())) {
            logger.warn(
                { userId: user.userId, state: dbUser.state, url: request.url },
                'Geo-restricted: financial action blocked for banned state',
            );
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                `Real-money gaming is not permitted in ${dbUser.state} per regulatory guidelines. ` +
                'Financial operations are restricted for your registered state.',
                403,
            );
        }
    } catch (err) {
        if (err instanceof AppError) throw err;
        // Geo-check failure should not block requests — log and allow
        logger.error({ err, userId: user.userId }, 'Geo-restriction check failed — allowing request');
    }
}
