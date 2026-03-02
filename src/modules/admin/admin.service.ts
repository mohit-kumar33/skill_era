import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { pool } from '../../config/database.js';
import { prisma } from '../../config/prisma.js';
import { runInTransaction } from '../../utils/transaction.js';
import { withRetry } from '../../utils/retry.js';
import { logger } from '../../utils/logger.js';
import {
    notFound,
    validationError,
    AppError,
    ERROR_CODES,
    twoFactorRequired,
    forbidden,
} from '../../utils/errors.js';
import { DUAL_APPROVAL_THRESHOLD } from '../../config/constants.js';
import type {
    ApproveWithdrawalInput,
    FraudFlagInput,
    ListWithdrawalsQuery,
} from './admin.schema.js';
import { executePayout } from '../wallet/payout.service.js';
import {
    notifyWithdrawalApproved,
    notifyWithdrawalRejected,
    notifyPayoutCompleted,
} from '../notification/notification.service.js';

// RBAC level check for admin safety
const ROLE_LEVEL: Record<string, number> = {
    user: 0,
    admin: 1,
    finance_admin: 2,
    super_admin: 3,
};

// ═══════════════════════════════════════════════════════════════════════
// 2FA VERIFICATION
// ═══════════════════════════════════════════════════════════════════════
//
// Uses a time-based OTP (TOTP) pattern.
// In this MVP, we simulate verification: a 6-digit code where the
// expected value is HMAC-SHA256(adminId + floor(Date.now()/30000))
// truncated to 6 digits. Production should use the `speakeasy` library
// with RFC 6238 TOTP for authenticator app compatibility.
//
// Financial Safety: 2FA is required for ALL payout trigger and retry
// operations. This prevents a stolen admin JWT from being used to
// immediately trigger a payout.
// ═══════════════════════════════════════════════════════════════════════

async function verifyTwoFactor(adminId: string, token: string): Promise<void> {
    if (!token || token.trim() === '') {
        throw twoFactorRequired();
    }

    // Fetch admin's 2FA secret
    const admin = await prisma.user.findUnique({
        where: { id: adminId },
        select: { twoFactorSecret: true, role: true },
    });

    if (!admin) throw notFound('Admin');

    // Finance admins MUST have a 2FA secret configured
    if (!admin.twoFactorSecret) {
        logger.error({ adminId }, '2FA secret not configured for finance admin');
        throw new AppError(
            ERROR_CODES.TWO_FACTOR_REQUIRED,
            '2FA is not configured for this account. Contact a SuperAdmin to set it up.',
            401,
        );
    }

    // Validate TOTP: accept current 30-second window ± 1 window for clock drift
    const isValid = validateTotp(admin.twoFactorSecret, token);
    if (!isValid) {
        logger.warn({ adminId, event: 'twofa_validation_failed' }, '2FA token rejected');
        throw new AppError(
            ERROR_CODES.TWO_FACTOR_REQUIRED,
            'Invalid or expired 2FA token.',
            401,
        );
    }
}

/**
 * Minimal TOTP validator (30-second window, ±1 drift).
 * Production: replace with `speakeasy.totp.verify()`.
 */
function validateTotp(secret: string, token: string): boolean {
    const windowSize = 30_000;
    const now = Date.now();

    for (const offset of [-1, 0, 1]) {
        const timeSlot = Math.floor((now + offset * windowSize) / windowSize);
        const expected = crypto
            .createHmac('sha256', secret)
            .update(String(timeSlot))
            .digest('hex')
            .slice(-6);  // Last 6 hex chars → 6-char "token"
        if (token === expected) return true;
    }
    return false;
}

// ═══════════════════════════════════════════════════════════════════════
// WITHDRAWAL APPROVAL QUEUE
// ═══════════════════════════════════════════════════════════════════════

export async function listWithdrawals(query: ListWithdrawalsQuery) {
    const where: any = {};
    if (query.status) where.status = query.status;

    const [withdrawals, total] = await Promise.all([
        prisma.withdrawal.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
            include: {
                user: {
                    select: {
                        id: true,
                        mobile: true,
                        kycStatus: true,
                        fraudScore: true,
                        accountStatus: true,
                    },
                },
            },
        }),
        prisma.withdrawal.count({ where }),
    ]);

    return {
        withdrawals: withdrawals.map(w => ({
            ...w,
            amount: w.amount.toString(),
            tdsAmount: w.tdsAmount.toString(),
            netAmount: w.netAmount?.toString() ?? null,
        })),
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
}

// ═══════════════════════════════════════════════════════════════════════
// APPROVE / REJECT WITHDRAWAL
// ═══════════════════════════════════════════════════════════════════════
//
// State Machine:
//   Requested ──→ UnderReview (first approval on dual-approval withdrawals)
//   Requested ──→ Approved    (single-approval withdrawals)
//   UnderReview ──→ Approved  (second approval on dual-approval)
//   Requested | UnderReview ──→ Rejected (any admin, triggers refund)
//
// Financial Safety on rejection:
//   Refund is performed atomically with a compensating INSERT into
//   wallet_transactions (never an UPDATE/DELETE). Balance is restored
//   with full balance_before / balance_after audit trail.
// ═══════════════════════════════════════════════════════════════════════

interface ApprovalResult {
    withdrawalId: string;
    status: string;
    requiresDualApproval: boolean;
    dualApprovalComplete: boolean;
}

export async function processWithdrawalApproval(
    adminId: string,
    input: ApproveWithdrawalInput,
): Promise<ApprovalResult> {
    const withdrawal = await prisma.withdrawal.findUnique({
        where: { id: input.withdrawalId },
        include: { user: { select: { mobile: true } } },
    });

    if (!withdrawal) throw notFound('Withdrawal');

    // ── REJECTION ─────────────────────────────────────────────────────
    if (input.action === 'reject') {
        return withRetry(async () => {
            return runInTransaction(pool, async (client: PoolClient) => {
                // Lock withdrawal — must be in a rejectable state
                const lockResult = await client.query(
                    `SELECT id, user_id, amount, status
                     FROM withdrawals
                     WHERE id = $1 AND status IN ('requested', 'under_review')
                     FOR UPDATE NOWAIT`,
                    [input.withdrawalId],
                );

                const w = lockResult.rows[0];
                if (!w) throw validationError('Withdrawal cannot be rejected in current status');

                // Compensating ledger entry — restore balance atomically
                // INSERT-only: never UPDATE the original debit entry.
                await client.query(
                    `WITH wallet_lock AS (
                        SELECT id, winning_balance FROM wallets
                        WHERE user_id = $1 FOR UPDATE NOWAIT
                     ),
                     wallet_credit AS (
                        UPDATE wallets
                        SET winning_balance = wallet_lock.winning_balance + $2::numeric,
                            updated_at = now()
                        FROM wallet_lock
                        WHERE wallets.id = wallet_lock.id
                        RETURNING wallets.id, wallet_lock.winning_balance AS old_balance,
                                  wallets.winning_balance AS new_balance
                     )
                     INSERT INTO wallet_transactions (
                       id, user_id, reference_id, transaction_type,
                       debit_amount, credit_amount,
                       balance_before, balance_after,
                       status, idempotency_key, description, created_at
                     )
                     SELECT
                       gen_random_uuid(), $1, $3::uuid, 'refund',
                       0, $2::numeric,
                       wc.old_balance, wc.new_balance,
                       'confirmed', 'refund-' || $3::text,
                       'Withdrawal rejected — balance restored',
                       now()
                     FROM wallet_credit wc`,
                    [w.user_id, w.amount, input.withdrawalId],
                );

                // Mark withdrawal as rejected (terminal state)
                await client.query(
                    `UPDATE withdrawals
                     SET status           = 'rejected',
                         admin_approved_by = $2,
                         admin_notes       = $3,
                         processed_at      = now(),
                         updated_at        = now()
                     WHERE id = $1`,
                    [input.withdrawalId, adminId, input.notes ?? null],
                );

                // Immutable audit log
                await client.query(
                    `INSERT INTO admin_logs (id, admin_id, action_type, target_user_id, metadata, created_at)
                     VALUES (gen_random_uuid(), $1, 'WITHDRAWAL_REJECTED', $2, $3::jsonb, now())`,
                    [adminId, w.user_id, JSON.stringify({
                        withdrawalId: input.withdrawalId,
                        amount: w.amount.toString(),
                        notes: input.notes,
                    })],
                );

                logger.info(
                    { adminId, withdrawalId: input.withdrawalId, action: 'reject' },
                    'Withdrawal rejected',
                );

                // Fire-and-forget user notification
                notifyWithdrawalRejected(
                    w.user_id, w.amount.toString(), input.withdrawalId, input.notes,
                ).catch(() => { });

                return {
                    withdrawalId: input.withdrawalId,
                    status: 'rejected',
                    requiresDualApproval: false,
                    dualApprovalComplete: false,
                };
            });
        });
    }

    // ── APPROVAL ──────────────────────────────────────────────────────
    const amount = Number(withdrawal.amount);
    const requiresDualApproval = amount >= parseFloat(DUAL_APPROVAL_THRESHOLD);

    const result = await withRetry(async () => {
        return runInTransaction(pool, async (client: PoolClient) => {
            if (requiresDualApproval) {
                if (!withdrawal.adminApprovedBy) {
                    // First approval: Requested → UnderReview
                    const r = await client.query(
                        `UPDATE withdrawals
                         SET status            = 'under_review',
                             admin_approved_by = $2,
                             admin_notes       = $3,
                             updated_at        = now()
                         WHERE id = $1 AND status = 'requested'
                         RETURNING id`,
                        [input.withdrawalId, adminId, input.notes ?? null],
                    );
                    if (!r.rows[0]) throw validationError('Withdrawal is not in requestable status');

                    await client.query(
                        `INSERT INTO admin_logs (id, admin_id, action_type, target_user_id, metadata, created_at)
                         VALUES (gen_random_uuid(), $1, 'WITHDRAWAL_FIRST_APPROVAL', $2, $3::jsonb, now())`,
                        [adminId, withdrawal.userId, JSON.stringify({
                            withdrawalId: input.withdrawalId,
                            amount: amount.toString(),
                        })],
                    );

                    return {
                        withdrawalId: input.withdrawalId,
                        status: 'under_review',
                        requiresDualApproval: true,
                        dualApprovalComplete: false,
                    };
                }

                // Second approval: UnderReview → Approved (different admin)
                if (withdrawal.adminApprovedBy === adminId) {
                    throw new AppError(
                        ERROR_CODES.FORBIDDEN,
                        'Dual approval requires two different admins',
                        403,
                    );
                }

                const r = await client.query(
                    `UPDATE withdrawals
                     SET status           = 'approved',
                         dual_approved_by = $2,
                         processed_at     = now(),
                         updated_at       = now()
                     WHERE id = $1 AND status = 'under_review'
                           AND admin_approved_by IS NOT NULL AND admin_approved_by != $2
                     RETURNING id`,
                    [input.withdrawalId, adminId],
                );
                if (!r.rows[0]) throw validationError('Cannot process second approval');

                await client.query(
                    `INSERT INTO admin_logs (id, admin_id, action_type, target_user_id, metadata, created_at)
                     VALUES (gen_random_uuid(), $1, 'WITHDRAWAL_DUAL_APPROVED', $2, $3::jsonb, now())`,
                    [adminId, withdrawal.userId, JSON.stringify({
                        withdrawalId: input.withdrawalId,
                        amount: amount.toString(),
                        firstApprover: withdrawal.adminApprovedBy,
                    })],
                );

                return {
                    withdrawalId: input.withdrawalId,
                    status: 'approved',
                    requiresDualApproval: true,
                    dualApprovalComplete: true,
                };
            }

            // Single-approval: Requested → Approved
            const r = await client.query(
                `UPDATE withdrawals
                 SET status            = 'approved',
                     admin_approved_by = $2,
                     admin_notes       = $3,
                     processed_at      = now(),
                     updated_at        = now()
                 WHERE id = $1 AND status = 'requested'
                 RETURNING id`,
                [input.withdrawalId, adminId, input.notes ?? null],
            );
            if (!r.rows[0]) throw validationError('Withdrawal is not in requestable status');

            await client.query(
                `INSERT INTO admin_logs (id, admin_id, action_type, target_user_id, metadata, created_at)
                 VALUES (gen_random_uuid(), $1, 'WITHDRAWAL_APPROVED', $2, $3::jsonb, now())`,
                [adminId, withdrawal.userId, JSON.stringify({
                    withdrawalId: input.withdrawalId,
                    amount: amount.toString(),
                })],
            );

            return {
                withdrawalId: input.withdrawalId,
                status: 'approved',
                requiresDualApproval: false,
                dualApprovalComplete: false,
            };
        });
    });

    // Fire-and-forget approval notification (outside transaction)
    if (result.status === 'approved') {
        notifyWithdrawalApproved(
            withdrawal.userId, withdrawal.amount.toString(), input.withdrawalId,
        ).catch(() => { });
    }

    return result;
}

// ═══════════════════════════════════════════════════════════════════════
// TRIGGER PAYOUT  (admin-initiated)
// ═══════════════════════════════════════════════════════════════════════
//
// Security Controls:
//   1. RBAC:   Caller must be finance_admin or super_admin (enforced in route).
//   2. 2FA:    TOTP token validated before any execution.
//   3. Audit:  Immutable AdminLog entry written with action=PAYOUT_EXECUTED,
//              ip_address, admin_id, and withdrawal_id.
//   4. Concurrency: executePayout() uses FOR UPDATE NOWAIT + payout_reference_id
//              unique constraint → only one succeeds under simultaneous calls.
// ═══════════════════════════════════════════════════════════════════════

export async function triggerPayout(
    adminId: string,
    withdrawalId: string,
    ipAddress: string,
    twoFactorToken: string,
) {
    // Step 1: Verify 2FA BEFORE touching any financial data
    await verifyTwoFactor(adminId, twoFactorToken);

    // Step 2: Fetch withdrawal to get target user for audit
    const withdrawal = await prisma.withdrawal.findUnique({
        where: { id: withdrawalId },
        select: { userId: true, status: true, amount: true },
    });
    if (!withdrawal) throw notFound('Withdrawal');

    // Step 3: Write immutable PAYOUT_EXECUTED audit log (before execution)
    await prisma.adminLog.create({
        data: {
            adminId,
            actionType: 'PAYOUT_EXECUTED',
            targetUserId: withdrawal.userId,
            ipAddress,
            metadata: {
                withdrawalId,
                triggeredAt: new Date().toISOString(),
            },
        },
    });

    logger.info(
        {
            event: 'payout_started',
            adminId,
            withdrawalId,
            ipAddress,
            withdrawalStatus: withdrawal.status,
        },
        'Admin triggered payout',
    );

    // Step 4: Execute payout (contains its own state machine + fraud revalidation)
    const result = await executePayout(withdrawalId, adminId, ipAddress);

    // Step 5: Append success outcome to audit trail
    await prisma.adminLog.create({
        data: {
            adminId,
            actionType: 'PAYOUT_SUCCESS',
            targetUserId: withdrawal.userId,
            ipAddress,
            metadata: {
                withdrawalId,
                gatewayTransactionId: result.gatewayTransactionId,
                payoutReferenceId: result.payoutReferenceId,
                idempotentReplay: result.idempotentReplay,
            },
        },
    });

    logger.info(
        {
            event: 'payout_success',
            adminId,
            withdrawalId,
            gatewayTransactionId: result.gatewayTransactionId,
        },
        'Admin payout completed',
    );

    // Fire-and-forget user notification
    notifyPayoutCompleted(
        withdrawal.userId, withdrawal.amount.toString(), withdrawalId,
    ).catch(() => { });

    return result;
}

// ═══════════════════════════════════════════════════════════════════════
// RETRY FAILED PAYOUT
// ═══════════════════════════════════════════════════════════════════════
//
// State Machine transition allowed here:
//   'failed' ──→ 'approved'  (admin explicit retry only)
//
// Financial Safety:
//   • Balance was NOT refunded when payout failed — it remains deducted.
//   • This function resets the withdrawal to 'approved' and clears
//     payoutReferenceId so a fresh idempotency UUID can be claimed.
//   • Requires 2FA + financeAdmin role (same as triggerPayout).
//   • Requires fresh 2FA token (prevents stale session replay).
// ═══════════════════════════════════════════════════════════════════════

export async function retryFailedPayout(
    adminId: string,
    withdrawalId: string,
    ipAddress: string,
    twoFactorToken: string,
) {
    // Step 1: 2FA verification (required — same as initial trigger)
    await verifyTwoFactor(adminId, twoFactorToken);

    // Step 2: Atomically reset failed → approved and clear payoutReferenceId
    const updated = await withRetry(async () => {
        return runInTransaction(pool, async (client: PoolClient) => {
            const result = await client.query(
                `UPDATE withdrawals
                 SET status             = 'approved',
                     payout_reference_id = NULL,
                     payout_error        = NULL,
                     updated_at          = now()
                 WHERE id = $1 AND status = 'failed'
                 RETURNING id, user_id`,
                [withdrawalId],
            );

            if (!result.rows[0]) {
                throw validationError(
                    `Cannot retry payout: withdrawal is not in 'failed' status.`,
                );
            }

            const row = result.rows[0];

            // Immutable audit log for the transition
            await client.query(
                `INSERT INTO admin_logs (id, admin_id, action_type, target_user_id, metadata, created_at)
                 VALUES (gen_random_uuid(), $1, 'PAYOUT_RETRY_APPROVED', $2, $3::jsonb, now())`,
                [adminId, row.user_id, JSON.stringify({ withdrawalId, ipAddress })],
            );

            return row;
        });
    });

    logger.info(
        {
            event: 'payout_started',
            adminId,
            withdrawalId,
            ipAddress,
            note: 'retry_of_failed_payout',
        },
        'Admin retrying failed payout — transitioning failed → approved',
    );

    // Step 3: Re-execute payout with fresh idempotency UUID
    const result = await executePayout(withdrawalId, adminId, ipAddress);

    // Audit success
    await prisma.adminLog.create({
        data: {
            adminId,
            actionType: 'PAYOUT_RETRY_SUCCESS',
            targetUserId: updated.user_id,
            ipAddress,
            metadata: {
                withdrawalId,
                gatewayTransactionId: result.gatewayTransactionId,
                payoutReferenceId: result.payoutReferenceId,
            },
        },
    });

    return result;
}

// ═══════════════════════════════════════════════════════════════════════
// FRAUD FLAGS
// ═══════════════════════════════════════════════════════════════════════

export async function addFraudFlag(adminId: string, input: FraudFlagInput) {
    const [flag] = await prisma.$transaction([
        prisma.fraudFlag.create({
            data: {
                userId: input.userId,
                flagType: input.flagType,
                riskPoints: input.riskPoints,
                description: input.description,
            },
        }),
        prisma.user.update({
            where: { id: input.userId },
            data: { fraudScore: { increment: input.riskPoints } },
        }),
        prisma.adminLog.create({
            data: {
                adminId,
                actionType: 'FRAUD_FLAG_ADDED',
                targetUserId: input.userId,
                metadata: {
                    flagType: input.flagType,
                    riskPoints: input.riskPoints,
                    description: input.description,
                },
            },
        }),
    ]);

    logger.info(
        { adminId, userId: input.userId, flagType: input.flagType },
        'Fraud flag added',
    );

    return flag;
}

// ═══════════════════════════════════════════════════════════════════════
// TREASURY DASHBOARD
// ═══════════════════════════════════════════════════════════════════════

export async function getTreasurySnapshot() {
    const client = await pool.connect();
    try {
        const result = await client.query(`
          SELECT
            COALESCE(SUM(deposit_balance + winning_balance + bonus_balance), 0) AS total_user_balance,
            (SELECT COALESCE(SUM(amount), 0) FROM withdrawals
             WHERE status IN ('requested', 'under_review', 'approved', 'failed')) AS pending_withdrawals,
            CASE
              WHEN (SELECT COALESCE(SUM(amount), 0) FROM withdrawals
                    WHERE status IN ('requested', 'under_review', 'approved', 'failed')) > 0
              THEN (COALESCE(SUM(deposit_balance + winning_balance + bonus_balance), 0)) /
                   (SELECT COALESCE(SUM(amount), 0) FROM withdrawals
                    WHERE status IN ('requested', 'under_review', 'approved', 'failed'))
              ELSE 999
            END AS liquidity_ratio
          FROM wallets
        `);

        const row = result.rows[0];
        return {
            totalUserBalance: row?.total_user_balance?.toString() ?? '0',
            pendingWithdrawals: row?.pending_withdrawals?.toString() ?? '0',
            liquidityRatio: parseFloat(row?.liquidity_ratio ?? '999').toFixed(4),
            timestamp: new Date().toISOString(),
        };
    } finally {
        client.release();
    }
}

export async function getAdminAuditLog(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
        prisma.adminLog.findMany({
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
                admin: { select: { id: true, mobile: true } },
                targetUser: { select: { id: true, mobile: true } },
            },
        }),
        prisma.adminLog.count(),
    ]);

    return {
        logs,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

// ═══════════════════════════════════════════════════════════════════════
// ADMIN USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

interface ListUsersQuery {
    page: number;
    limit: number;
    search?: string;
    status?: string;
}

export async function listUsers(query: ListUsersQuery) {
    const where: Record<string, unknown> = {};

    if (query.status) {
        where.accountStatus = query.status;
    }

    if (query.search) {
        where.OR = [
            { mobile: { contains: query.search } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { id: query.search.length === 36 ? query.search : undefined },
        ].filter(Boolean);
    }

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
            select: {
                id: true,
                mobile: true,
                email: true,
                accountStatus: true,
                kycStatus: true,
                fraudScore: true,
                role: true,
                state: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
        prisma.user.count({ where }),
    ]);

    return {
        users,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
}

type AccountAction = 'suspend' | 'ban' | 'unfreeze';

export async function setUserStatus(
    adminId: string,
    targetUserId: string,
    action: AccountAction,
) {
    const statusMap: Record<AccountAction, string> = {
        suspend: 'suspended',
        ban: 'banned',
        unfreeze: 'active',
    };

    const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, accountStatus: true, role: true },
    });
    if (!user) throw notFound('User');

    // Prevent admins from modifying other admins (safety)
    const targetLevel = ROLE_LEVEL[user.role as keyof typeof ROLE_LEVEL] ?? 0;
    if (targetLevel >= 1) {
        throw new AppError(ERROR_CODES.FORBIDDEN, 'Cannot modify admin accounts via this endpoint', 403);
    }

    const newStatus = statusMap[action];

    const [updated] = await prisma.$transaction([
        prisma.user.update({
            where: { id: targetUserId },
            data: { accountStatus: newStatus as 'active' | 'suspended' | 'frozen' | 'banned' },
            select: { id: true, mobile: true, accountStatus: true },
        }),
        prisma.adminLog.create({
            data: {
                adminId,
                actionType: `USER_${action.toUpperCase()}`,
                targetUserId,
                metadata: {
                    previousStatus: user.accountStatus,
                    newStatus,
                },
            },
        }),
    ]);

    logger.info(
        { adminId, targetUserId, action, newStatus },
        `User ${action}`,
    );

    return updated;
}

// ═══════════════════════════════════════════════════════════════════════
// ADMIN KYC MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════

interface ListKycQuery {
    page: number;
    limit: number;
    status?: string;
}

export async function listKycSubmissions(query: ListKycQuery) {
    const where: Record<string, unknown> = {};

    if (query.status) {
        where.kycStatus = query.status;
    } else {
        // Default: show only submitted (pending review)
        where.kycStatus = 'submitted';
    }

    // Only show users who have actually submitted KYC docs
    where.kycDocType = { not: null };

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            skip: (query.page - 1) * query.limit,
            take: query.limit,
            select: {
                id: true,
                mobile: true,
                email: true,
                kycStatus: true,
                kycDocType: true,
                kycDocNumber: true,
                kycDocUrl: true,
                fraudScore: true,
                createdAt: true,
                updatedAt: true,
            },
        }),
        prisma.user.count({ where }),
    ]);

    return {
        submissions: users,
        pagination: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.ceil(total / query.limit),
        },
    };
}

export async function verifyKycAdmin(
    adminId: string,
    userId: string,
    action: 'approve' | 'reject',
    reason?: string,
) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, kycStatus: true, kycDocType: true },
    });
    if (!user) throw notFound('User');

    if (user.kycStatus !== 'submitted') {
        throw validationError(`Cannot verify KYC in status: ${user.kycStatus}`);
    }

    const newStatus = action === 'approve' ? 'verified' : 'rejected';

    const [updated] = await prisma.$transaction([
        prisma.user.update({
            where: { id: userId },
            data: { kycStatus: newStatus as 'verified' | 'rejected' },
            select: { id: true, kycStatus: true },
        }),
        prisma.adminLog.create({
            data: {
                adminId,
                actionType: `KYC_${action.toUpperCase()}`,
                targetUserId: userId,
                metadata: { reason: reason ?? null, docType: user.kycDocType },
            },
        }),
    ]);

    logger.info({ adminId, userId, action }, 'KYC verified by admin');
    return updated;
}

// ═══════════════════════════════════════════════════════════════════════
// DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════════

export async function getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
        totalUsers,
        activeTournaments,
        pendingWithdrawals,
        todayDeposits,
    ] = await Promise.all([
        prisma.user.count(),
        prisma.tournament.count({ where: { status: { in: ['open', 'in_progress'] } } }),
        prisma.withdrawal.count({ where: { status: { in: ['requested', 'under_review'] } } }),
        prisma.deposit.aggregate({
            where: {
                status: 'confirmed',
                createdAt: { gte: today },
            },
            _sum: { amount: true },
        }),
    ]);

    return {
        totalUsers,
        activeTournaments,
        pendingWithdrawals,
        revenueToday: todayDeposits._sum.amount?.toString() ?? '0',
    };
}
