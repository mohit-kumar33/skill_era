import type { FastifyRequest, FastifyReply } from 'fastify';
import { forbidden } from '../utils/errors.js';
import { hasRole } from '../utils/rbac.js';

/**
 * Super Admin guard — allows super_admin only.
 * Use for platform-level operations (e.g., role assignment, system config).
 * Must be used AFTER authenticate middleware.
 */
export async function superAdminGuard(
    request: FastifyRequest,
    _reply: FastifyReply,
): Promise<void> {
    if (!request.currentUser) {
        throw forbidden('Authentication required');
    }

    if (!hasRole(request.currentUser.role, 'super_admin')) {
        throw forbidden(
            `This action requires 'super_admin' role. ` +
            `Current role: '${request.currentUser.role}'`,
        );
    }
}
