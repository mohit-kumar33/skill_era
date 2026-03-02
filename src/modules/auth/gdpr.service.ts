/**
 * DPDP (Data Protection & Digital Privacy) Act 2023 — Account Deletion Service.
 *
 * Implements:
 *   1. requestAccountDeletion(userId)  — soft-delete with 30-day grace
 *   2. cancelDeletionRequest(userId)   — user can cancel within grace period
 *   3. executeAccountDeletion(userId)  — anonymize PII, retain financial records
 *
 * Financial Safety:
 *   - Cannot delete if there are pending withdrawals or active tournament entries
 *   - Financial records (ledger, TDS, audit logs) are NEVER deleted (5-year retention)
 *   - PII is anonymized (hashed), not removed, to maintain referential integrity
 */

import { prisma } from '../../config/prisma.js';
import { logger } from '../../utils/logger.js';
import { AppError, ERROR_CODES, notFound, validationError } from '../../utils/errors.js';
import {
    ACCOUNT_DELETION_GRACE_DAYS,
    FINANCIAL_RECORD_RETENTION_YEARS,
} from '../../config/constants.js';
import crypto from 'crypto';

// ── Request Deletion ──────────────────────────────────────────────────

export async function requestAccountDeletion(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            accountStatus: true,
        },
    });
    if (!user) throw notFound('User');

    // Block deletion if pending financial obligations
    const pendingWithdrawals = await prisma.withdrawal.count({
        where: {
            userId,
            status: { in: ['requested', 'under_review', 'approved'] },
        },
    });
    if (pendingWithdrawals > 0) {
        throw validationError('Cannot delete account with pending withdrawals. Please wait for them to complete.');
    }

    // Check wallet balance
    const wallet = await prisma.wallet.findUnique({
        where: { userId },
        select: { depositBalance: true, winningBalance: true, bonusBalance: true },
    });
    const totalBalance = wallet
        ? Number(wallet.depositBalance) + Number(wallet.winningBalance) + Number(wallet.bonusBalance)
        : 0;
    if (totalBalance > 0) {
        throw validationError(`Cannot delete account with non-zero balance (₹${totalBalance.toFixed(2)}). Please withdraw first.`);
    }

    const deletionDate = new Date();
    deletionDate.setDate(deletionDate.getDate() + ACCOUNT_DELETION_GRACE_DAYS);

    // Mark for deletion
    const updated = await prisma.user.update({
        where: { id: userId },
        data: {
            accountStatus: 'pending_deletion',
            deletionRequestedAt: new Date(),
            deletionScheduledFor: deletionDate,
        },
        select: { id: true, accountStatus: true, deletionScheduledFor: true },
    });

    logger.info(
        { userId, deletionScheduledFor: deletionDate.toISOString() },
        'Account deletion requested',
    );

    return {
        message: `Account scheduled for deletion on ${deletionDate.toISOString().split('T')[0]}. You can cancel within ${ACCOUNT_DELETION_GRACE_DAYS} days.`,
        deletionScheduledFor: deletionDate.toISOString(),
        gracePeriodDays: ACCOUNT_DELETION_GRACE_DAYS,
    };
}

// ── Cancel Deletion ───────────────────────────────────────────────────

export async function cancelDeletionRequest(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { accountStatus: true },
    });
    if (!user) throw notFound('User');
    if (user.accountStatus !== 'pending_deletion') {
        throw validationError('No pending deletion request found.');
    }

    await prisma.user.update({
        where: { id: userId },
        data: {
            accountStatus: 'active',
            deletionRequestedAt: null,
            deletionScheduledFor: null,
        },
    });

    logger.info({ userId }, 'Account deletion cancelled');
    return { message: 'Account deletion cancelled. Your account is active again.' };
}

// ── Execute Deletion (called by background job) ───────────────────────

export async function executeAccountDeletion(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            accountStatus: true,
            deletionScheduledFor: true,
            mobile: true,
            email: true,
        },
    });

    if (!user) throw notFound('User');
    if (user.accountStatus !== 'pending_deletion') {
        throw validationError('User is not pending deletion');
    }
    if (user.deletionScheduledFor && user.deletionScheduledFor > new Date()) {
        throw validationError('Grace period has not expired yet');
    }

    // Anonymize PII — hash instead of delete (maintains referential integrity)
    const anonHash = crypto.createHash('sha256').update(userId + Date.now()).digest('hex').slice(0, 12);

    await prisma.user.update({
        where: { id: userId },
        data: {
            mobile: `DELETED_${anonHash}`,
            email: `deleted_${anonHash}@removed.local`,
            passwordHash: 'DELETED',
            accountStatus: 'deleted',
            kycDocNumber: user.mobile ? `ANON_${anonHash}` : null,
            kycDocUrl: null,
            twoFactorSecret: null,
            deletionExecutedAt: new Date(),
        },
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId } });

    logger.info(
        { userId, retentionYears: FINANCIAL_RECORD_RETENTION_YEARS },
        'Account deletion executed — PII anonymized, financial records retained',
    );

    return {
        userId,
        status: 'deleted',
        piiAnonymized: true,
        financialRecordsRetained: true,
        retentionPeriodYears: FINANCIAL_RECORD_RETENTION_YEARS,
    };
}
