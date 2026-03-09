import type { FastifyInstance } from 'fastify';
import { authenticate } from '../../middleware/authenticate.js';
import { depositInitiateSchema, withdrawRequestSchema, withdrawOtpSchema } from './wallet.schema.js';
import {
    initiateDeposit,
    requestWithdrawal,
    generateWithdrawalOtp,
    getBalance,
    getTransactionHistory,
    getWithdrawalHistory,
} from './wallet.service.js';
import { successResponse, validationError, unauthorized } from '../../utils/errors.js';
import { RATE_LIMITS } from '../../config/constants.js';
import { generateTdsCertificate } from './tds.certificate.js';
import { checkDepositLimits } from '../auth/responsible-gaming.service.js';

export async function walletRoutes(app: FastifyInstance): Promise<void> {
    app.addHook('onRequest', authenticate);

    // ── POST /deposit ─────────────────────────────────────
    app.post('/deposit', {
        config: { rateLimit: RATE_LIMITS.deposit },
    }, async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const parsed = depositInitiateSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        // Responsible gaming: enforce daily/weekly deposit caps
        const limitCheck = await checkDepositLimits(request.currentUser.userId, parsed.data.amount);
        if (!limitCheck.allowed) {
            throw validationError(limitCheck.reason ?? 'Deposit limit exceeded');
        }

        const result = await initiateDeposit(request.currentUser.userId, parsed.data);
        return reply.status(201).send(successResponse(result, 'Deposit initiated'));
    });

    // ── POST /withdraw/request-otp ────────────────────────
    app.post('/withdraw/request-otp', {
        config: { rateLimit: RATE_LIMITS.withdrawal },
    }, async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        // Optional: validate minimum amount early before sending OTP
        const parsed = withdrawOtpSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const result = await generateWithdrawalOtp(request.currentUser.userId);
        return reply.status(200).send(successResponse(result, 'OTP sent for withdrawal verification'));
    });

    // ── POST /withdraw/request ────────────────────────────
    app.post('/withdraw/request', {
        config: { rateLimit: RATE_LIMITS.withdrawal },
    }, async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const parsed = withdrawRequestSchema.safeParse(request.body);
        if (!parsed.success) {
            throw validationError(parsed.error.errors.map(e => e.message).join(', '));
        }

        const result = await requestWithdrawal(request.currentUser.userId, parsed.data);
        return reply.status(201).send(successResponse(result, 'Withdrawal requested'));
    });

    // ── GET /balance ──────────────────────────────────────
    app.get('/balance', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();
        const balance = await getBalance(request.currentUser.userId);
        return reply.send(successResponse(balance));
    });

    // ── GET /transactions ─────────────────────────────────
    app.get('/transactions', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const query = request.query as { page?: string; limit?: string };
        const page = Math.max(1, parseInt(query.page ?? '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));

        const history = await getTransactionHistory(request.currentUser.userId, page, limit);
        return reply.send(successResponse(history));
    });

    // ── GET /withdraw/status ──────────────────────────────
    app.get('/withdraw/status', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();

        const query = request.query as { page?: string; limit?: string };
        const page = Math.max(1, parseInt(query.page ?? '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)));

        const history = await getWithdrawalHistory(request.currentUser.userId, page, limit);
        return reply.send(successResponse(history));
    });

    // ── GET /tds-certificate ──────────────────────────────
    app.get('/tds-certificate', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();
        const query = request.query as { fy?: string };
        if (!query.fy) throw validationError('fy query parameter required (e.g. 2025-2026)');
        const cert = await generateTdsCertificate(request.currentUser.userId, query.fy);
        return reply.send(successResponse(cert));
    });

    // ── GET /deposit-limits ───────────────────────────────
    app.get('/deposit-limits', async (request, reply) => {
        if (!request.currentUser) throw unauthorized();
        const limits = await checkDepositLimits(request.currentUser.userId, '0');
        return reply.send(successResponse(limits));
    });
}
