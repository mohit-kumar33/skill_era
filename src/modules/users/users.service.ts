import { prisma } from '../../config/prisma.js';
import { notFound, accountFrozen } from '../../utils/errors.js';
import type { UpdateProfileInput } from './users.schema.js';

export interface UserProfile {
    id: string;
    mobile: string;
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
