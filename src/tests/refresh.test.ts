import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { refreshAccessToken, loginUser } from '../modules/auth/auth.service.js';
import { AppError } from '../utils/errors.js';
import { _resetForTests as resetMonitoring } from '../utils/monitoring.service.js';

// Mock pino logger to avoid clutter
vi.mock('../utils/logger.js', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

describe('Refresh Token Rotation (Task 6)', () => {
    const mockUser = {
        id: 'user-123',
        mobile: '9876543210',
        passwordHash: 'hashed_pw',
        role: 'user',
        accountStatus: 'active',
    };

    beforeEach(async () => {
        vi.clearAllMocks();
        resetMonitoring();

        // Mock Prisma findUnique for user
        vi.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser as any);
    });

    it('should rotate tokens on valid refresh', async () => {
        // 1. Setup existing token in DB
        const oldToken = jwt.sign({ userId: mockUser.id, role: mockUser.role, type: 'refresh' }, env.JWT_REFRESH_SECRET);
        const oldTokenRecord = {
            id: 'rt-1',
            userId: mockUser.id,
            tokenHash: expect.any(String),
            isRevoked: false,
            user: mockUser,
        };

        vi.spyOn(prisma.refreshToken, 'findFirst').mockResolvedValue(oldTokenRecord as any);
        vi.spyOn(prisma.refreshToken, 'create').mockResolvedValue({ id: 'rt-2' } as any);
        vi.spyOn(prisma.refreshToken, 'update').mockResolvedValue({} as any);

        const result = await refreshAccessToken(oldToken);

        // Verify rotation logic:
        // - Refresh token is verified
        // - New token pair is returned
        expect(result.accessToken).toBeDefined();
        expect(result.refreshToken).toBeDefined();
        expect(result.refreshToken).not.toBe(oldToken);

        // - Old token is marked as revoked and linked to new
        expect(prisma.refreshToken.update).toHaveBeenCalledWith({
            where: { id: 'rt-1' },
            data: { isRevoked: true, replacedById: 'rt-2' },
        });

        // - New token is stored
        expect(prisma.refreshToken.create).toHaveBeenCalled();
    });

    it('should detect reuse and revoke entire family', async () => {
        const stolenToken = jwt.sign({ userId: mockUser.id, role: mockUser.role, type: 'refresh' }, env.JWT_REFRESH_SECRET);
        const revokedTokenRecord = {
            id: 'rt-old',
            userId: mockUser.id,
            isRevoked: true, // ALREADY REVOKED
            user: mockUser,
        };

        vi.spyOn(prisma.refreshToken, 'findFirst').mockResolvedValue(revokedTokenRecord as any);
        vi.spyOn(prisma.refreshToken, 'updateMany').mockResolvedValue({ count: 5 } as any);

        await expect(refreshAccessToken(stolenToken)).rejects.toThrow('Security breach detected');

        // Verify family revocation:
        expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
            where: { userId: mockUser.id },
            data: { isRevoked: true },
        });
    });

    it('should reject unrecognized tokens (hash mismatch)', async () => {
        const validJwtButNotStored = jwt.sign({ userId: mockUser.id, role: mockUser.role, type: 'refresh' }, env.JWT_REFRESH_SECRET);

        vi.spyOn(prisma.refreshToken, 'findFirst').mockResolvedValue(null);

        await expect(refreshAccessToken(validJwtButNotStored)).rejects.toThrow('Token is not recognized');
    });

    it('should reject wrong token type (access as refresh)', async () => {
        const accessToken = jwt.sign({ userId: mockUser.id, role: mockUser.role, type: 'access' }, env.JWT_REFRESH_SECRET);

        await expect(refreshAccessToken(accessToken)).rejects.toThrow('Invalid refresh token');
    });
});
