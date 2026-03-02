/**
 * Shared Redis client — single connection for rate limiting, webhook replay protection, etc.
 *
 * Falls back gracefully if Redis is unavailable (in-memory fallback for critical paths).
 */
import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

let _redis: Redis | null = null;

export function getRedisClient(): Redis | null {
    return _redis;
}

export async function connectRedis(): Promise<Redis | null> {
    if (_redis) return _redis;

    try {
        const client = new Redis(env.REDIS_URL, {
            maxRetriesPerRequest: 1,
            lazyConnect: true,
            enableReadyCheck: true,
            retryStrategy: (times: number) => {
                if (times > 3) return null; // Stop retrying after 3 attempts
                return Math.min(times * 200, 1000);
            },
        });

        await client.connect();
        logger.info('Shared Redis client connected');
        _redis = client;
        return client;
    } catch {
        logger.warn('Shared Redis unavailable — replay protection will use in-memory fallback');
        return null;
    }
}

/**
 * Check if a webhook nonce has been seen before.
 * Uses Redis SETNX with TTL for atomic deduplication.
 * Falls back to an in-memory LRU if Redis is unavailable.
 *
 * @returns `true` if the nonce is a duplicate (already processed)
 */
const inMemoryNonces = new Map<string, number>();
const IN_MEMORY_MAX_SIZE = 10_000;
const NONCE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export async function isWebhookReplay(nonce: string): Promise<boolean> {
    const redis = getRedisClient();
    const key = `webhook:nonce:${nonce}`;

    if (redis?.status === 'ready') {
        // SET key value NX EX ttl → returns 'OK' if set (first time), null if already exists
        const result = await redis.set(key, '1', 'EX', NONCE_TTL_SECONDS, 'NX');
        return result === null; // null means key already existed → replay
    }

    // In-memory fallback
    if (inMemoryNonces.has(nonce)) {
        return true; // duplicate
    }

    // Evict oldest entries if at capacity
    if (inMemoryNonces.size >= IN_MEMORY_MAX_SIZE) {
        const oldest = inMemoryNonces.keys().next().value;
        if (oldest !== undefined) {
            inMemoryNonces.delete(oldest);
        }
    }

    inMemoryNonces.set(nonce, Date.now());
    return false; // first time
}
