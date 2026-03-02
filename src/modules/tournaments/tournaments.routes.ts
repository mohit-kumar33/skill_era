import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { adminGuard } from '../../middleware/adminGuard.js';
import {
    createTournamentSchema,
    joinTournamentSchema,
    submitResultSchema,
} from './tournaments.schema.js';
import {
    createTournament,
    listTournaments,
    getTournament,
    joinTournament,
    submitResultAndDistributePrize,
} from './tournaments.service.js';
import { successResponse, validationError, unauthorized } from '../../utils/errors.js';
import { RATE_LIMITS } from '../../config/constants.js';

export async function tournamentRoutes(app: FastifyInstance): Promise<void> {
    app.addHook('onRequest', authenticate);

    // ── GET /list ─────────────────────────────────────────
    app.get('/list', async (request, reply) => {
        const query = request.query as { status?: string; page?: string; limit?: string };
        const page = Math.max(1, parseInt(query.page ?? '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));

        const result = await listTournaments(query.status, page, limit);
        return reply.send(successResponse(result));
    });

    // ── GET /:id ──────────────────────────────────────────
    app.get('/:id', async (request, reply) => {
        const { id } = request.params as { id: string };
        const tournament = await getTournament(id);
        return reply.send(successResponse(tournament));
    });

    // ── POST /create (admin only) ─────────────────────────
    app.post('/create', { preHandler: [adminGuard] }, async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const parsed = createTournamentSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const result = await createTournament(request.currentUser.userId, parsed.data);
        return reply.status(201).send(successResponse(result, 'Tournament created'));
    });

    // ── POST /join ────────────────────────────────────────
    app.post('/join', {
        config: { rateLimit: RATE_LIMITS.tournamentJoin },
    }, async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const parsed = joinTournamentSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const result = await joinTournament(request.currentUser.userId, parsed.data, request.ip);
        return reply.send(successResponse(result, 'Joined tournament'));
    });

    // ── POST /result (admin only) ─────────────────────────
    app.post('/result', { preHandler: [adminGuard] }, async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const parsed = submitResultSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const result = await submitResultAndDistributePrize(
            request.currentUser.userId,
            parsed.data,
        );
        return reply.send(successResponse(result, 'Result submitted, prize distributed'));
    });
}
