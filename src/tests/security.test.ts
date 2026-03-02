/**
 * Security Tests — Beta Stabilization
 *
 * Covers:
 *   1. Cookie security attributes (Secure, SameSite=Strict, HttpOnly)
 *   2. CSRF protection (missing header → 403)
 *   3. File upload rejects spoofed MIME types (wrong magic bytes → 415)
 *   4. Device fingerprint computation determinism
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (must be before any module imports that transitively require these) ──

vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
        fatal: vi.fn(),
    },
    createChildLogger: vi.fn(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    })),
}));

vi.mock('../config/prisma.js', () => ({
    prisma: {
        user: { update: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
        fraudFlag: { create: vi.fn() },
    },
}));

vi.mock('../utils/monitoring.service.js', () => ({ emit: vi.fn() }));

vi.mock('../utils/alerting.js', () => ({
    recordEvent: vi.fn(),
    sendAlert: vi.fn(),
    trackErrorRate: vi.fn(),
}));

vi.mock('../config/database.js', () => ({
    pool: { query: vi.fn(), connect: vi.fn() },
    checkDatabaseHealth: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────

import {
    csrfProtection,
    generateCsrfToken,
    CSRF_COOKIE_OPTIONS,
} from '../middleware/csrfProtection.js';

import {
    validateFileUpload,
    detectMimeFromBytes,
} from '../middleware/fileValidation.js';

import { computeDeviceFingerprint } from '../middleware/fraudHardening.js';

// ═══════════════════════════════════════════════════════════════════════
// 1. COOKIE SECURITY ATTRIBUTES
// ═══════════════════════════════════════════════════════════════════════

describe('Cookie Security Attributes', () => {
    it('CSRF cookie should NOT be httpOnly (frontend must read it)', () => {
        expect(CSRF_COOKIE_OPTIONS.httpOnly).toBe(false);
    });

    it('CSRF cookie should have sameSite strict', () => {
        expect(CSRF_COOKIE_OPTIONS.sameSite).toBe('strict');
    });

    it('CSRF cookie should have correct path', () => {
        expect(CSRF_COOKIE_OPTIONS.path).toBe('/');
    });

    it('CSRF cookie should have maxAge set', () => {
        expect(CSRF_COOKIE_OPTIONS.maxAge).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. CSRF PROTECTION — Missing Header → 403
// ═══════════════════════════════════════════════════════════════════════

describe('CSRF Protection Middleware', () => {
    function mockRequest(
        method: string,
        url: string,
        cookies: Record<string, string>,
        headers: Record<string, string>,
    ): any {
        return {
            method,
            url,
            ip: '127.0.0.1',
            cookies,
            headers,
        };
    }

    it('should skip safe methods (GET)', async () => {
        const req = mockRequest('GET', '/api/v1/users/me', {}, {});
        await expect(csrfProtection(req, {} as any)).resolves.toBeUndefined();
    });

    it('should skip excluded paths (/api/v1/auth/login)', async () => {
        const req = mockRequest('POST', '/api/v1/auth/login', {}, {});
        await expect(csrfProtection(req, {} as any)).resolves.toBeUndefined();
    });

    it('should skip excluded paths (/api/v1/auth/register)', async () => {
        const req = mockRequest('POST', '/api/v1/auth/register', {}, {});
        await expect(csrfProtection(req, {} as any)).resolves.toBeUndefined();
    });

    it('should reject POST with missing CSRF header (403)', async () => {
        const token = generateCsrfToken();
        const req = mockRequest('POST', '/api/v1/wallet/deposit', { csrfToken: token }, {});

        try {
            await csrfProtection(req, {} as any);
            expect.fail('Should have thrown');
        } catch (err: any) {
            expect(err.statusCode).toBe(403);
        }
    });

    it('should reject POST with missing CSRF cookie (403)', async () => {
        const token = generateCsrfToken();
        const req = mockRequest('POST', '/api/v1/wallet/deposit', {}, { 'x-csrf-token': token });

        try {
            await csrfProtection(req, {} as any);
            expect.fail('Should have thrown');
        } catch (err: any) {
            expect(err.statusCode).toBe(403);
        }
    });

    it('should reject POST with mismatched CSRF tokens (403)', async () => {
        const cookieToken = generateCsrfToken();
        const headerToken = generateCsrfToken(); // Different token
        const req = mockRequest(
            'POST',
            '/api/v1/wallet/deposit',
            { csrfToken: cookieToken },
            { 'x-csrf-token': headerToken },
        );

        try {
            await csrfProtection(req, {} as any);
            expect.fail('Should have thrown');
        } catch (err: any) {
            expect(err.statusCode).toBe(403);
        }
    });

    it('should pass POST with matching CSRF tokens', async () => {
        const token = generateCsrfToken();
        const req = mockRequest(
            'POST',
            '/api/v1/wallet/deposit',
            { csrfToken: token },
            { 'x-csrf-token': token },
        );

        await expect(csrfProtection(req, {} as any)).resolves.toBeUndefined();
    });

    it('generateCsrfToken should produce 64-char hex (256-bit)', () => {
        const token = generateCsrfToken();
        expect(token).toHaveLength(64);
        expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. FILE UPLOAD — Spoofed MIME Rejection
// ═══════════════════════════════════════════════════════════════════════

describe('File Upload Validation', () => {
    it('should accept valid JPEG file', () => {
        // JPEG magic bytes: FF D8 FF
        const buffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, ...Array(100).fill(0)]);
        const result = validateFileUpload(buffer, 'photo.jpg');
        expect(result.mime).toBe('image/jpeg');
    });

    it('should accept valid PNG file', () => {
        // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
        const buffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ...Array(100).fill(0)]);
        const result = validateFileUpload(buffer, 'photo.png');
        expect(result.mime).toBe('image/png');
    });

    it('should reject spoofed file with wrong magic bytes (415)', () => {
        // Not JPEG or PNG — ZIP signature
        const buffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, ...Array(100).fill(0)]);
        try {
            validateFileUpload(buffer, 'malware.jpg');
            expect.fail('Should have thrown');
        } catch (err: any) {
            expect(err.statusCode).toBe(415);
        }
    });

    it('should reject empty file (400)', () => {
        const buffer = Buffer.alloc(0);
        try {
            validateFileUpload(buffer, 'empty.jpg');
            expect.fail('Should have thrown');
        } catch (err: any) {
            expect(err.statusCode).toBe(400);
        }
    });

    it('should reject file exceeding 5MB (413)', () => {
        // 6MB buffer with JPEG magic bytes
        const buffer = Buffer.alloc(6 * 1024 * 1024);
        buffer[0] = 0xFF;
        buffer[1] = 0xD8;
        buffer[2] = 0xFF;

        try {
            validateFileUpload(buffer, 'huge.jpg');
            expect.fail('Should have thrown');
        } catch (err: any) {
            expect(err.statusCode).toBe(413);
        }
    });

    it('detectMimeFromBytes should return null for unrecognized bytes', () => {
        const buffer = Buffer.from([0x00, 0x00, 0x00]);
        expect(detectMimeFromBytes(buffer)).toBeNull();
    });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. DEVICE FINGERPRINT — Determinism
// ═══════════════════════════════════════════════════════════════════════

describe('Device Fingerprint', () => {
    it('should produce deterministic hash for same inputs', () => {
        const fp1 = computeDeviceFingerprint('Mozilla/5.0', '192.168.1.1');
        const fp2 = computeDeviceFingerprint('Mozilla/5.0', '192.168.1.1');
        expect(fp1).toBe(fp2);
    });

    it('should produce different hash for different inputs', () => {
        const fp1 = computeDeviceFingerprint('Mozilla/5.0', '192.168.1.1');
        const fp2 = computeDeviceFingerprint('Chrome/120.0', '192.168.1.1');
        const fp3 = computeDeviceFingerprint('Mozilla/5.0', '10.0.0.1');
        expect(fp1).not.toBe(fp2);
        expect(fp1).not.toBe(fp3);
    });

    it('should produce 64-char hex string (SHA-256)', () => {
        const fp = computeDeviceFingerprint('test-agent', '127.0.0.1');
        expect(fp).toHaveLength(64);
        expect(/^[0-9a-f]{64}$/.test(fp)).toBe(true);
    });
});
