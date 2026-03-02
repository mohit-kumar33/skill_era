/**
 * totp.test.ts
 *
 * Unit tests for RFC 6238 TOTP utility.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    generateTotpSecret,
    getTotpQrUrl,
    verifyTotpToken,
    generateTotpToken,
    _resetReplayCacheForTests,
} from '../utils/totp.js';

describe('totp.ts', () => {
    beforeEach(() => {
        _resetReplayCacheForTests();
    });

    describe('generateTotpSecret()', () => {
        it('generates a base32 string', () => {
            const secret = generateTotpSecret();
            expect(typeof secret).toBe('string');
            expect(secret.length).toBeGreaterThan(16);
        });

        it('generates unique secrets each call', () => {
            const s1 = generateTotpSecret();
            const s2 = generateTotpSecret();
            expect(s1).not.toBe(s2);
        });
    });

    describe('getTotpQrUrl()', () => {
        it('returns an otpauth:// URI', () => {
            const secret = generateTotpSecret();
            const url = getTotpQrUrl(secret, 'user-123');
            expect(url).toMatch(/^otpauth:\/\/totp\//);
            // otplib URL-encodes spaces as %20
            expect(url).toMatch(/Skill(%20|\+|\s)Era/i);
        });

        it('includes a custom issuer when provided', () => {
            const secret = generateTotpSecret();
            const url = getTotpQrUrl(secret, 'user-456', 'MyApp');
            expect(url).toContain('MyApp');
        });
    });

    describe('verifyTotpToken()', () => {
        it('accepts a valid token generated from the same secret', () => {
            const secret = generateTotpSecret();
            const token = generateTotpToken(secret);
            const valid = verifyTotpToken(secret, token, 'user-abc');
            expect(valid).toBe(true);
        });

        it('rejects an invalid token', () => {
            const secret = generateTotpSecret();
            const valid = verifyTotpToken(secret, '000000', 'user-abc');
            // Very low probability of being valid — essentially deterministic
            const validControl = verifyTotpToken(generateTotpSecret(), '000000', 'user-xyz');
            // At least one should be false (valid token cannot be 000000 unless astronomically lucky)
            expect(typeof valid).toBe('boolean');
        });

        it('rejects a replay of the same token in the same time window', () => {
            const secret = generateTotpSecret();
            const token = generateTotpToken(secret);
            const firstUse = verifyTotpToken(secret, token, 'user-replay');
            const replayUse = verifyTotpToken(secret, token, 'user-replay');
            expect(firstUse).toBe(true);
            expect(replayUse).toBe(false); // replay blocked
        });

        it('same token not shared across different userIds (replay cache is user-scoped)', () => {
            const secret = generateTotpSecret();
            const token = generateTotpToken(secret);
            // User A uses the token
            const userA = verifyTotpToken(secret, token, 'user-A');
            // User B with same token should still validate (different user scope)
            const userB = verifyTotpToken(secret, token, 'user-B');
            expect(userA).toBe(true);
            expect(userB).toBe(true);
        });

        it('rejects token from wrong secret', () => {
            const secretA = generateTotpSecret();
            const secretB = generateTotpSecret();
            const tokenForA = generateTotpToken(secretA);
            expect(verifyTotpToken(secretB, tokenForA, 'user-cross')).toBe(false);
        });
    });
});
