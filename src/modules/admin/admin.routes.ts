import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { adminGuard } from '../../middleware/adminGuard.js';
import { financeAdminGuard } from '../../middleware/financeAdminGuard.js';
import {
    approveWithdrawalSchema,
    fraudFlagSchema,
    listWithdrawalsQuerySchema,
} from './admin.schema.js';
import {
    listWithdrawals,
    processWithdrawalApproval,
    addFraudFlag,
    getTreasurySnapshot,
    getAdminAuditLog,
    triggerPayout,
    retryFailedPayout,
    listUsers,
    setUserStatus,
    listKycSubmissions,
    verifyKycAdmin,
    getDashboardStats,
} from './admin.service.js';
import {
    successResponse,
    validationError,
    unauthorized,
    twoFactorRequired,
} from '../../utils/errors.js';
import { z } from 'zod';
import {
    generateTdsReport,
    generateAmlReport,
    exportAuditLog,
} from './reports.service.js';

// ═══════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════

export async function adminRoutes(app: FastifyInstance): Promise<void> {
    // All admin routes require authentication + admin role minimum
    app.addHook('onRequest', authenticate);
    app.addHook('onRequest', adminGuard);

    // ── GET /stats ────────────────────────────────────────────────────
    app.get('/stats', async (_request, reply) => {
        const stats = await getDashboardStats();
        return reply.send(successResponse(stats));
    });

    // ── GET /users ────────────────────────────────────────────────────
    app.get('/users', async (request, reply) => {
        const query = request.query as {
            page?: string;
            limit?: string;
            search?: string;
            status?: string;
        };
        const page = Math.max(1, parseInt(query.page ?? '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));

        const result = await listUsers({
            page,
            limit,
            search: query.search,
            status: query.status,
        });
        return reply.send(successResponse(result));
    });

    // ── PATCH /users/:id/suspend ──────────────────────────────────────
    app.patch('/users/:id/suspend', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();
        const { id } = request.params as { id: string };
        const result = await setUserStatus(request.currentUser.userId, id, 'suspend');
        return reply.send(successResponse(result, 'User suspended'));
    });

    // ── PATCH /users/:id/ban ──────────────────────────────────────────
    app.patch('/users/:id/ban', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();
        const { id } = request.params as { id: string };
        const result = await setUserStatus(request.currentUser.userId, id, 'ban');
        return reply.send(successResponse(result, 'User banned'));
    });

    // ── PATCH /users/:id/unfreeze ─────────────────────────────────────
    app.patch('/users/:id/unfreeze', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();
        const { id } = request.params as { id: string };
        const result = await setUserStatus(request.currentUser.userId, id, 'unfreeze');
        return reply.send(successResponse(result, 'User unfrozen'));
    });

    // ── GET /kyc ──────────────────────────────────────────────────────
    app.get('/kyc', async (request, reply) => {
        const query = request.query as { page?: string; limit?: string; status?: string };
        const page = Math.max(1, parseInt(query.page ?? '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));

        const result = await listKycSubmissions({
            page,
            limit,
            status: query.status,
        });
        return reply.send(successResponse(result));
    });

    // ── POST /kyc/:id/approve ─────────────────────────────────────────
    app.post('/kyc/:id/approve', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();
        const { id } = request.params as { id: string };
        const result = await verifyKycAdmin(request.currentUser.userId, id, 'approve');
        return reply.send(successResponse(result, 'KYC approved'));
    });

    // ── POST /kyc/:id/reject ──────────────────────────────────────────
    app.post('/kyc/:id/reject', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();
        const { id } = request.params as { id: string };
        const body = request.body as { reason?: string };
        const result = await verifyKycAdmin(request.currentUser.userId, id, 'reject', body.reason);
        return reply.send(successResponse(result, 'KYC rejected'));
    });

    // ── GET /withdrawals ──────────────────────────────────────────────
    app.get('/withdrawals', async (request, reply) => {
        const parsed = listWithdrawalsQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }
        const result = await listWithdrawals(parsed.data);
        return reply.send(successResponse(result));
    });

    // ── POST /withdrawals/process ─────────────────────────────────────
    app.post('/withdrawals/process', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const parsed = approveWithdrawalSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const result = await processWithdrawalApproval(request.currentUser.userId, parsed.data);
        return reply.send(successResponse(result, `Withdrawal ${result.status}`));
    });

    // ── POST /withdrawals/payout/:id ──────────────────────────────────
    app.post('/withdrawals/payout/:id', {
        preHandler: [financeAdminGuard],
    }, async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const params = request.params as { id: string };

        const twoFaToken = (request.headers['x-2fa-token'] as string) ?? '';
        if (!twoFaToken) {
            throw twoFactorRequired();
        }

        const ipAddress = request.ip ?? 'unknown';

        const result = await triggerPayout(
            request.currentUser.userId,
            params.id,
            ipAddress,
            twoFaToken,
        );

        const message = result.idempotentReplay
            ? 'Payout already processed — returning cached result'
            : 'Payout executed successfully';

        return reply.send(successResponse(result, message));
    });

    // ── POST /withdrawals/retry-payout/:id ───────────────────────────
    app.post('/withdrawals/retry-payout/:id', {
        preHandler: [financeAdminGuard],
    }, async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const params = request.params as { id: string };
        const twoFaToken = (request.headers['x-2fa-token'] as string) ?? '';
        if (!twoFaToken) {
            throw twoFactorRequired();
        }

        const ipAddress = request.ip ?? 'unknown';

        const result = await retryFailedPayout(
            request.currentUser.userId,
            params.id,
            ipAddress,
            twoFaToken,
        );

        return reply.send(successResponse(result, 'Payout retry successful'));
    });

    // ── POST /fraud-flags ─────────────────────────────────────────────
    app.post('/fraud-flags', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const parsed = fraudFlagSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const result = await addFraudFlag(request.currentUser.userId, parsed.data);
        return reply.status(201).send(successResponse(result, 'Fraud flag added'));
    });

    // ── GET /treasury ─────────────────────────────────────────────────
    app.get('/treasury', async (_request, reply) => {
        const snapshot = await getTreasurySnapshot();
        return reply.send(successResponse(snapshot));
    });

    // ── GET /audit-log ────────────────────────────────────────────────
    app.get('/audit-log', async (request, reply) => {
        const query = request.query as { page?: string; limit?: string };
        const page = Math.max(1, parseInt(query.page ?? '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '50', 10)));

        const result = await getAdminAuditLog(page, limit);
        return reply.send(successResponse(result));
    });

    // ═══════════════════════════════════════════════════════════════════
    // REGULATORY REPORT ENDPOINTS
    // ═══════════════════════════════════════════════════════════════════

    const reportQuerySchema = z.object({
        startDate: z.string().datetime({ message: 'startDate must be ISO 8601' }),
        endDate: z.string().datetime({ message: 'endDate must be ISO 8601' }),
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().min(1).max(500).default(50),
    });

    // ── GET /reports/tds ──────────────────────────────────────────────
    app.get('/reports/tds', {
        preHandler: [financeAdminGuard],
    }, async (request, reply) => {
        const parsed = reportQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }
        const result = await generateTdsReport(
            { startDate: new Date(parsed.data.startDate), endDate: new Date(parsed.data.endDate) },
            { page: parsed.data.page, limit: parsed.data.limit },
        );
        return reply.send(successResponse(result));
    });

    // ── GET /reports/aml ──────────────────────────────────────────────
    app.get('/reports/aml', {
        preHandler: [financeAdminGuard],
    }, async (request, reply) => {
        const parsed = reportQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }
        const result = await generateAmlReport(
            { startDate: new Date(parsed.data.startDate), endDate: new Date(parsed.data.endDate) },
            { page: parsed.data.page, limit: parsed.data.limit },
        );
        return reply.send(successResponse(result));
    });

    // ── GET /reports/audit ────────────────────────────────────────────
    app.get('/reports/audit', {
        preHandler: [financeAdminGuard],
    }, async (request, reply) => {
        const parsed = reportQuerySchema.safeParse(request.query);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }
        const result = await exportAuditLog(
            { startDate: new Date(parsed.data.startDate), endDate: new Date(parsed.data.endDate) },
            { page: parsed.data.page, limit: parsed.data.limit },
        );
        return reply.send(successResponse(result));
    });
}
