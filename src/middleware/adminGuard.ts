import type { FastifyRequest, FastifyReply } from 'fastify';
import { forbidden } from '../utils/errors.js';
import { hasRole } from '../utils/rbac.js';

/**
 * Admin role guard — allows admin, finance_admin, and super_admin.
 *
 * Hierarchy: super_admin > finance_admin > admin > user
 *
 * IMPORTANT: Previously this checked `role !== 'admin'` (strict equality)
 * which incorrectly blocked finance_admin and super_admin from all admin
 * routes. Fixed to use the shared hasRole() helper.
 *
 * Must be used AFTER authenticate middleware.
 */
export async function adminGuard(
    request: FastifyRequest,
    _reply: FastifyReply,
): Promise<void> {
    if (!request.currentUser) {
        throw forbidden('Authentication required');
    }

    if (!hasRole(request.currentUser.role, 'admin')) {
        throw forbidden('Admin access required. Minimum role: admin');
    }
}
