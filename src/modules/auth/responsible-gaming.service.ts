/**
 * Responsible Gaming Service — Indian regulatory compliance.
 *
 * Implements:
 *   1. Daily/Weekly deposit caps
 *   2. Self-exclusion mechanism (user-initiated temporary/permanent ban)
 *   3. Deposit limit checks integrated into deposit flow
 *
 * Legal Basis:
 *   - MeitY Guidelines on Online Gaming (2023)
 *   - State-level responsible gaming requirements
 */

import { prisma } from '../../config/prisma.js';
import { logger } from '../../utils/logger.js';
import {
    AppError,
    ERROR_CODES,
    notFound,
    validationError,
} from '../../utils/errors.js';
import {
    DAILY_DEPOSIT_CAP,
    WEEKLY_DEPOSIT_CAP,
    SELF_EXCLUSION_DURATIONS,
} from '../../config/constants.js';

// ── Types ──────────────────────────────────────────────────────────────

type ExclusionDuration = typeof SELF_EXCLUSION_DURATIONS[number];

interface DepositLimitCheck {
    allowed: boolean;
    reason?: string;
    dailyUsed: string;
    dailyRemaining: string;
    weeklyUsed: string;
    weeklyRemaining: string;
}

// ═══════════════════════════════════════════════════════════════════════
// DEPOSIT CAP ENFORCEMENT
// ═══════════════════════════════════════════════════════════════════════

/**
 * Check if a deposit amount is within daily/weekly caps.
 * Called BEFORE deposit initiation.
 */
export async function checkDepositLimits(
    userId: string,
    depositAmount: string,
): Promise<DepositLimitCheck> {
    const amount = parseFloat(depositAmount);
    const dailyCap = parseFloat(DAILY_DEPOSIT_CAP);
    const weeklyCap = parseFloat(WEEKLY_DEPOSIT_CAP);

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Sunday start

    // Check self-exclusion first
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            selfExclusionUntil: true,
            accountStatus: true,
        },
    });
    if (!user) throw notFound('User');

    if (user.selfExclusionUntil && user.selfExclusionUntil > now) {
        return {
            allowed: false,
            reason: `Self-exclusion active until ${user.selfExclusionUntil.toISOString().split('T')[0]}`,
            dailyUsed: '0', dailyRemaining: '0',
            weeklyUsed: '0', weeklyRemaining: '0',
        };
    }

    // Sum deposits in current day + week
    const [dailyAgg, weeklyAgg] = await Promise.all([
        prisma.deposit.aggregate({
            _sum: { amount: true },
            where: {
                userId,
                status: { in: ['initiated', 'confirmed'] },
                createdAt: { gte: dayStart },
            },
        }),
        prisma.deposit.aggregate({
            _sum: { amount: true },
            where: {
                userId,
                status: { in: ['initiated', 'confirmed'] },
                createdAt: { gte: weekStart },
            },
        }),
    ]);

    const dailyUsed = Number(dailyAgg._sum.amount ?? 0);
    const weeklyUsed = Number(weeklyAgg._sum.amount ?? 0);
    const dailyRemaining = Math.max(0, dailyCap - dailyUsed);
    const weeklyRemaining = Math.max(0, weeklyCap - weeklyUsed);

    if (dailyUsed + amount > dailyCap) {
        return {
            allowed: false,
            reason: `Daily deposit limit exceeded. ₹${dailyRemaining.toFixed(2)} remaining today.`,
            dailyUsed: dailyUsed.toFixed(2),
            dailyRemaining: dailyRemaining.toFixed(2),
            weeklyUsed: weeklyUsed.toFixed(2),
            weeklyRemaining: weeklyRemaining.toFixed(2),
        };
    }

    if (weeklyUsed + amount > weeklyCap) {
        return {
            allowed: false,
            reason: `Weekly deposit limit exceeded. ₹${weeklyRemaining.toFixed(2)} remaining this week.`,
            dailyUsed: dailyUsed.toFixed(2),
            dailyRemaining: dailyRemaining.toFixed(2),
            weeklyUsed: weeklyUsed.toFixed(2),
            weeklyRemaining: weeklyRemaining.toFixed(2),
        };
    }

    return {
        allowed: true,
        dailyUsed: dailyUsed.toFixed(2),
        dailyRemaining: (dailyCap - dailyUsed - amount).toFixed(2),
        weeklyUsed: weeklyUsed.toFixed(2),
        weeklyRemaining: (weeklyCap - weeklyUsed - amount).toFixed(2),
    };
}

// ═══════════════════════════════════════════════════════════════════════
// SELF-EXCLUSION
// ═══════════════════════════════════════════════════════════════════════

/**
 * User-initiated self-exclusion. Once activated:
 *   - Cannot deposit, join tournaments, or place bets
 *   - CAN withdraw existing balance
 *   - Cannot be reversed for the selected duration
 */
export async function activateSelfExclusion(
    userId: string,
    durationDays: ExclusionDuration,
) {
    if (!SELF_EXCLUSION_DURATIONS.includes(durationDays)) {
        throw validationError(`Invalid exclusion duration. Allowed: ${SELF_EXCLUSION_DURATIONS.join(', ')} days`);
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { selfExclusionUntil: true },
    });
    if (!user) throw notFound('User');

    // Cannot shorten an existing exclusion
    const now = new Date();
    if (user.selfExclusionUntil && user.selfExclusionUntil > now) {
        const existingEnd = user.selfExclusionUntil;
        const newEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
        if (newEnd < existingEnd) {
            throw validationError(
                `Cannot shorten existing exclusion. Current exclusion ends ${existingEnd.toISOString().split('T')[0]}.`
            );
        }
    }

    const exclusionEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    await prisma.user.update({
        where: { id: userId },
        data: { selfExclusionUntil: exclusionEnd },
    });

    logger.info(
        { userId, durationDays, exclusionEnd: exclusionEnd.toISOString() },
        'Self-exclusion activated',
    );

    return {
        message: `Self-exclusion activated for ${durationDays} days until ${exclusionEnd.toISOString().split('T')[0]}.`,
        exclusionEnd: exclusionEnd.toISOString(),
        durationDays,
        canWithdraw: true,
        canDeposit: false,
        canPlayTournaments: false,
    };
}

/**
 * Check whether a user is currently self-excluded.
 */
export async function getSelfExclusionStatus(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { selfExclusionUntil: true },
    });
    if (!user) throw notFound('User');

    const isExcluded = !!(user.selfExclusionUntil && user.selfExclusionUntil > new Date());

    return {
        isExcluded,
        exclusionEnd: user.selfExclusionUntil?.toISOString() ?? null,
    };
}
