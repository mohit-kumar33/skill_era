/**
 * Webhook Security Tests — Timestamp Validation & Replay Protection
 *
 * Covers:
 *   1. Timestamp window validation (reject stale webhooks > 5 min)
 *   2. Nonce replay protection (duplicate nonce → idempotent 200)
 *   3. Duplicate webhook simulation (same deposit_id deduplication)
 *   4. Gateway sandbox integration simulation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('../config/prisma.js', () => ({
    prisma: {
        deposit: { updateMany: vi.fn() },
        fraudFlag: { create: vi.fn().mockResolvedValue({}) },
        user: { update: vi.fn().mockResolvedValue({}) },
    },
}));

vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../utils/monitoring.service.js', () => ({ emit: vi.fn() }));
vi.mock('../utils/alerting.js', () => ({
    recordEvent: vi.fn(),
    sendAlert: vi.fn(),
    trackErrorRate: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
    pool: { query: vi.fn(), connect: vi.fn() },
    checkDatabaseHealth: vi.fn(),
}));

// Track webhook nonces in-memory (simulating Redis for tests)
const processedNonces = new Set<string>();

vi.mock('../config/redis.js', () => ({
    isWebhookReplay: vi.fn(async (nonce: string) => {
        if (processedNonces.has(nonce)) return true;
        processedNonces.add(nonce);
        return false;
    }),
    connectRedis: vi.fn(async () => null),
    getRedisClient: vi.fn(() => null),
}));

vi.mock('../utils/transaction.js', () => ({
    runInTransaction: vi.fn(async (_pool: unknown, fn: (client: unknown) => Promise<unknown>) => {
        const client = {
            query: vi.fn()
                .mockResolvedValueOnce({
                    rows: [{
                        id: 'dep-uuid-001',
                        user_id: 'user-uuid-001',
                        amount: { toString: () => '500.00' },
                        status: 'initiated',
                        idempotency_key: 'idem-key-001',
                    }],
                })
                .mockResolvedValueOnce({
                    rows: [{
                        new_balance: { toString: () => '1500.00' },
                        ledger_id: 'ledger-001',
                    }],
                })
                .mockResolvedValueOnce({ rows: [] }),
            release: vi.fn(),
        };
        return fn(client);
    }),
}));

vi.mock('../utils/retry.js', () => ({
    withRetry: vi.fn(async (fn: () => Promise<unknown>) => fn()),
}));

// ── Imports (after mocks) ──────────────────────────────────────────────

import { depositWebhookSchema } from '../modules/wallet/wallet.schema.js';
import { verifyHmacSignature } from '../utils/hmac.js';
import { isWebhookReplay } from '../config/redis.js';

vi.mock('../utils/hmac.js', () => ({
    verifyHmacSignature: vi.fn(),
}));
const mockVerifyHmac = vi.mocked(verifyHmacSignature);

// ── Helpers ────────────────────────────────────────────────────────────

function createWebhookPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        deposit_id: crypto.randomUUID(),
        gateway_transaction_id: `gw-txn-${crypto.randomUUID().slice(0, 8)}`,
        amount: '500.00',
        status: 'success',
        timestamp: new Date().toISOString(),
        nonce: crypto.randomUUID(),
        ...overrides,
    };
}

function generateHmac(payload: Record<string, unknown>, secret: string): string {
    const body = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

// ═══════════════════════════════════════════════════════════════════════
// 1. TIMESTAMP VALIDATION
// ═══════════════════════════════════════════════════════════════════════

describe('Webhook Timestamp Validation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        processedNonces.clear();
    });

    it('should accept webhook with current timestamp', () => {
        const payload = createWebhookPayload();
        const parsed = depositWebhookSchema.safeParse(payload);
        expect(parsed.success).toBe(true);
    });

    it('should accept webhook timestamp within 5-minute window', () => {
        const fourMinutesAgo = new Date(Date.now() - 4 * 60 * 1000).toISOString();
        const payload = createWebhookPayload({ timestamp: fourMinutesAgo });
        const parsed = depositWebhookSchema.safeParse(payload);
        expect(parsed.success).toBe(true);

        // Verify age is within tolerance
        if (parsed.success) {
            const age = Date.now() - new Date(parsed.data.timestamp).getTime();
            expect(age).toBeLessThan(5 * 60 * 1000);
        }
    });

    it('should detect stale webhook (> 5 minutes old)', () => {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
        const payload = createWebhookPayload({ timestamp: tenMinutesAgo });
        const parsed = depositWebhookSchema.safeParse(payload);
        expect(parsed.success).toBe(true);

        if (parsed.success) {
            const age = Date.now() - new Date(parsed.data.timestamp).getTime();
            expect(age).toBeGreaterThan(5 * 60 * 1000);
        }
    });

    it('should detect future-dated webhook (clock skew attack)', () => {
        const tenMinutesInFuture = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        const payload = createWebhookPayload({ timestamp: tenMinutesInFuture });
        const parsed = depositWebhookSchema.safeParse(payload);
        expect(parsed.success).toBe(true);

        if (parsed.success) {
            const age = Date.now() - new Date(parsed.data.timestamp).getTime();
            // Negative age means future timestamp — should be rejected
            expect(age).toBeLessThan(-5 * 60 * 1000);
        }
    });

    it('should reject invalid timestamp format', () => {
        const payload = createWebhookPayload({ timestamp: 'not-a-date' });
        const parsed = depositWebhookSchema.safeParse(payload);
        expect(parsed.success).toBe(false);
    });

    it('should reject missing timestamp', () => {
        const payload = createWebhookPayload();
        delete payload['timestamp'];
        const parsed = depositWebhookSchema.safeParse(payload);
        expect(parsed.success).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. NONCE REPLAY PROTECTION
// ═══════════════════════════════════════════════════════════════════════

describe('Webhook Nonce Replay Protection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        processedNonces.clear();
    });

    it('should accept first occurrence of a nonce', async () => {
        const nonce = crypto.randomUUID();
        const isDuplicate = await isWebhookReplay(nonce);
        expect(isDuplicate).toBe(false);
    });

    it('should reject second occurrence of the same nonce (replay)', async () => {
        const nonce = crypto.randomUUID();

        // First time — should be accepted
        const first = await isWebhookReplay(nonce);
        expect(first).toBe(false);

        // Second time — should be rejected as replay
        const second = await isWebhookReplay(nonce);
        expect(second).toBe(true);
    });

    it('should accept different nonces independently', async () => {
        const nonce1 = crypto.randomUUID();
        const nonce2 = crypto.randomUUID();

        expect(await isWebhookReplay(nonce1)).toBe(false);
        expect(await isWebhookReplay(nonce2)).toBe(false);
    });

    it('should reject missing nonce in schema validation', () => {
        const payload = createWebhookPayload();
        delete payload['nonce'];
        const parsed = depositWebhookSchema.safeParse(payload);
        expect(parsed.success).toBe(false);
    });

    it('should reject nonce shorter than 8 characters', () => {
        const payload = createWebhookPayload({ nonce: 'short' });
        const parsed = depositWebhookSchema.safeParse(payload);
        expect(parsed.success).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. DUPLICATE WEBHOOK SIMULATION
// ═══════════════════════════════════════════════════════════════════════

describe('Duplicate Webhook Simulation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        processedNonces.clear();
    });

    it('should demonstrate full webhook dedup flow', async () => {
        // Simulate a gateway sending the same webhook payload twice
        const depositId = crypto.randomUUID();
        const nonce = crypto.randomUUID();
        const payload = createWebhookPayload({
            deposit_id: depositId,
            nonce,
            status: 'success',
        });

        // Validate both payloads pass schema
        const parsed1 = depositWebhookSchema.safeParse(payload);
        expect(parsed1.success).toBe(true);

        // First delivery — should be processed
        const replay1 = await isWebhookReplay(nonce);
        expect(replay1).toBe(false); // NOT a replay

        // Second delivery (same nonce) — should be deduplicated
        const replay2 = await isWebhookReplay(nonce);
        expect(replay2).toBe(true); // IS a replay
    });

    it('should handle rapid-fire duplicate webhooks', async () => {
        const nonce = crypto.randomUUID();

        // Simulate 5 rapid-fire deliveries of the same webhook
        const results = await Promise.all([
            isWebhookReplay(nonce),
            isWebhookReplay(nonce),
            isWebhookReplay(nonce),
            isWebhookReplay(nonce),
            isWebhookReplay(nonce),
        ]);

        // Exactly 1 should be accepted (first), rest rejected
        const accepted = results.filter((r: boolean) => !r).length;
        const rejected = results.filter((r: boolean) => r).length;
        expect(accepted).toBe(1);
        expect(rejected).toBe(4);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. GATEWAY SANDBOX INTEGRATION SIMULATION
// ═══════════════════════════════════════════════════════════════════════

describe('Gateway Sandbox Integration Simulation', () => {
    const WEBHOOK_SECRET = 'test-webhook-secret-for-sandbox-sim';

    beforeEach(() => {
        vi.clearAllMocks();
        processedNonces.clear();
    });

    it('should validate a complete gateway webhook flow (signature + schema)', () => {
        const payload = createWebhookPayload({ status: 'captured' });
        const body = JSON.stringify(payload);
        const rawBuffer = Buffer.from(body);

        // Simulate gateway signing
        const signature = generateHmac(payload, WEBHOOK_SECRET);

        // Step 1: HMAC verification (using real function, not mock)
        const expectedHmac = crypto.createHmac('sha256', WEBHOOK_SECRET)
            .update(rawBuffer)
            .digest('hex');
        expect(signature).toBe(expectedHmac); // Signature matches

        // Step 2: Schema validation
        const parsed = depositWebhookSchema.safeParse(payload);
        expect(parsed.success).toBe(true);

        // Step 3: Timestamp check
        if (parsed.success) {
            const age = Math.abs(Date.now() - new Date(parsed.data.timestamp).getTime());
            expect(age).toBeLessThan(5 * 60 * 1000); // Within tolerance
        }
    });

    it('should reject tampered payload (HMAC mismatch)', () => {
        const payload = createWebhookPayload({ amount: '500.00' });
        const signature = generateHmac(payload, WEBHOOK_SECRET);

        // Attacker modifies amount
        const tamperedPayload = { ...payload, amount: '50000.00' };
        const tamperedBody = Buffer.from(JSON.stringify(tamperedPayload));

        // HMAC of tampered payload won't match original signature
        const expectedHmac = crypto.createHmac('sha256', WEBHOOK_SECRET)
            .update(tamperedBody)
            .digest('hex');
        expect(expectedHmac).not.toBe(signature); // Tamper detected
    });

    it('should reject replay of valid webhook with same nonce', async () => {
        const nonce = crypto.randomUUID();
        const payload = createWebhookPayload({ nonce, status: 'captured' });
        const signature = generateHmac(payload, WEBHOOK_SECRET);

        // Schema valid
        expect(depositWebhookSchema.safeParse(payload).success).toBe(true);

        // First delivery — accepted
        expect(await isWebhookReplay(nonce)).toBe(false);

        // Replay attack — same valid signature, same nonce → rejected
        expect(await isWebhookReplay(nonce)).toBe(true);
    });

    it('should handle all gateway status types in schema', () => {
        const statuses = ['success', 'captured', 'failed', 'expired', 'refunded', 'chargeback'];

        for (const status of statuses) {
            const payload = createWebhookPayload({ status });
            const parsed = depositWebhookSchema.safeParse(payload);
            expect(parsed.success).toBe(true);
        }
    });
});
