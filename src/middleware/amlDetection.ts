import { prisma } from '../config/prisma.js';
import { logger } from '../utils/logger.js';
import type { FraudFlagType } from '@prisma/client';

// ═══════════════════════════════════════════════════════════════════════
// AML PATTERN DETECTION
// ═══════════════════════════════════════════════════════════════════════
//
// Lightweight AML detection for beta. Runs asynchronously during
// withdrawal requests — never blocks the critical path.
//
// Detected patterns:
//   1. Deposit → Withdraw same amount within 48 hours
//   2. Total withdrawals > 80% of total deposits within 48 hours
//
// Actions on detection:
//   • Increment user fraudScore
//   • Create fraudFlag record
//   • Log structured alert
//
// NOT a substitute for a proper AML reporting system.
// ═══════════════════════════════════════════════════════════════════════

const AML_WINDOW_HOURS = 48;
const AML_WITHDRAWAL_RATIO_THRESHOLD = 0.80; // 80%
const AML_SAME_AMOUNT_RISK_POINTS = 25;
const AML_HIGH_RATIO_RISK_POINTS = 20;

/**
 * Run AML checks asynchronously (fire-and-forget).
 * Call from withdrawal request flow — must never throw.
 */
export async function runAmlChecks(
    userId: string,
    withdrawalAmount: string,
): Promise<void> {
    try {
        const cutoff = new Date(Date.now() - AML_WINDOW_HOURS * 60 * 60 * 1000);
        const amount = parseFloat(withdrawalAmount);

        // ── Pattern 1: Same-amount deposit→withdraw cycle ────
        const matchingDeposit = await prisma.deposit.findFirst({
            where: {
                userId,
                status: 'confirmed',
                amount: parseFloat(withdrawalAmount),
                createdAt: { gte: cutoff },
            },
        });

        if (matchingDeposit) {
            logger.warn(
                {
                    event: 'aml_same_amount_cycle',
                    userId,
                    amount: withdrawalAmount,
                    depositId: matchingDeposit.id,
                    depositDate: matchingDeposit.createdAt,
                },
                'AML: deposit→withdraw same amount detected within 48h',
            );

            await flagAml(
                userId,
                'deposit_withdraw_velocity',
                AML_SAME_AMOUNT_RISK_POINTS,
                `Same-amount cycle: deposited ₹${withdrawalAmount} then withdrew ₹${withdrawalAmount} within ${AML_WINDOW_HOURS}h`,
            );
        }

        // ── Pattern 2: High withdrawal-to-deposit ratio ──────
        const [depositAgg, withdrawalAgg] = await Promise.all([
            prisma.deposit.aggregate({
                where: { userId, status: 'confirmed', createdAt: { gte: cutoff } },
                _sum: { amount: true },
            }),
            prisma.withdrawal.aggregate({
                where: {
                    userId,
                    status: { in: ['requested', 'under_review', 'approved', 'paid'] },
                    createdAt: { gte: cutoff },
                },
                _sum: { amount: true },
            }),
        ]);

        const totalDeposits = Number(depositAgg._sum.amount ?? 0);
        const totalWithdrawals = Number(withdrawalAgg._sum.amount ?? 0) + amount;

        if (totalDeposits > 0) {
            const ratio = totalWithdrawals / totalDeposits;
            if (ratio > AML_WITHDRAWAL_RATIO_THRESHOLD) {
                logger.warn(
                    {
                        event: 'aml_high_withdrawal_ratio',
                        userId,
                        totalDeposits,
                        totalWithdrawals,
                        ratio: `${(ratio * 100).toFixed(1)}%`,
                    },
                    `AML: withdrawal/deposit ratio ${(ratio * 100).toFixed(1)}% exceeds ${AML_WITHDRAWAL_RATIO_THRESHOLD * 100}% threshold`,
                );

                await flagAml(
                    userId,
                    'deposit_withdraw_velocity',
                    AML_HIGH_RATIO_RISK_POINTS,
                    `High W/D ratio: ₹${totalWithdrawals.toFixed(2)} withdrawn vs ₹${totalDeposits.toFixed(2)} deposited (${(ratio * 100).toFixed(1)}%) in ${AML_WINDOW_HOURS}h`,
                );
            }
        }
    } catch (err) {
        // AML checks must NEVER break the withdrawal flow
        logger.error({ err, userId }, 'AML check failed — non-blocking');
    }
}

async function flagAml(
    userId: string,
    flagType: FraudFlagType,
    riskPoints: number,
    description: string,
): Promise<void> {
    await prisma.$transaction([
        prisma.fraudFlag.create({
            data: { userId, flagType, riskPoints, description },
        }),
        prisma.user.update({
            where: { id: userId },
            data: { fraudScore: { increment: riskPoints } },
        }),
    ]);
}
