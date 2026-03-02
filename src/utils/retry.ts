import { logger } from './logger.js';

const SERIALIZATION_FAILURE = '40001';
const DEADLOCK_DETECTED = '40P01';

// ── Retryable error checks ────────────────────────────────────────────

export function isRetryableDbError(err: unknown): boolean {
    if (typeof err !== 'object' || err === null || !('code' in err)) return false;
    const code = (err as { code: string }).code;
    return code === SERIALIZATION_FAILURE || code === DEADLOCK_DETECTED;
}

export function isNetworkRetryable(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const msg = err.message.toLowerCase();
    // Retry on connection errors / timeouts — NOT on 4xx-style rejections
    return (
        msg.includes('timeout') ||
        msg.includes('econnrefused') ||
        msg.includes('econnreset') ||
        msg.includes('socket hang up') ||
        msg.includes('network error')
    );
}

// ═══════════════════════════════════════════════════════════════════════
// DATABASE RETRY — for serialization failures / deadlocks
// ═══════════════════════════════════════════════════════════════════════

/**
 * Retry a function on PostgreSQL serialization failure or deadlock
 * with exponential backoff + jitter.
 *
 * Financial Safety: Do NOT pass gateway calls through this.
 * Use withGatewayRetry() for external I/O.
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 50,
): Promise<T> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err: unknown) {
            lastError = err;

            if (isRetryableDbError(err) && attempt < maxRetries) {
                const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * baseDelayMs;
                logger.warn(
                    { attempt, maxRetries, delay: Math.round(delay) },
                    'Retryable DB error, backing off',
                );
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            break;
        }
    }

    throw lastError;
}

// ═══════════════════════════════════════════════════════════════════════
// GATEWAY RETRY — for external payment API calls
// ═══════════════════════════════════════════════════════════════════════
//
// Financial Safety Guarantees:
//   • Timeout: Each attempt is wrapped in a 5-second AbortController signal.
//   • Idempotency: The caller passes idempotencyKey to the gateway so that
//     if we retry after a timeout, the gateway will not double-charge.
//   • Only network-level errors are retried. Gateway business rejections
//     (4xx equivalents — invalid account, blocked, etc.) are NOT retried.
//   • Max 3 attempts with exponential backoff: 0ms, 1s, 2s.
// ═══════════════════════════════════════════════════════════════════════

const GATEWAY_TIMEOUT_MS = 5_000;

/**
 * Wrap a gateway call with:
 *   - 5-second timeout (AbortController)
 *   - Exponential backoff retry (max 3 attempts)
 *   - Retry only on network errors, NOT on business rejections
 */
export async function withGatewayRetry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = 3,
): Promise<T> {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), GATEWAY_TIMEOUT_MS);

        try {
            // Race the fn() against an abort-based timeout
            const result = await Promise.race([
                fn(),
                new Promise<never>((_, reject) => {
                    controller.signal.addEventListener('abort', () => {
                        reject(new Error(`Gateway timeout after ${GATEWAY_TIMEOUT_MS}ms`));
                    });
                }),
            ]);
            clearTimeout(timer);
            return result;
        } catch (err: unknown) {
            clearTimeout(timer);
            lastError = err;

            const shouldRetry = isNetworkRetryable(err) || isAbortError(err);

            if (shouldRetry && attempt < maxAttempts) {
                // Exponential backoff: 1s, 2s between retries
                const delay = 1000 * Math.pow(2, attempt - 1);
                logger.warn(
                    { attempt, maxAttempts, delay, error: (err as Error).message },
                    'Gateway call failed — retrying with backoff',
                );
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            // Non-retryable or exhausted — propagate immediately
            break;
        }
    }

    throw lastError;
}

function isAbortError(err: unknown): boolean {
    return err instanceof Error && err.message.includes('timeout');
}
