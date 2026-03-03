import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import helmet from '@fastify/helmet';
import { logger } from './utils/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestIdHook } from './middleware/requestId.js';
import { csrfProtection } from './middleware/csrfProtection.js';
import { fraudFingerprintHook } from './middleware/fraudHardening.js';
import { geoRestrictionHook } from './middleware/geoRestriction.js';
import { RATE_LIMITS } from './config/constants.js';
import { checkDatabaseHealth, isPoolOverloaded } from './config/database.js';
import { successResponse } from './utils/errors.js';
import { env } from './config/env.js';
import { trackErrorRate } from './utils/alerting.js';
import { connectRedis, getRedisClient } from './config/redis.js';

// Module routes
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/users.routes.js';
import { walletRoutes } from './modules/wallet/wallet.routes.js';
import { walletWebhookRoutes } from './modules/wallet/wallet.webhook.js';
import { tournamentRoutes } from './modules/tournaments/tournaments.routes.js';
import { adminRoutes } from './modules/admin/admin.routes.js';
import { kycRoutes } from './modules/kyc/kyc.routes.js';
import { metricsRoutes } from './modules/internal/metrics.routes.js';

export async function buildApp() {
    const app = Fastify({
        logger: false, // We use our own Pino instance
        requestIdHeader: 'x-request-id',
        genReqId: () => crypto.randomUUID(),
        bodyLimit: 1_048_576, // 1MB
    });

    // ── Global hooks ────────────────────────────────────
    app.addHook('onRequest', requestIdHook);

    app.addHook('onRequest', async (request) => {
        logger.info(
            { requestId: request.id, method: request.method, url: request.url },
            'Incoming request',
        );
    });

    app.addHook('onResponse', async (request, reply) => {
        // Track 5xx for alerting
        if (reply.statusCode >= 500) {
            trackErrorRate();
        }

        logger.info(
            {
                requestId: request.id,
                method: request.method,
                url: request.url,
                statusCode: reply.statusCode,
                responseTime: reply.elapsedTime,
            },
            'Request completed',
        );
    });

    // ── Error handler ───────────────────────────────────
    app.setErrorHandler(errorHandler);

    // ── Plugins ─────────────────────────────────────────
    await app.register(cookie);

    // ── Helmet — Content Security Policy ────────────────
    await app.register(helmet, {
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:'],
                connectSrc: ["'self'",
                    ...env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean),
                    ...env.CORS_ADMIN_ORIGINS.split(',').map(o => o.trim()).filter(Boolean),
                ],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
            },
        },
        crossOriginEmbedderPolicy: false, // Allow images from signed URLs
    });

    // ── CORS — Separated User + Admin Origins ───────────
    // User origins: allowed on all routes
    // Admin origins: allowed on /api/v1/admin/* routes
    const userOrigins = env.CORS_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
    const adminOrigins = env.CORS_ADMIN_ORIGINS.split(',').map(o => o.trim()).filter(Boolean);
    const allAllowedOrigins = [...new Set([...userOrigins, ...adminOrigins])];

    await app.register(cors, {
        origin: (origin, cb) => {
            // Allow requests with no origin (curl, server-to-server)
            if (!origin) return cb(null, true);
            if (env.NODE_ENV === 'development') return cb(null, true);
            if (allAllowedOrigins.includes(origin)) return cb(null, true);
            logger.warn({ origin }, 'CORS: blocked request from unauthorized origin');
            return cb(null, false);
        },
        credentials: true,
    });

    // Rate limiting — Redis-backed for multi-instance safety
    // Shared client also used for webhook replay protection
    const redisClient = await connectRedis();

    await app.register(rateLimit, {
        max: RATE_LIMITS.general.max,
        timeWindow: RATE_LIMITS.general.timeWindow,
        redis: redisClient?.status === 'ready' ? redisClient : undefined,
    });

    // ── Health check ────────────────────────────────────
    app.get('/api/health', async (_request, reply) => {
        const dbHealthy = await checkDatabaseHealth();

        let redisHealthy = false;
        try {
            if (redisClient?.status === 'ready') {
                await redisClient.ping();
                redisHealthy = true;
            }
        } catch {
            redisHealthy = false;
        }

        const allHealthy = dbHealthy && redisHealthy;
        const status = allHealthy ? 'healthy' : 'degraded';
        const statusCode = dbHealthy ? 200 : 503; // DB down = 503; Redis down = 200 but degraded

        return reply.status(statusCode).send(
            successResponse({
                status,
                timestamp: new Date().toISOString(),
                database: dbHealthy ? 'connected' : 'disconnected',
                redis: redisHealthy ? 'connected' : 'disconnected',
            }),
        );
    });

    // ── Readiness check (deeper than /health) ──────────
    app.get('/readiness', async (_request, reply) => {
        const dbHealthy = await checkDatabaseHealth();

        let redisReady = false;
        try {
            if (redisClient?.status === 'ready') {
                await redisClient.ping();
                redisReady = true;
            }
        } catch {
            redisReady = false;
        }

        const poolOverloaded = isPoolOverloaded();
        const ready = dbHealthy && redisReady && !poolOverloaded;

        return reply.status(ready ? 200 : 503).send(
            successResponse({
                ready,
                timestamp: new Date().toISOString(),
                database: dbHealthy ? 'connected' : 'disconnected',
                redis: redisReady ? 'connected' : 'disconnected',
                poolBackpressure: poolOverloaded ? 'overloaded' : 'ok',
            }),
        );
    });

    // ── Module routes (API v1) ──────────────────────────
    await app.register(async (api) => {
        // CSRF protection on all state-changing API requests
        api.addHook('onRequest', csrfProtection);

        // Fraud fingerprint logging on authenticated requests
        api.addHook('onRequest', fraudFingerprintHook);

        // Geo-restriction for banned Indian states (financial endpoints)
        api.addHook('onRequest', geoRestrictionHook);

        // Auth routes — shared by both admin and user frontends
        await api.register(authRoutes, { prefix: '/auth' });
        await api.register(userRoutes, { prefix: '/users' });
        await api.register(walletRoutes, { prefix: '/wallet' });
        await api.register(tournamentRoutes, { prefix: '/tournaments' });
        await api.register(kycRoutes, { prefix: '/kyc' });

        // Admin routes — enforce admin-only CORS origins
        await api.register(async (adminScope) => {
            adminScope.addHook('onRequest', async (request, reply) => {
                const origin = request.headers.origin;
                if (origin && !adminOrigins.includes(origin)) {
                    logger.warn({ origin }, 'Admin route accessed from non-admin origin');
                    return reply.status(403).send({ error: 'Forbidden: admin origin required' });
                }
            });
            await adminScope.register(adminRoutes);
        }, { prefix: '/admin' });
    }, { prefix: '/api/v1' });

    // Webhooks are outside /api/v1 (no auth required, HMAC verified)
    await app.register(walletWebhookRoutes, { prefix: '/webhooks' });

    // Internal metrics — MUST be firewall-restricted in production (never expose publicly)
    await app.register(metricsRoutes, { prefix: '/internal' });

    return app;
}

