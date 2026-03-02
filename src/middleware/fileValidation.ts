import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { AppError, ERROR_CODES } from '../utils/errors.js';

// ═══════════════════════════════════════════════════════════════════════
// FILE UPLOAD VALIDATION MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════
//
// Server-side validation for uploaded files (screenshots, KYC docs):
//   1. Magic byte verification (not MIME-based — tamper-proof)
//   2. 5MB max size enforcement
//   3. EXIF metadata stripping (requires `sharp` at call site)
//   4. Signed URL generation for private bucket retrieval
//
// Accepted formats:
//   JPEG: FF D8 FF
//   PNG:  89 50 4E 47 0D 0A 1A 0A
// ═══════════════════════════════════════════════════════════════════════

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// Magic byte signatures
const MAGIC_BYTES: { mime: string; bytes: number[] }[] = [
    { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
    { mime: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
];

/**
 * Detect file type from magic bytes.
 * Returns the MIME type or null if unrecognized.
 */
export function detectMimeFromBytes(buffer: Buffer): string | null {
    for (const { mime, bytes } of MAGIC_BYTES) {
        if (buffer.length >= bytes.length) {
            const matches = bytes.every((b, i) => buffer[i] === b);
            if (matches) return mime;
        }
    }
    return null;
}

/**
 * Validate an uploaded file buffer.
 * Throws AppError if validation fails.
 */
export function validateFileUpload(
    buffer: Buffer,
    originalName: string,
): { mime: string } {
    // Size check
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
        throw new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            `File too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB exceeds 5MB limit`,
            413,
        );
    }

    if (buffer.length === 0) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'File is empty', 400);
    }

    // Magic byte validation (not MIME header — tamper-proof)
    const detectedMime = detectMimeFromBytes(buffer);
    if (!detectedMime) {
        logger.warn(
            {
                originalName,
                firstBytes: buffer.subarray(0, 16).toString('hex'),
            },
            'File rejected: unrecognized magic bytes',
        );
        throw new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            'File type not allowed. Only JPEG and PNG images are accepted.',
            415,
        );
    }

    return { mime: detectedMime };
}

/**
 * Generate a signed URL for private file retrieval.
 * Uses HMAC-SHA256 with expiry timestamp.
 *
 * @param filePath - Internal storage path (e.g., "uploads/kyc/abc123.jpg")
 * @param secret - HMAC signing secret (use ENCRYPTION_KEY or dedicated signing key)
 * @param expiryMinutes - URL validity duration (default: 5 minutes)
 * @returns Signed URL query string: ?token=...&expires=...
 */
export function generateSignedUrl(
    filePath: string,
    secret: string,
    expiryMinutes: number = 5,
): string {
    const expires = Math.floor(Date.now() / 1000) + expiryMinutes * 60;
    const payload = `${filePath}:${expires}`;

    const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

    return `?token=${signature}&expires=${expires}&path=${encodeURIComponent(filePath)}`;
}

/**
 * Verify a signed URL token.
 */
export function verifySignedUrl(
    filePath: string,
    token: string,
    expires: number,
    secret: string,
): boolean {
    // Check expiry
    if (Math.floor(Date.now() / 1000) > expires) {
        return false;
    }

    const payload = `${filePath}:${expires}`;
    const expected = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

    // Timing-safe comparison
    if (token.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}
