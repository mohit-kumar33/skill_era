import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { getDashboardData } from './dashboard.service.js';
import { successResponse, unauthorized } from '../../utils/errors.js';

export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
    // All dashboard routes require authentication
    app.addHook('onRequest', authenticate);

    // ── GET /dashboard ─────────────────────────────────────
    app.get('/', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();
        const data = await getDashboardData(request.currentUser.userId);
        return reply.send(successResponse(data, 'Dashboard loaded'));
    });
}
