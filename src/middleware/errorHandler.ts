import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppError, errorResponse, ERROR_CODES } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * Global error handler for Fastify.
 * Converts all errors to standardized API responses.
 */
export function errorHandler(
    error: FastifyError,
    request: FastifyRequest,
    reply: FastifyReply,
): void {
    const requestId = request.id;

    // Known application error
    if (error instanceof AppError) {
        logger.warn(
            { requestId, errorCode: error.errorCode, message: error.message, statusCode: error.statusCode },
            'Application error',
        );
        reply.status(error.statusCode).send(errorResponse(error));
        return;
    }

    // Fastify validation error
    if (error.validation) {
        const appErr = new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            error.message,
            400,
        );
        reply.status(400).send(errorResponse(appErr));
        return;
    }

    // Rate limited
    if (error.statusCode === 429) {
        const appErr = new AppError(
            ERROR_CODES.RATE_LIMITED,
            'Too many requests. Please slow down.',
            429,
        );
        reply.status(429).send(errorResponse(appErr));
        return;
    }

    // Unknown / system error
    if (process.env.NODE_ENV === 'test') {
        console.error('DEBUG_ERROR_STACK:', error.stack);
    }
    logger.error(
        {
            requestId,
            err: error,
            url: request.url,
            method: request.method,
        },
        'Unhandled error',
    );

    const appErr = new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        'Internal server error',
        500,
        false,
    );
    reply.status(500).send(errorResponse(appErr));
}
