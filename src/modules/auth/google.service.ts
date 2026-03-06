import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../../config/prisma.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { AppError, ERROR_CODES, unauthorized, validationError } from '../../utils/errors.js';
import { issueTokens } from './auth.service.js';

// ── Types ──────────────────────────────────────────────────────────────

interface GoogleAuthResult {
    user: {
        id: string;
        mobile: string | null;
        email: string | null;
        role: string;
        accountStatus: string;
        kycStatus: string;
    };
    tokens: {
        accessToken: string;
        refreshToken: string;
    };
    isNewUser: boolean;
    profileIncomplete: boolean;
}

// ── Google OAuth2 Client ───────────────────────────────────────────────

function getGoogleClient(): OAuth2Client {
    if (!env.GOOGLE_CLIENT_ID) {
        throw new AppError(
            ERROR_CODES.INTERNAL_ERROR,
            'Google OAuth is not configured. Set GOOGLE_CLIENT_ID environment variable.',
            500,
            false,
        );
    }
    return new OAuth2Client(env.GOOGLE_CLIENT_ID);
}

// ── Google Login / Register ────────────────────────────────────────────

/**
 * Verify Google ID token and find or create user.
 * - Verifies token with Google's servers
 * - Rejects if email is not verified
 * - Finds existing user by googleId or email
 * - Creates new user + wallet if not found
 * - Returns user info and flags for profile completion
 */
export async function googleLogin(
    idToken: string,
    meta?: { ip?: string; userAgent?: string },
): Promise<GoogleAuthResult> {
    const client = getGoogleClient();

    // ── Verify ID token with Google ──────────────────────
    let payload;
    try {
        const ticket = await client.verifyIdToken({
            idToken,
            audience: env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
    } catch (err) {
        logger.warn({ err }, 'Google ID token verification failed');
        throw unauthorized('Invalid Google token. Please try again.');
    }

    if (!payload) {
        throw unauthorized('Invalid Google token payload.');
    }

    // ── Validate email is verified ───────────────────────
    if (!payload.email_verified) {
        throw validationError('Google account email is not verified. Please verify your email with Google first.');
    }

    const googleId = payload.sub;
    const email = payload.email!;

    logger.info({ googleId, email }, 'Google token verified');

    // ── Find existing user ───────────────────────────────
    // First try by googleId, then by email
    let user = await prisma.user.findUnique({
        where: { googleId },
        select: {
            id: true,
            mobile: true,
            email: true,
            role: true,
            accountStatus: true,
            kycStatus: true,
            googleId: true,
        },
    });

    if (!user) {
        // Check if a user exists with this email (e.g. registered with email/password)
        user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                mobile: true,
                email: true,
                role: true,
                accountStatus: true,
                kycStatus: true,
                googleId: true,
            },
        });

        if (user) {
            // Link Google account to existing user
            await prisma.user.update({
                where: { id: user.id },
                data: { googleId },
            });
            user.googleId = googleId;

            logger.info({ userId: user.id, googleId }, 'Linked Google account to existing user');
        }
    }

    // ── Check account status ─────────────────────────────
    if (user) {
        if (user.accountStatus === 'banned' || user.accountStatus === 'suspended') {
            throw new AppError(ERROR_CODES.ACCOUNT_FROZEN, `Account is ${user.accountStatus}`, 403);
        }
        if (user.accountStatus === 'frozen') {
            throw new AppError(ERROR_CODES.ACCOUNT_FROZEN, 'Account is frozen. Contact support.', 403);
        }

        logger.info({ userId: user.id }, 'Google login: existing user');

        const tokens = await issueTokens({ userId: user.id, role: user.role as 'user' | 'admin' | 'finance_admin' | 'super_admin' });

        return {
            user: {
                id: user.id,
                mobile: user.mobile,
                email: user.email,
                role: user.role,
                accountStatus: user.accountStatus,
                kycStatus: user.kycStatus,
            },
            tokens,
            isNewUser: false,
            profileIncomplete: !user.mobile,
        };
    }

    // ── Create new user with wallet ──────────────────────
    const newUser = await prisma.user.create({
        data: {
            email,
            googleId,
            authProvider: 'GOOGLE',
            // mobile and passwordHash are null for Google OAuth users
            wallet: {
                create: {
                    depositBalance: 0,
                    winningBalance: 0,
                    bonusBalance: 0,
                },
            },
        },
        select: {
            id: true,
            mobile: true,
            email: true,
            role: true,
            accountStatus: true,
            kycStatus: true,
        },
    });

    logger.info({ userId: newUser.id, googleId, email }, 'New user created via Google OAuth');

    const tokens = await issueTokens({ userId: newUser.id, role: newUser.role as 'user' | 'admin' | 'finance_admin' | 'super_admin' });

    return {
        user: {
            id: newUser.id,
            mobile: newUser.mobile,
            email: newUser.email,
            role: newUser.role,
            accountStatus: newUser.accountStatus,
            kycStatus: newUser.kycStatus,
        },
        tokens,
        isNewUser: true,
        profileIncomplete: true, // New Google users always need to complete profile (mobile)
    };
}
