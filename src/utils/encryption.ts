/**
 * encryption.ts
 *
 * AES-256-GCM symmetric encryption utility for sensitive fields at rest.
 *
 * Design rules (fintech grade):
 *   • Random 12-byte IV per encryption call — never reused.
 *   • 128-bit GCM auth tag — provides both confidentiality and integrity.
 *   • Key loaded from ENCRYPTION_KEY env var (32-byte base64, validated at startup).
 *   • Throws AppError(INTERNAL_ERROR) if key is missing — no silent fallback.
 *   • NEVER logs plaintext, keys, IVs, or auth tags.
 *   • All values returned/stored as hex strings for safe DB persistence.
 */

import crypto from 'crypto';
import { AppError, ERROR_CODES } from './errors.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;       // 96 bits — GCM recommended
const AUTH_TAG_LENGTH = 16; // 128 bits

export interface EncryptedPayload {
    ciphertext: string; // hex
    iv: string;         // hex
    authTag: string;    // hex
}

/**
 * Load and validate the 32-byte AES key from environment.
 * Called lazily on first use so tests can inject mocks before module load.
 */
function getKey(): Buffer {
    const keyB64 = process.env['ENCRYPTION_KEY'];
    if (!keyB64) {
        throw new AppError(
            ERROR_CODES.INTERNAL_ERROR,
            'ENCRYPTION_KEY environment variable is not set. Cannot encrypt/decrypt sensitive fields.',
            500,
            false,
        );
    }

    const key = Buffer.from(keyB64, 'base64');
    if (key.length !== 32) {
        throw new AppError(
            ERROR_CODES.INTERNAL_ERROR,
            `ENCRYPTION_KEY must decode to exactly 32 bytes (got ${key.length}). ` +
            'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
            500,
            false,
        );
    }

    return key;
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns ciphertext, iv, and authTag — all hex-encoded.
 *
 * @throws AppError(INTERNAL_ERROR) if ENCRYPTION_KEY is missing or invalid.
 */
export function encrypt(plaintext: string): EncryptedPayload {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
        authTagLength: AUTH_TAG_LENGTH,
    });

    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);

    return {
        ciphertext: encrypted.toString('hex'),
        iv: iv.toString('hex'),
        authTag: cipher.getAuthTag().toString('hex'),
    };
}

/**
 * Decrypt a value previously encrypted with `encrypt()`.
 * Verifies GCM auth tag — tampered ciphertexts throw.
 *
 * @throws AppError(INTERNAL_ERROR) if decryption fails (bad key, tampered data).
 */
export function decrypt(ciphertext: string, iv: string, authTag: string): string {
    const key = getKey();

    try {
        const decipher = crypto.createDecipheriv(
            ALGORITHM,
            key,
            Buffer.from(iv, 'hex'),
            { authTagLength: AUTH_TAG_LENGTH },
        );

        decipher.setAuthTag(Buffer.from(authTag, 'hex'));

        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(ciphertext, 'hex')),
            decipher.final(),
        ]);

        return decrypted.toString('utf8');
    } catch {
        throw new AppError(
            ERROR_CODES.INTERNAL_ERROR,
            'Decryption failed — data may be corrupted or key mismatch.',
            500,
            false,
        );
    }
}

/**
 * Convenience: decrypt if all three components are present, else return null.
 * Used when a field may not yet be encrypted (migration window).
 */
export function decryptIfPresent(
    ciphertext: string | null | undefined,
    iv: string | null | undefined,
    authTag: string | null | undefined,
): string | null {
    if (!ciphertext || !iv || !authTag) return null;
    return decrypt(ciphertext, iv, authTag);
}
