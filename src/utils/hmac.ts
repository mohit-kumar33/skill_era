import crypto from 'crypto';
import { logger } from './logger.js';

/**
 * Verify HMAC-SHA256 signature using timing-safe comparison.
 * Used for payment gateway webhook verification.
 */
export function verifyHmacSignature(
    rawBody: Buffer | string,
    signature: string,
    secret: string,
): boolean {
    try {
        const expected = crypto
            .createHmac('sha256', secret)
            .update(typeof rawBody === 'string' ? Buffer.from(rawBody) : rawBody)
            .digest('hex');

        const sigBuffer = Buffer.from(signature, 'hex');
        const expectedBuffer = Buffer.from(expected, 'hex');

        if (sigBuffer.length !== expectedBuffer.length) {
            return false;
        }

        return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
    } catch (err) {
        logger.error({ err }, 'HMAC verification error');
        return false;
    }
}
