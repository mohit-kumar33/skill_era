/**
 * monitoring.test.ts
 *
 * Tests for the structured monitoring service:
 *   - Event emission increments counters
 *   - Alert thresholds fire correctly
 *   - getMetrics() returns accurate rates
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emit, getMetrics, _resetForTests } from '../utils/monitoring.service.js';
import { logger } from '../utils/logger.js';

// Mock pino logger to capture calls
vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('monitoring.service.ts', () => {
    beforeEach(() => {
        _resetForTests();
        vi.clearAllMocks();
    });

    describe('emit() — counter increments', () => {
        it('increments payout_succeeded counter', () => {
            emit('payout_succeeded');
            const metrics = getMetrics();
            expect(metrics.payoutSuccessCount).toBe(1);
        });

        it('increments payout_failed counter', () => {
            emit('payout_failed', { reason: 'gateway_timeout' });
            const metrics = getMetrics();
            expect(metrics.payoutFailureCount).toBe(1);
        });

        it('increments fraud_flag_created counter', () => {
            emit('fraud_flag_created', { userId: 'u1' });
            const metrics = getMetrics();
            expect(metrics.fraudFlagCount).toBe(1);
        });

        it('logs a structured event for every emit', () => {
            emit('deposit_confirmed', { depositId: 'd1' });
            expect(logger.info).toHaveBeenCalledWith(
                expect.objectContaining({ event: 'deposit_confirmed', depositId: 'd1' }),
                expect.stringContaining('deposit_confirmed'),
            );
        });
    });

    describe('getMetrics() — rate calculation', () => {
        it('reports N/A when no payout events', () => {
            const m = getMetrics();
            expect(m.payoutSuccessRate).toBe('N/A');
            expect(m.payoutFailureRate).toBe('N/A');
        });

        it('calculates 100% success rate when all payouts succeed', () => {
            emit('payout_succeeded');
            emit('payout_succeeded');
            const m = getMetrics();
            expect(m.payoutSuccessRate).toBe('100.00%');
            expect(m.payoutFailureRate).toBe('0.00%');
        });

        it('calculates 50% failure rate on mixed events', () => {
            emit('payout_succeeded');
            emit('payout_failed');
            const m = getMetrics();
            expect(m.payoutSuccessRate).toBe('50.00%');
            expect(m.payoutFailureRate).toBe('50.00%');
        });

        it('tracks latency average correctly', () => {
            emit('payout_succeeded', {}, 100);
            emit('payout_succeeded', {}, 200);
            const m = getMetrics();
            expect(m.avgTransactionLatencyMs).toBe('150.00ms');
        });
    });

    describe('Alert thresholds', () => {
        it('fires RETRY_EXHAUSTION_SPIKE alert after 3 retry_exhausted events', () => {
            emit('retry_exhausted');
            emit('retry_exhausted');
            expect(logger.error).not.toHaveBeenCalled();
            emit('retry_exhausted'); // 3rd triggers alert
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({ alert: 'RETRY_EXHAUSTION_SPIKE' }),
                expect.stringContaining('ALERT'),
            );
        });

        it('fires FRAUD_FLAG_SPIKE alert after 10 fraud flags', () => {
            for (let i = 0; i < 9; i++) emit('fraud_flag_created');
            expect(logger.error).not.toHaveBeenCalled();
            emit('fraud_flag_created'); // 10th triggers
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({ alert: 'FRAUD_FLAG_SPIKE' }),
                expect.stringContaining('ALERT'),
            );
        });

        it('fires DEPOSIT_FAILURE_SPIKE alert after 5 deposit_failed events', () => {
            for (let i = 0; i < 4; i++) emit('deposit_failed');
            expect(logger.error).not.toHaveBeenCalled();
            emit('deposit_failed'); // 5th triggers
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({ alert: 'DEPOSIT_FAILURE_SPIKE' }),
                expect.stringContaining('ALERT'),
            );
        });

        it('fires PAYOUT_FAILURE_RATE_HIGH alert when fail rate > 5% with ≥10 total', () => {
            // 1 fail + 9 success = 10% failure rate
            emit('payout_failed');
            for (let i = 0; i < 9; i++) emit('payout_succeeded');
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({ alert: 'PAYOUT_FAILURE_RATE_HIGH' }),
                expect.stringContaining('ALERT'),
            );
        });
    });

    describe('windowLast10min breakdown', () => {
        it('shows correct window counts', () => {
            emit('payout_succeeded');
            emit('payout_failed');
            emit('fraud_flag_created');
            emit('lock_contention_detected');
            const m = getMetrics();
            expect(m.windowLast10min.payoutSucceeded).toBe(1);
            expect(m.windowLast10min.payoutFailed).toBe(1);
            expect(m.windowLast10min.fraudFlagged).toBe(1);
            expect(m.windowLast10min.lockContention).toBe(1);
        });
    });
});
