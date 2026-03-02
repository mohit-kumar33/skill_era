/**
 * Application error handling.
 * Standardized error codes and error class for consistent API responses.
 */

export const ERROR_CODES = {
    // Financial
    INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
    COOLDOWN_ACTIVE: 'COOLDOWN_ACTIVE',
    LIQUIDITY_LOW: 'LIQUIDITY_LOW',
    DUPLICATE_REQUEST: 'DUPLICATE_REQUEST',

    // Auth & Access
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',

    // Validation
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_SIGNATURE: 'INVALID_SIGNATURE',

    // Compliance
    KYC_REQUIRED: 'KYC_REQUIRED',
    ACCOUNT_FROZEN: 'ACCOUNT_FROZEN',
    FRAUD_DETECTED: 'FRAUD_DETECTED',
    GEO_BLOCKED: 'GEO_BLOCKED',
    AGE_VERIFICATION_REQUIRED: 'AGE_VERIFICATION_REQUIRED',

    // Rate limiting
    RATE_LIMITED: 'RATE_LIMITED',

    // Concurrency
    CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION',
    PAYOUT_ALREADY_PROCESSED: 'PAYOUT_ALREADY_PROCESSED',
    PAYOUT_IN_FLIGHT: 'PAYOUT_IN_FLIGHT',
    INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',

    // Auth
    TWO_FACTOR_REQUIRED: 'TWO_FACTOR_REQUIRED',

    // System
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly errorCode: ErrorCode;
    public readonly isOperational: boolean;

    constructor(
        errorCode: ErrorCode,
        message: string,
        statusCode: number = 400,
        isOperational: boolean = true,
    ) {
        super(message);
        this.name = 'AppError';
        this.errorCode = errorCode;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

// ── Common error factories ────────────────────────────

export function insufficientBalance(detail?: string): AppError {
    return new AppError(ERROR_CODES.INSUFFICIENT_BALANCE, detail ?? 'Insufficient balance', 400);
}

export function kycRequired(): AppError {
    return new AppError(ERROR_CODES.KYC_REQUIRED, 'KYC verification required before withdrawal', 403);
}

export function cooldownActive(): AppError {
    return new AppError(ERROR_CODES.COOLDOWN_ACTIVE, 'Withdrawal blocked: 24-hour cooldown after deposit', 400);
}

export function accountFrozen(): AppError {
    return new AppError(ERROR_CODES.ACCOUNT_FROZEN, 'Account is frozen due to security review', 403);
}

export function duplicateRequest(): AppError {
    return new AppError(ERROR_CODES.DUPLICATE_REQUEST, 'Duplicate request detected', 409);
}

export function unauthorized(detail?: string): AppError {
    return new AppError(ERROR_CODES.UNAUTHORIZED, detail ?? 'Unauthorized', 401);
}

export function forbidden(detail?: string): AppError {
    return new AppError(ERROR_CODES.FORBIDDEN, detail ?? 'Forbidden', 403);
}

export function notFound(resource: string): AppError {
    return new AppError(ERROR_CODES.NOT_FOUND, `${resource} not found`, 404);
}

export function concurrentModification(): AppError {
    return new AppError(ERROR_CODES.CONCURRENT_MODIFICATION, 'Resource is being modified by another request. Please retry.', 409);
}

export function validationError(detail: string): AppError {
    return new AppError(ERROR_CODES.VALIDATION_ERROR, detail, 400);
}

export function payoutAlreadyProcessed(withdrawalId: string): AppError {
    return new AppError(
        ERROR_CODES.PAYOUT_ALREADY_PROCESSED,
        `Withdrawal ${withdrawalId} has already been paid. No further action needed.`,
        409,
    );
}

export function payoutInFlight(): AppError {
    return new AppError(
        ERROR_CODES.PAYOUT_IN_FLIGHT,
        'This withdrawal is already being processed. Please wait and retry.',
        409,
    );
}

export function invalidStateTransition(from: string, to: string): AppError {
    return new AppError(
        ERROR_CODES.INVALID_STATE_TRANSITION,
        `Cannot transition withdrawal from '${from}' to '${to}'.`,
        409,
    );
}

export function twoFactorRequired(): AppError {
    return new AppError(
        ERROR_CODES.TWO_FACTOR_REQUIRED,
        'This action requires 2FA verification. Provide a valid TOTP token in the X-2FA-Token header.',
        401,
    );
}

/**
 * Standard API response format
 */
export interface ApiResponse<T = unknown> {
    success: boolean;
    message: string;
    data: T | null;
    error_code?: ErrorCode;
}

export function successResponse<T>(data: T, message: string = 'Success'): ApiResponse<T> {
    return { success: true, message, data };
}

export function errorResponse(error: AppError): ApiResponse<null> {
    return {
        success: false,
        message: error.message,
        data: null,
        error_code: error.errorCode,
    };
}
