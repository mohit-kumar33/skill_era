import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { adminGuard } from '../../middleware/adminGuard.js';
import {
    createTournamentSchema,
    joinTournamentSchema,
    submitResultSchema,
    presignedUrlSchema,
    userSubmitResultSchema,
} from './tournaments.schema.js';
import {
    createTournament,
    listTournaments,
    getTournament,
    joinTournament,
    submitResultAndDistributePrize,
    submitTournamentResult,
} from './tournaments.service.js';
import { successResponse, validationError, unauthorized } from '../../utils/errors.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { generateUploadUrl } from '../../utils/storage.service.js';

export async function tournamentRoutes(app: FastifyInstance): Promise<void> {
    app.addHook('onRequest', authenticate);

    // ── GET / ─────────────────────────────────────────
    app.get('/', async (request, reply) => {
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

    // ── POST /:id/join ────────────────────────────────────────
    app.post('/:id/join', {
        config: { rateLimit: RATE_LIMITS.tournamentJoin },
    }, async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const { id } = request.params as { id: string };

        const parsed = joinTournamentSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const input = {
            tournamentId: id,
            idempotencyKey: parsed.data.idempotencyKey,
        };

        const result = await joinTournament(request.currentUser.userId, input, request.ip);
        return reply.send(successResponse(result, 'Joined tournament'));
    });

    // ── POST /:id/result/presigned-url ───────────────────────
    app.post('/:id/result/presigned-url', {
        config: { rateLimit: RATE_LIMITS.tournamentJoin }, // reusing same limit group roughly
    }, async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const { id } = request.params as { id: string };

        const parsed = presignedUrlSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const result = await generateUploadUrl(
            'tournament-evidence',
            request.currentUser.userId,
            parsed.data.fileName,
            parsed.data.contentType
        );

        return reply.send(successResponse(result, 'Upload URL generated'));
    });

    // ── POST /:id/result/upload ──────────────────────────────
    app.post('/:id/result/upload', {
        config: { rateLimit: RATE_LIMITS.tournamentJoin },
    }, async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const { id } = request.params as { id: string };

        const parsed = userSubmitResultSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const result = await submitTournamentResult(
            request.currentUser.userId,
            id,
            parsed.data
        );

        return reply.status(201).send(successResponse(result, 'Result submitted successfully'));
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
