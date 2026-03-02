import crypto from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import {
    FRAUD_FINGERPRINT_SALT,
    MAX_ACCOUNTS_PER_DEVICE,
    GEO_CHANGE_WINDOW_MINUTES,
} from '../config/constants.js';

// ═══════════════════════════════════════════════════════════════════════
// FRAUD HARDENING — Lightweight Beta-Level Detection
// ═══════════════════════════════════════════════════════════════════════
//
// 1. Device fingerprint: hash(user-agent + IP + salt) — logged per request
// 2. Multi-account detection: if same fingerprint mapped to >3 users → bump fraudScore
// 3. Geo-change detection: if IP first-octet-group changes within 30 min → flag
//
// All checks are non-blocking (log + flag, never reject requests).
// No external dependencies or heavy ML.
// ═══════════════════════════════════════════════════════════════════════

import { getRedisClient } from '../config/redis.js';

// ── In-memory caches (lightweight fallback if Redis unavailable) ──────
// Maps fingerprint → Set<userId> for multi-account detection
const fingerprintUsersFallback = new Map<string, Set<string>>();
// Maps userId → { ipPrefix, timestamp } for geo-change detection
const lastLoginGeoFallback = new Map<string, { ipPrefix: string; timestamp: number }>();

/**
 * Compute a device fingerprint from user-agent + IP + salt.
 * Uses SHA-256 for consistent one-way hashing.
 */
export function computeDeviceFingerprint(userAgent: string, ip: string): string {
    return crypto
        .createHash('sha256')
        .update(`${userAgent}|${ip}|${FRAUD_FINGERPRINT_SALT}`)
        .digest('hex');
}

/**
 * Extract a rough geo-proxy from an IP address.
 * Uses the first two octets as a "region" approximation.
 * Full MaxMind integration is post-beta.
 */
function extractIpPrefix(ip: string): string {
    // Handle IPv4 and IPv4-mapped IPv6
    const ipv4 = ip.replace(/^::ffff:/, '');
    const parts = ipv4.split('.');
    if (parts.length >= 2) {
        return `${parts[0]}.${parts[1]}`;
    }
    // For IPv6 or unusual formats, use the whole thing
    return ip;
}

/**
 * Fastify onRequest hook for fraud fingerprint logging.
 * Runs on every /api/v1 request. Non-blocking — errors are swallowed.
 */
export async function fraudFingerprintHook(
    request: FastifyRequest,
    _reply: FastifyReply,
): Promise<void> {
    // Only track authenticated requests
    const userId = request.currentUser?.userId;
    if (!userId) return;

    try {
        const userAgent = request.headers['user-agent'] ?? 'unknown';
        const ip = request.ip;
        const fingerprint = computeDeviceFingerprint(userAgent, ip);
        const redis = getRedisClient();

        // Log the fingerprint for audit trail
        logger.debug(
            { userId, fingerprint: fingerprint.substring(0, 16), ip },
            'Fraud: device fingerprint logged',
        );

        // ── Multi-account device detection ────────────────────
        let accountCount = 0;

        if (redis?.status === 'ready') {
            const key = `fraud:fp:${fingerprint}`;
            await redis.sadd(key, userId);
            await redis.expire(key, 24 * 60 * 60); // 24 hour TTL
            accountCount = await redis.scard(key);
        } else {
            if (!fingerprintUsersFallback.has(fingerprint)) {
                fingerprintUsersFallback.set(fingerprint, new Set());
            }
            const usersOnDevice = fingerprintUsersFallback.get(fingerprint)!;
            usersOnDevice.add(userId);
            accountCount = usersOnDevice.size;
        }

        if (accountCount > MAX_ACCOUNTS_PER_DEVICE) {
            // Flag — same device used by too many accounts
            logger.warn(
                {
                    fingerprint: fingerprint.substring(0, 16),
                    accountCount,
                    userId,
                },
                'Fraud: device fingerprint exceeds multi-account threshold',
            );

            // Increment fraud score (fire-and-forget, non-blocking)
            incrementFraudScore(userId, 'device_fingerprint', 10).catch(() => { });
        }

        // ── Geo-change detection ──────────────────────────────
        const currentPrefix = extractIpPrefix(ip);
        let previousPrefix: string | null = null;
        let elapsedMinutes: number | null = null;

        if (redis?.status === 'ready') {
            const geoKey = `fraud:geo:${userId}`;
            const previousData = await redis.get(geoKey);
            if (previousData) {
                const parts = previousData.split('|');
                if (parts.length === 2) {
                    previousPrefix = parts[0] ?? null;
                    elapsedMinutes = (Date.now() - parseInt(parts[1]!, 10)) / 60_000;
                }
            }
            // Update last-seen geo in Redis
            await redis.setex(geoKey, GEO_CHANGE_WINDOW_MINUTES * 60, `${currentPrefix}|${Date.now()}`);
        } else {
            const previous = lastLoginGeoFallback.get(userId);
            if (previous) {
                previousPrefix = previous.ipPrefix;
                elapsedMinutes = (Date.now() - previous.timestamp) / 60_000;
            }
            // Update last-seen geo in fallback memory
            lastLoginGeoFallback.set(userId, { ipPrefix: currentPrefix, timestamp: Date.now() });
        }

        if (previousPrefix && elapsedMinutes !== null) {
            if (previousPrefix !== currentPrefix && elapsedMinutes <= GEO_CHANGE_WINDOW_MINUTES) {
                logger.warn(
                    {
                        userId,
                        previousPrefix,
                        currentPrefix,
                        elapsedMinutes: Math.round(elapsedMinutes),
                    },
                    'Fraud: geo-IP change detected within window',
                );

                // Fire-and-forget fraud flag
                addFraudFlag(userId, 'multi_ip', 15,
                    `IP prefix changed from ${previousPrefix} to ${currentPrefix} within ${Math.round(elapsedMinutes)} minutes`,
                ).catch(() => { });
            }
        }

        // ── Memory hygiene (only for fallback) ────────────────
        if (fingerprintUsersFallback.size > 50_000) {
            const entries = [...fingerprintUsersFallback.entries()];
            for (let i = 0; i < entries.length / 2; i++) {
                fingerprintUsersFallback.delete(entries[i]![0]);
            }
        }
        if (lastLoginGeoFallback.size > 50_000) {
            const entries = [...lastLoginGeoFallback.entries()];
            for (let i = 0; i < entries.length / 2; i++) {
                lastLoginGeoFallback.delete(entries[i]![0]);
            }
        }
    } catch (err) {
        // Fraud checks must NEVER break the request pipeline
        logger.debug({ err }, 'Fraud fingerprint hook error (non-fatal)');
    }
}

/**
 * Increment a user's fraud score. Fire-and-forget.
 */
async function incrementFraudScore(
    userId: string,
    flagType: string,
    points: number,
): Promise<void> {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: { fraudScore: { increment: points } },
        });
        logger.info({ userId, flagType, points }, 'Fraud: score incremented');
    } catch (err) {
        logger.debug({ err, userId }, 'Fraud: failed to increment score (non-fatal)');
    }
}

/**
 * Add a fraud flag record. Fire-and-forget.
 */
async function addFraudFlag(
    userId: string,
    flagType: 'multi_ip' | 'device_fingerprint' | 'deposit_withdraw_velocity',
    riskPoints: number,
    description: string,
): Promise<void> {
    try {
        await prisma.fraudFlag.create({
            data: { userId, flagType, riskPoints, description },
        });
    } catch (err) {
        logger.debug({ err, userId }, 'Fraud: failed to create flag (non-fatal)');
    }
}
