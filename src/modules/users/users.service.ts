import { prisma } from '../../config/prisma.js';
import { notFound, accountFrozen } from '../../utils/errors.js';
import type { UpdateProfileInput } from './users.schema.js';

export interface UserProfile {
    id: string;
    mobile: string | null;
    email: string | null;
    dateOfBirth: Date | null;
    ageVerified: boolean;
    accountStatus: string;
    kycStatus: string;
    panNumber: string | null;
    state: string | null;
    fraudScore: number;
    role: string;
    createdAt: Date;
    wallet: {
        depositBalance: string;
        winningBalance: string;
        bonusBalance: string;
    } | null;
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            wallet: {
                select: {
                    depositBalance: true,
                    winningBalance: true,
                    bonusBalance: true,
                },
            },
        },
    });

    if (!user) throw notFound('User');

    return {
        id: user.id,
        mobile: user.mobile,
        email: user.email,
        dateOfBirth: user.dateOfBirth,
        ageVerified: user.ageVerified,
        accountStatus: user.accountStatus,
        kycStatus: user.kycStatus,
        panNumber: user.panNumber,
        state: user.state,
        fraudScore: user.fraudScore,
        role: user.role,
        createdAt: user.createdAt,
        wallet: user.wallet
            ? {
                depositBalance: user.wallet.depositBalance.toString(),
                winningBalance: user.wallet.winningBalance.toString(),
                bonusBalance: user.wallet.bonusBalance.toString(),
            }
            : null,
    };
}

export async function updateUserProfile(
    userId: string,
    input: UpdateProfileInput,
): Promise<UserProfile> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound('User');
    if (user.accountStatus === 'frozen' || user.accountStatus === 'banned') throw accountFrozen();

    await prisma.user.update({
        where: { id: userId },
        data: {
            ...(input.email !== undefined && { email: input.email }),
            ...(input.panNumber !== undefined && { panNumber: input.panNumber }),
        },
    });

    return getUserProfile(userId);
}

export async function updateMobileNumber(
    userId: string,
    mobile: string,
): Promise<UserProfile> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound('User');
    if (user.accountStatus === 'frozen' || user.accountStatus === 'banned') throw accountFrozen();

    if (user.mobile !== null) {
        throw new Error('Mobile number is already set for this account');
    }

    // Check if another user already has this mobile
    const existing = await prisma.user.findUnique({ where: { mobile } });
    if (existing) {
        throw new Error('This mobile number is already registered to another account');
    }

    await prisma.user.update({
        where: { id: userId },
        data: { mobile },
    });

    return getUserProfile(userId);
}
