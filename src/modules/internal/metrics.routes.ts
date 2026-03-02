import type { FastifyInstance } from 'fastify';
import { getMetrics } from '../../utils/monitoring.service.js';
import { successResponse } from '../../utils/errors.js';

/**
 * Internal metrics endpoint.
 *
 * GET /internal/metrics
 *
 * Returns real-time operational metrics:
 *   - payoutSuccessRate / payoutFailureRate
 *   - fraudFlagRate_per5min
 *   - avgTransactionLatencyMs
 *   - lockContentionCount
 *   - windowLast10min breakdown
 *
 * ⚠️  SECURITY: This endpoint must be firewall-restricted in production.
 *     Never expose to the public internet — restrict to VPN / internal network.
 *     No auth middleware is intentionally applied here; network-level
 *     restriction is the security layer.
 */
export async function metricsRoutes(app: FastifyInstance): Promise<void> {
    app.get('/metrics', async (_request, reply) => {
        const metrics = getMetrics();
        return reply.status(200).send(successResponse(metrics, 'Metrics snapshot'));
    });
}
