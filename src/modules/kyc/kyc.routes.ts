import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { adminGuard } from '../../middleware/adminGuard.js';
import { submitKycSchema, verifyKycSchema } from './kyc.schema.js';
import { submitKyc, verifyKyc, getKycStatus } from './kyc.service.js';
import { successResponse, validationError, unauthorized } from '../../utils/errors.js';

export async function kycRoutes(app: FastifyInstance): Promise<void> {
    app.addHook('onRequest', authenticate);

    // ── POST /submit ──────────────────────────────────────
    app.post('/submit', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const parsed = submitKycSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const result = await submitKyc(request.currentUser.userId, parsed.data);
        return reply.status(200).send(successResponse(result, 'KYC submitted'));
    });

    // ── GET /status ───────────────────────────────────────
    app.get('/status', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();
        const status = await getKycStatus(request.currentUser.userId);
        return reply.send(successResponse(status));
    });

    // ── POST /verify (admin only) ─────────────────────────
    app.post('/verify', { preHandler: [adminGuard] }, async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const parsed = verifyKycSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const result = await verifyKyc(request.currentUser.userId, parsed.data);
        return reply.send(successResponse(result, `KYC ${parsed.data.action}d`));
    });
}
