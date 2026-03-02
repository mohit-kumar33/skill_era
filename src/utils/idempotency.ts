import crypto from 'crypto';

/**
 * Generate a unique idempotency key.
 * Format: prefix-UUIDv4 (e.g., "dep-550e8400-e29b-41d4-a716-446655440000")
 */
export function generateIdempotencyKey(prefix: string): string {
    return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * Validate that an idempotency key matches expected format.
 */
export function isValidIdempotencyKey(key: string): boolean {
    if (!key || key.length < 5 || key.length > 255) return false;
    // Must contain only alphanumeric, hyphens, underscores
    return /^[a-zA-Z0-9_-]+$/.test(key);
}

/**
 * Check if a PostgreSQL error is a unique constraint violation (idempotency key duplicate).
 */
export function isUniqueViolation(err: unknown): boolean {
    return (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as { code: string }).code === '23505'
    );
}

/**
 * Validate UUID v4 format.
 */
export function isValidUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
