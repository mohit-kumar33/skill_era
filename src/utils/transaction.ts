import type { Pool, PoolClient } from 'pg';
import { logger } from './logger.js';
import { concurrentModification } from './errors.js';

const LOCK_NOT_AVAILABLE = '55P03';  // PostgreSQL: could not obtain lock

/**
 * Check if a PostgreSQL error is a lock-not-available error (NOWAIT).
 */
export function isLockNotAvailable(err: unknown): boolean {
    return (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === LOCK_NOT_AVAILABLE
    );
}

/**
 * Execute a function within a READ COMMITTED transaction.
 * This is the standard wrapper for all financial operations.
 * 
 * Uses READ COMMITTED + SELECT ... FOR UPDATE NOWAIT pattern:
 * - Simpler deadlock surface than SERIALIZABLE
 * - Explicit failures via NOWAIT
 * - Automatic retry with jitter on lock contention (NOWAIT failures)
 * - Max 2 retries with 20-50ms random backoff
 */
export async function runInTransaction<T>(
    pool: Pool,
    fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
    const MAX_LOCK_RETRIES = 2;

    for (let attempt = 0; attempt <= MAX_LOCK_RETRIES; attempt++) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
        } catch (err: unknown) {
            await client.query('ROLLBACK').catch((rollbackErr: unknown) => {
                logger.error({ err: rollbackErr }, 'Failed to rollback transaction');
            });

            if (isLockNotAvailable(err) && attempt < MAX_LOCK_RETRIES) {
                // Retry with small jitter — converts transient contention
                // into transparent retry instead of user-visible error
                const jitter = 20 + Math.random() * 30; // 20-50ms
                logger.debug(
                    { attempt: attempt + 1, maxRetries: MAX_LOCK_RETRIES, jitterMs: Math.round(jitter) },
                    'NOWAIT lock contention — retrying with jitter',
                );
                client.release();
                await new Promise(resolve => setTimeout(resolve, jitter));
                continue;
            }

            if (isLockNotAvailable(err)) {
                client.release();
                throw concurrentModification();
            }

            client.release();
            throw err;
        } finally {
            // Release is safe even if already released (no-op)
            client.release();
        }
    }

    // Unreachable, but TypeScript needs it
    throw concurrentModification();
}

/**
 * Execute a function within a SERIALIZABLE transaction.
 * Use sparingly — only when strict snapshot isolation is required
 * and FOR UPDATE is insufficient (e.g., phantom read prevention).
 */
export async function runInSerializableTransaction<T>(
    pool: Pool,
    fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
    const client = await pool.connect();

    try {
        await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    } catch (err: unknown) {
        await client.query('ROLLBACK').catch((rollbackErr: unknown) => {
            logger.error({ err: rollbackErr }, 'Failed to rollback serializable transaction');
        });
        throw err;
    } finally {
        client.release();
    }
}
