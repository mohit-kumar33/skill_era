import crypto from 'crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Request ID middleware.
 * Generates a unique X-Request-Id for each request if not provided.
 * Attaches it to the response headers for tracing.
 */
export async function requestIdHook(
    request: FastifyRequest,
    reply: FastifyReply,
): Promise<void> {
    const existingId = request.headers['x-request-id'];
    const requestId = typeof existingId === 'string' && existingId.length > 0
        ? existingId
        : crypto.randomUUID();

    // Fastify uses request.id internally
    (request as { id: string }).id = requestId;
    reply.header('X-Request-Id', requestId);
}
