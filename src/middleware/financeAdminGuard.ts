import type { FastifyRequest, FastifyReply } from 'fastify';
import { forbidden } from '../utils/errors.js';
import { hasRole } from '../utils/rbac.js';

// ═══════════════════════════════════════════════════════════════════════
// FINANCE ADMIN GUARD
// ═══════════════════════════════════════════════════════════════════════
//
// RBAC middleware for sensitive financial operations (payout execution,
// payout retry). Requires finance_admin or super_admin.
// Regular 'admin' role users are intentionally blocked.
//
// Must be used AFTER authenticate middleware.
// ═══════════════════════════════════════════════════════════════════════

export async function financeAdminGuard(
    request: FastifyRequest,
    _reply: FastifyReply,
): Promise<void> {
    if (!request.currentUser) {
        throw forbidden('Authentication required');
    }

    if (!hasRole(request.currentUser.role, 'finance_admin')) {
        throw forbidden(
            `Payout operations require 'finance_admin' or 'super_admin' role. ` +
            `Current role: '${request.currentUser.role}'`,
        );
    }
}
