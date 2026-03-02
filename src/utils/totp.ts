/**
 * totp.ts
 *
 * RFC 6238 compliant TOTP (Time-based One-Time Password) utility.
 *
 * Design:
 *   • Uses `otplib` OTP class with TOTP strategy — RFC 6238 compliant.
 *   • Allows ±1 step clock drift (epochTolerance: 30s) = ±30 seconds grace.
 *   • In-process replay cache prevents the same token being accepted twice
 *     within the same 30-second window (application layer).
 *   • Secrets are base32-encoded (20 bytes = 160 bits).
 *   • QR provisioning returns an otpauth:// URI compatible with Google
 *     Authenticator, Authy, and 1Password.
 *
 * Security rules (enforced here):
 *   • NEVER log TOTP tokens.
 *   • NEVER log TOTP secrets (even encoded).
 *   • Replay cache is per-process. For multi-instance deployments replace
 *     with a Redis SETNX key with 90-second TTL.
 */

import { OTP } from 'otplib';

// ── TOTP instance ──────────────────────────────────────────────────────

const otp = new OTP({ strategy: 'totp' });

// ── Replay cache ──────────────────────────────────────────────────────
// Key: "userId:token:stepCounter" → expiry epoch (seconds)
// Prevents same token being used twice in the same 30-second window.
// NOTE: In a multi-instance deployment, replace with Redis SETNX + 90s TTL.

const _replayCache = new Map<string, number>(); // key → expiry (seconds)
const CACHE_TTL_SECONDS = 90; // slightly longer than 2 steps

function replayCacheKey(userId: string, token: string): string {
    const step = Math.floor(Date.now() / 1000 / 30);
    return `${userId}:${token}:${step}`;
}

function purgeExpiredEntries(): void {
    const now = Math.floor(Date.now() / 1000);
    for (const [k, expiry] of _replayCache) {
        if (expiry < now) _replayCache.delete(k);
    }
}

function markUsed(userId: string, token: string): void {
    purgeExpiredEntries();
    const key = replayCacheKey(userId, token);
    _replayCache.set(key, Math.floor(Date.now() / 1000) + CACHE_TTL_SECONDS);
}

function isAlreadyUsed(userId: string, token: string): boolean {
    purgeExpiredEntries();
    return _replayCache.has(replayCacheKey(userId, token));
}

// ── Public API ────────────────────────────────────────────────────────

/**
 * Generate a new base32 TOTP secret for a user.
 * The caller must store the secret encrypted (see encryption.ts).
 */
export function generateTotpSecret(): string {
    return otp.generateSecret(20); // 160-bit secret, base32 encoded
}

/**
 * Generate an otpauth:// URI for QR code provisioning.
 * Compatible with Google Authenticator, Authy, 1Password, etc.
 *
 * @param secret   - Raw base32 secret (NOT encrypted — decrypt before passing)
 * @param label    - Account label shown in authenticator app (e.g. userId)
 * @param issuer   - App name shown in authenticator app
 */
export function getTotpQrUrl(
    secret: string,
    label: string,
    issuer: string = 'Skill Era',
): string {
    return otp.generateURI({ issuer, label, secret });
}

/**
 * Verify a TOTP token synchronously.
 *
 * @param secret  - Raw base32 secret (decrypted from DB)
 * @param token   - 6-digit code from authenticator app
 * @param userId  - Used for replay cache keying
 * @returns true if valid and not replayed, false otherwise
 *
 * NEVER log the `token` parameter.
 */
export function verifyTotpToken(
    secret: string,
    token: string,
    userId: string,
): boolean {
    // Reject tokens already used in the current step window
    if (isAlreadyUsed(userId, token)) {
        return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = otp.verifySync({
        secret,
        token,
        epochTolerance: 30, // ±30 seconds = ±1 step
    });

    // otplib OTP class returns { valid: boolean, delta: number } or false
    const verified = result === true || (typeof result === 'object' && result !== null && result.valid === true);

    if (verified) {
        markUsed(userId, token);
        return true;
    }

    return false;
}

/**
 * Generate a TOTP token for a given secret (used in tests only).
 * @internal
 */
export function generateTotpToken(secret: string): string {
    return otp.generateSync({ secret });
}

/**
 * For testing only — clear replay cache between tests.
 * @internal
 */
export function _resetReplayCacheForTests(): void {
    _replayCache.clear();
}
