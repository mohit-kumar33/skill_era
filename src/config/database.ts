import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';
import { recordEvent, sendAlert } from '../utils/alerting.js';

const { Pool } = pg;

// ═══════════════════════════════════════════════════════════════════════
// DATABASE POOL
// ═══════════════════════════════════════════════════════════════════════

/**
 * Raw pg Pool for financial operations.
 * Used with READ COMMITTED + SELECT ... FOR UPDATE NOWAIT.
 * Prisma is NOT used for financial mutations.
 */
export const pool = new Pool({
    connectionString: env.DATABASE_URL.split('?')[0],
    min: env.DB_POOL_MIN,
    max: env.DB_POOL_MAX,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 5_000,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on('error', (err) => {
    logger.fatal({ err }, 'Unexpected database pool error');
});

pool.on('connect', () => {
    logger.debug('New database connection established');
});

export async function checkDatabaseHealth(): Promise<boolean> {
    try {
        const client = await pool.connect();
        try {
            await client.query('SELECT 1');
            return true;
        } finally {
            client.release();
        }
    } catch {
        return false;
    }
}

export async function closeDatabasePool(): Promise<void> {
    await pool.end();
    logger.info('Database pool closed');
}

// ═══════════════════════════════════════════════════════════════════════
// POOL MONITORING & BACKPRESSURE
// ═══════════════════════════════════════════════════════════════════════

let monitoringInterval: ReturnType<typeof setInterval> | null = null;
const POOL_WARNING_THRESHOLD = 0.80;  // 80% usage → warn
const POOL_ALERT_THRESHOLD = 0.90;    // 90% usage → alert
const POOL_BACKPRESSURE_WAITING = 20; // 503 when waiting > 20

/**
 * Check if pool is overloaded. Use before financial operations.
 * Returns true if the system should reject new requests (503).
 */
export function isPoolOverloaded(): boolean {
    return pool.waitingCount > POOL_BACKPRESSURE_WAITING;
}

/**
 * Start periodic pool stats monitoring (every 60s).
 */
export function startPoolMonitoring(): void {
    if (monitoringInterval) return;

    monitoringInterval = setInterval(() => {
        const total = pool.totalCount;
        const idle = pool.idleCount;
        const waiting = pool.waitingCount;
        const active = total - idle;
        const usage = total > 0 ? active / env.DB_POOL_MAX : 0;

        logger.info(
            { active, idle, waiting, total, maxPool: env.DB_POOL_MAX, usage: `${(usage * 100).toFixed(1)}%` },
            'Pool stats',
        );

        if (usage >= POOL_ALERT_THRESHOLD) {
            recordEvent('pool_exhaustion');
        } else if (usage >= POOL_WARNING_THRESHOLD) {
            logger.warn(
                { active, idle, waiting, total },
                'Pool usage above 80% warning threshold',
            );
        }

        if (waiting > POOL_BACKPRESSURE_WAITING) {
            sendAlert(
                '🔴 DB Pool Backpressure Active',
                `waitingCount=${waiting} exceeds threshold of ${POOL_BACKPRESSURE_WAITING}. New financial requests will receive 503.`,
            );
        }
    }, 60_000);

    logger.info('Pool monitoring started (60s interval)');
}

/**
 * Stop pool monitoring on shutdown.
 */
export function stopPoolMonitoring(): void {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        logger.info('Pool monitoring stopped');
    }
}

/**
 * Validate DB capacity on startup.
 * Compares required connections (instances * pool_max + buffer)
 * against PostgreSQL max_connections.
 */
export async function validatePoolCapacity(): Promise<void> {
    try {
        const client = await pool.connect();
        try {
            const result = await client.query('SHOW max_connections');
            const maxConnections = parseInt(result.rows[0]?.max_connections ?? '100', 10);
            const required = env.INSTANCE_COUNT * env.DB_POOL_MAX + 10; // +10 buffer for admin/superuser

            logger.info(
                { maxConnections, required, instanceCount: env.INSTANCE_COUNT, poolMax: env.DB_POOL_MAX },
                'DB capacity check',
            );

            if (required > maxConnections) {
                logger.error(
                    { maxConnections, required },
                    '🔴 CRITICAL: DB max_connections is insufficient for the configured pool. Increase max_connections or reduce INSTANCE_COUNT / DB_POOL_MAX.',
                );
                await sendAlert(
                    '🔴 DB Capacity Insufficient',
                    `Required=${required} but max_connections=${maxConnections}. Risk of connection failures under load.`,
                );
            }
        } finally {
            client.release();
        }
    } catch (err) {
        logger.warn({ err }, 'Could not validate DB pool capacity');
    }
}

