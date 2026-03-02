/**
 * monitoring.service.ts
 *
 * Structured event emission and in-process metrics for Skill Era.
 *
 * Design:
 *   • All financial events emit a structured pino log entry with a named
 *     event type — searchable via log aggregators (Datadog, Loki, etc).
 *   • In-memory sliding window counters for rates.
 *   • Alert thresholds checked on every emit(); logs at ERROR level with
 *     "ALERT:" prefix for automated scraping by ops tooling.
 *   • No external dependency — pure in-process for MVP.
 *     Production upgrade path: replace with Prometheus client / StatsD.
 *
 * ALERT conditions:
 *   • retry_exhausted > 3 events in 60 seconds
 *   • payout_failed rate > 5% over last 10 minutes
 *   • fraud_flag_created > 10 in 5 minutes
 *   • lock_contention_detected > 20 in 60 seconds
 *   • deposit_failed > 5 in 60 seconds (webhook verification failures)
 */

import { logger } from './logger.js';

// ── Event types ───────────────────────────────────────────────────────

export type MonitoringEvent =
    | 'deposit_confirmed'
    | 'deposit_failed'
    | 'withdrawal_requested'
    | 'payout_started'
    | 'payout_succeeded'
    | 'payout_failed'
    | 'payout_retry'
    | 'fraud_flag_created'
    | 'fraud_threshold_exceeded'
    | 'lock_contention_detected'
    | 'retry_exhausted'
    | 'totp_verification_failed'
    | 'totp_lockout_triggered'
    | 'suspicious_token_reuse';

// ── Sliding window counter ────────────────────────────────────────────

interface TimestampedEvent {
    event: MonitoringEvent;
    ts: number; // epoch ms
}

const _windowEvents: TimestampedEvent[] = [];
const _totalCounters: Map<MonitoringEvent, number> = new Map();

// Sum of latencies and count for average computation
let _latencySum = 0;
let _latencyCount = 0;

function recordEvent(event: MonitoringEvent): void {
    _windowEvents.push({ event, ts: Date.now() });
    _totalCounters.set(event, (_totalCounters.get(event) ?? 0) + 1);
}

/**
 * Count events of a given type within the last `windowMs` milliseconds.
 */
function countInWindow(event: MonitoringEvent, windowMs: number): number {
    const cutoff = Date.now() - windowMs;
    return _windowEvents.filter(e => e.event === event && e.ts >= cutoff).length;
}

function purgeOldEvents(): void {
    const cutoff = Date.now() - 10 * 60 * 1000; // keep 10 minutes
    const firstKeep = _windowEvents.findIndex(e => e.ts >= cutoff);
    if (firstKeep > 0) _windowEvents.splice(0, firstKeep);
}

// ── Alert checks ──────────────────────────────────────────────────────

function checkAlerts(event: MonitoringEvent): void {
    purgeOldEvents();

    // 1. Retry exhaustion spike
    if (event === 'retry_exhausted') {
        const count = countInWindow('retry_exhausted', 60_000);
        if (count >= 3) {
            logger.error(
                { alert: 'RETRY_EXHAUSTION_SPIKE', count, windowSeconds: 60 },
                'ALERT: retry_exhausted fired ≥3 times in 60 seconds',
            );
        }
    }

    // 2. Payout failure rate > 5% over last 10 minutes
    if (event === 'payout_failed' || event === 'payout_succeeded') {
        const succeeded = countInWindow('payout_succeeded', 10 * 60_000);
        const failed = countInWindow('payout_failed', 10 * 60_000);
        const total = succeeded + failed;
        if (total >= 10) {
            const failRate = failed / total;
            if (failRate > 0.05) {
                logger.error(
                    {
                        alert: 'PAYOUT_FAILURE_RATE_HIGH',
                        failRate: (failRate * 100).toFixed(1) + '%',
                        failed, succeeded, total,
                        windowMinutes: 10,
                    },
                    'ALERT: Payout failure rate exceeds 5% threshold',
                );
            }
        }
    }

    // 3. Fraud flag spike > 10 in 5 minutes
    if (event === 'fraud_flag_created') {
        const count = countInWindow('fraud_flag_created', 5 * 60_000);
        if (count >= 10) {
            logger.error(
                { alert: 'FRAUD_FLAG_SPIKE', count, windowMinutes: 5 },
                'ALERT: fraud_flag_created exceeded 10 events in 5 minutes',
            );
        }
    }

    // 4. Lock contention spike > 20 in 60 seconds
    if (event === 'lock_contention_detected') {
        const count = countInWindow('lock_contention_detected', 60_000);
        if (count >= 20) {
            logger.error(
                { alert: 'LOCK_CONTENTION_SPIKE', count, windowSeconds: 60 },
                'ALERT: lock_contention_detected exceeded 20 events in 60 seconds',
            );
        }
    }

    // 5. Deposit failures (webhook rejections) spike > 5 in 60 seconds
    if (event === 'deposit_failed') {
        const count = countInWindow('deposit_failed', 60_000);
        if (count >= 5) {
            logger.error(
                { alert: 'DEPOSIT_FAILURE_SPIKE', count, windowSeconds: 60 },
                'ALERT: deposit_failed exceeded 5 events in 60 seconds — possible webhook attack',
            );
        }
    }

    // 6. Suspicious token reuse alert (immediate)
    if (event === 'suspicious_token_reuse') {
        logger.error(
            { alert: 'SUSPICIOUS_TOKEN_REUSE', windowMinutes: 0 },
            'ALERT: Refresh token reuse detected! Possible session theft and token family revoked.',
        );
    }
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Emit a structured monitoring event with contextual payload.
 *
 * @param event   - Named event type
 * @param payload - Additional context (no PII, no tokens)
 * @param latencyMs - Optional latency in ms for this operation
 */
export function emit(
    event: MonitoringEvent,
    payload: Record<string, unknown> = {},
    latencyMs?: number,
): void {
    recordEvent(event);
    checkAlerts(event);

    if (latencyMs !== undefined) {
        _latencySum += latencyMs;
        _latencyCount += 1;
    }

    logger.info({ event, ...payload }, `[MONITOR] ${event}`);
}

export interface MetricsSnapshot {
    payoutSuccessCount: number;
    payoutFailureCount: number;
    payoutSuccessRate: string;
    payoutFailureRate: string;
    fraudFlagCount: number;
    fraudFlagRate_per5min: number;
    avgTransactionLatencyMs: string;
    lockContentionCount: number;
    retryExhaustionCount: number;
    depositConfirmedCount: number;
    depositFailedCount: number;
    totpLockoutCount: number;
    windowLast10min: {
        payoutSucceeded: number;
        payoutFailed: number;
        fraudFlagged: number;
        lockContention: number;
    };
}

/**
 * Return a read-only snapshot of current metrics.
 * Used by GET /internal/metrics.
 */
export function getMetrics(): MetricsSnapshot {
    purgeOldEvents();

    const succeeded = _totalCounters.get('payout_succeeded') ?? 0;
    const failed = _totalCounters.get('payout_failed') ?? 0;
    const total = succeeded + failed;

    const successRate = total > 0 ? ((succeeded / total) * 100).toFixed(2) + '%' : 'N/A';
    const failureRate = total > 0 ? ((failed / total) * 100).toFixed(2) + '%' : 'N/A';
    const avgLatency = _latencyCount > 0
        ? (_latencySum / _latencyCount).toFixed(2) + 'ms'
        : 'N/A';

    return {
        payoutSuccessCount: succeeded,
        payoutFailureCount: failed,
        payoutSuccessRate: successRate,
        payoutFailureRate: failureRate,
        fraudFlagCount: _totalCounters.get('fraud_flag_created') ?? 0,
        fraudFlagRate_per5min: countInWindow('fraud_flag_created', 5 * 60_000),
        avgTransactionLatencyMs: avgLatency,
        lockContentionCount: _totalCounters.get('lock_contention_detected') ?? 0,
        retryExhaustionCount: _totalCounters.get('retry_exhausted') ?? 0,
        depositConfirmedCount: _totalCounters.get('deposit_confirmed') ?? 0,
        depositFailedCount: _totalCounters.get('deposit_failed') ?? 0,
        totpLockoutCount: _totalCounters.get('totp_lockout_triggered') ?? 0,
        windowLast10min: {
            payoutSucceeded: countInWindow('payout_succeeded', 10 * 60_000),
            payoutFailed: countInWindow('payout_failed', 10 * 60_000),
            fraudFlagged: countInWindow('fraud_flag_created', 10 * 60_000),
            lockContention: countInWindow('lock_contention_detected', 10 * 60_000),
        },
    };
}

/**
 * Reset all counters — for testing only.
 * @internal
 */
export function _resetForTests(): void {
    _windowEvents.length = 0;
    _totalCounters.clear();
    _latencySum = 0;
    _latencyCount = 0;
}
