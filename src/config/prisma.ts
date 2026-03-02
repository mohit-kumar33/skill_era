import { PrismaClient } from '@prisma/client';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Prisma client for non-financial CRUD operations.
 * DO NOT use for wallet mutations — use raw pg pool instead.
 */
export const prisma = new PrismaClient({
    log: env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'event', level: 'error' },
            { emit: 'event', level: 'warn' },
        ]
        : [
            { emit: 'event', level: 'error' },
        ],
});

if (env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
        logger.debug({ duration: e.duration, query: e.query }, 'Prisma query');
    });
}

prisma.$on('error', (e) => {
    logger.error({ message: e.message }, 'Prisma error');
});

prisma.$on('warn', (e) => {
    logger.warn({ message: e.message }, 'Prisma warning');
});

export async function closePrisma(): Promise<void> {
    await prisma.$disconnect();
    logger.info('Prisma client disconnected');
}
