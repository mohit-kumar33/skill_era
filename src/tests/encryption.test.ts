/**
 * encryption.test.ts
 *
 * Unit tests for AES-256-GCM encryption/decryption utility.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encrypt, decrypt, decryptIfPresent } from '../utils/encryption.js';

// setup.ts already sets ENCRYPTION_KEY via process.env

describe('encryption.ts', () => {
    describe('encrypt()', () => {
        it('returns ciphertext, iv, and authTag', () => {
            const result = encrypt('test-plaintext');
            expect(result).toHaveProperty('ciphertext');
            expect(result).toHaveProperty('iv');
            expect(result).toHaveProperty('authTag');
            expect(result.ciphertext.length).toBeGreaterThan(0);
        });

        it('generates a unique IV for every call (random IV)', () => {
            const r1 = encrypt('same-plaintext');
            const r2 = encrypt('same-plaintext');
            expect(r1.iv).not.toBe(r2.iv);
            expect(r1.ciphertext).not.toBe(r2.ciphertext); // different IV → different ciphertext
        });

        it('throws if ENCRYPTION_KEY is missing', () => {
            const original = process.env['ENCRYPTION_KEY'];
            delete process.env['ENCRYPTION_KEY'];
            expect(() => encrypt('value')).toThrow('ENCRYPTION_KEY');
            process.env['ENCRYPTION_KEY'] = original;
        });
    });

    describe('decrypt()', () => {
        it('decrypts back to original plaintext', () => {
            const plaintext = 'ABCDE1234F'; // PAN-like value
            const { ciphertext, iv, authTag } = encrypt(plaintext);
            const result = decrypt(ciphertext, iv, authTag);
            expect(result).toBe(plaintext);
        });

        it('throws on tampered ciphertext (GCM auth tag mismatch)', () => {
            const { ciphertext, iv, authTag } = encrypt('secret');
            const tampered = ciphertext.slice(0, -2) + 'ff'; // corrupt last byte
            expect(() => decrypt(tampered, iv, authTag)).toThrow('Decryption failed');
        });

        it('throws on wrong auth tag', () => {
            const { ciphertext, iv } = encrypt('secret');
            const badTag = 'deadbeefdeadbeefdeadbeefdeadbeef'; // wrong 16-byte tag
            expect(() => decrypt(ciphertext, iv, badTag)).toThrow('Decryption failed');
        });
    });

    describe('decryptIfPresent()', () => {
        it('returns null when all args are null', () => {
            expect(decryptIfPresent(null, null, null)).toBeNull();
        });

        it('returns null when any arg is missing', () => {
            const { ciphertext, iv } = encrypt('value');
            expect(decryptIfPresent(ciphertext, iv, null)).toBeNull();
        });

        it('decrypts successfully when all present', () => {
            const { ciphertext, iv, authTag } = encrypt('hello');
            expect(decryptIfPresent(ciphertext, iv, authTag)).toBe('hello');
        });
    });
});
