import { logger } from './logger.js';
import { env } from '../config/env.js';

// ═══════════════════════════════════════════════════════════════════════
// ALERTING — Sliding-Window Counters + Slack Webhook
// ═══════════════════════════════════════════════════════════════════════
//
// Lightweight alerting for beta:
//   • Sliding-window counters for key failure signals
//   • Slack webhook integration (optional — falls back to log)
//   • Thresholds:
//       >5 withdrawal failures in 5 min
//       >5 deposit mismatches in 5 min
//       >20% 5xx rate in 1 min (sampled per 100 requests)
//       DB pool usage >90%
// ═══════════════════════════════════════════════════════════════════════

interface AlertCounter {
    timestamps: number[];
    windowMs: number;
    threshold: number;
    lastAlertAt: number;
    cooldownMs: number; // Prevent alert spam
}

const counters: Record<string, AlertCounter> = {
    withdrawal_failure: {
        timestamps: [],
        windowMs: 5 * 60 * 1000,    // 5 minutes
        threshold: 5,
        lastAlertAt: 0,
        cooldownMs: 10 * 60 * 1000, // 10 min cooldown between alerts
    },
    deposit_mismatch: {
        timestamps: [],
        windowMs: 5 * 60 * 1000,
        threshold: 5,
        lastAlertAt: 0,
        cooldownMs: 10 * 60 * 1000,
    },
    pool_exhaustion: {
        timestamps: [],
        windowMs: 60 * 1000,
        threshold: 1,
        lastAlertAt: 0,
        cooldownMs: 5 * 60 * 1000,
    },
};

// 5xx rate tracking
let requestCount = 0;
let errorCount = 0;
let lastRateResetAt = Date.now();
const RATE_WINDOW_MS = 60 * 1000;
const ERROR_RATE_THRESHOLD = 0.20; // 20%
let lastErrorRateAlertAt = 0;
const ERROR_RATE_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * Track a 5xx error for rate calculation.
 * Call from onResponse hook for all 5xx responses.
 */
export function trackErrorRate(): void {
    const now = Date.now();
    if (now - lastRateResetAt > RATE_WINDOW_MS) {
        requestCount = 0;
        errorCount = 0;
        lastRateResetAt = now;
    }
    errorCount++;
    requestCount++;

    // Only evaluate after minimum sample size
    if (requestCount >= 10) {
        const rate = errorCount / requestCount;
        if (rate > ERROR_RATE_THRESHOLD && now - lastErrorRateAlertAt > ERROR_RATE_COOLDOWN_MS) {
            lastErrorRateAlertAt = now;
            sendAlert(
                '🔴 High 5xx Error Rate',
                `5xx rate: ${(rate * 100).toFixed(1)}% (${errorCount}/${requestCount} in last minute)`,
            );
        }
    }
}

/**
 * Increment a named counter and check threshold.
 */
export function recordEvent(name: string): void {
    const counter = counters[name];
    if (!counter) return;

    const now = Date.now();
    counter.timestamps.push(now);

    // Trim old timestamps outside window
    counter.timestamps = counter.timestamps.filter(t => now - t <= counter.windowMs);

    if (counter.timestamps.length >= counter.threshold && now - counter.lastAlertAt > counter.cooldownMs) {
        counter.lastAlertAt = now;

        const windowMin = Math.round(counter.windowMs / 60000);
        sendAlert(
            `🔴 ${name.replace(/_/g, ' ').toUpperCase()} Alert`,
            `${counter.timestamps.length} events in ${windowMin} minute(s) (threshold: ${counter.threshold})`,
        );
    }
}

/**
 * Send alert via Slack webhook (if configured) or structured log.
 */
export async function sendAlert(title: string, message: string): Promise<void> {
    const payload = {
        timestamp: new Date().toISOString(),
        title,
        message,
        environment: env.NODE_ENV,
    };

    // Always log
    logger.error(payload, `ALERT: ${title}`);

    // Slack webhook (fire-and-forget)
    const webhookUrl = env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
        try {
            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `*${title}* — ${env.NODE_ENV}\n${message}\n_${payload.timestamp}_`,
                }),
                signal: AbortSignal.timeout(5000),
            });
        } catch (err) {
            logger.warn({ err }, 'Failed to send Slack alert — falling back to log only');
        }
    }
}
