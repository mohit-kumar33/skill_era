import { env } from './config/env.js';
import { logger } from './utils/logger.js';
import { buildApp } from './app.js';
import { closeDatabasePool, validatePoolCapacity, startPoolMonitoring, stopPoolMonitoring } from './config/database.js';
import { closePrisma } from './config/prisma.js';
import { startReconciliationLoop, stopReconciliationLoop } from './modules/wallet/reconciliation.js';

async function main() {
    const app = await buildApp();

    // ── Graceful shutdown ─────────────────────────────────
    const shutdown = async (signal: string) => {
        logger.info({ signal }, 'Received shutdown signal');

        try {
            stopReconciliationLoop();
            stopPoolMonitoring();
            await app.close();
            logger.info('Fastify server closed');
        } catch (err) {
            logger.error({ err }, 'Error closing Fastify');
        }

        try {
            await closeDatabasePool();
            await closePrisma();
        } catch (err) {
            logger.error({ err }, 'Error closing database connections');
        }

        process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    process.on('uncaughtException', (err) => {
        logger.fatal({ err }, 'Uncaught exception');
        process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
        logger.fatal({ reason }, 'Unhandled promise rejection');
        process.exit(1);
    });

    // ── Start server ──────────────────────────────────────
    try {
        await app.listen({ port: env.PORT, host: env.HOST });

        // Start background jobs after server is listening
        await validatePoolCapacity();
        startPoolMonitoring();
        startReconciliationLoop();

        logger.info(
            { port: env.PORT, host: env.HOST, env: env.NODE_ENV },
            '🏟️  Skill Era server started',
        );
    } catch (err) {
        logger.fatal({ err }, 'Failed to start server');
        process.exit(1);
    }
}

main();
