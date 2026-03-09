import type { PoolClient } from 'pg';
import { pool } from '../../config/database.js';
import { prisma } from '../../config/prisma.js';
import { runInTransaction } from '../../utils/transaction.js';
import { withRetry } from '../../utils/retry.js';
import { logger } from '../../utils/logger.js';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { env } from '../../config/env.js';
import { BCRYPT_ROUNDS } from '../../config/constants.js';
import {
    insufficientBalance,
    kycRequired,
    cooldownActive,
    accountFrozen,
    duplicateRequest,
    notFound,
    unauthorized,
    AppError,
    ERROR_CODES,
} from '../../utils/errors.js';
import {
    WITHDRAWAL_COOLDOWN_HOURS,
    FRAUD_AUTO_FREEZE_THRESHOLD,
    MAX_WITHDRAWALS_PER_DAY,
} from '../../config/constants.js';
import { calculateTds } from './tds.service.js';
import { runAmlChecks } from '../../middleware/amlDetection.js';
import { notifyWithdrawalRequested } from '../notification/notification.service.js';
import type { DepositInitiateInput, WithdrawRequestInput } from './wallet.schema.js';
import { createCashfreeOrder } from '../../utils/cashfree.js';

// ═══════════════════════════════════════════════════════
// DEPOSIT INITIATION
// ═══════════════════════════════════════════════════════

interface DepositResult {
    depositId: string;
    amount: string;
    status: string;
    idempotencyKey: string;
    paymentUrl?: string;
}

/**
 * Initiate a deposit — creates a pending deposit record.
 * The actual balance credit happens in the webhook handler.
 * Uses Prisma (non-financial CRUD — no balance mutation yet).
 */
export async function initiateDeposit(
    userId: string,
    input: DepositInitiateInput,
): Promise<DepositResult> {
    // Check user status
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { accountStatus: true },
    });
    if (!user) throw notFound('User');
    if (user.accountStatus !== 'active') throw accountFrozen();

    // Idempotency: check if this key already exists
    const existing = await prisma.deposit.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing) {
        return {
            depositId: existing.id,
            amount: existing.amount.toString(),
            status: existing.status,
            idempotencyKey: existing.idempotencyKey,
        };
    }

    const deposit = await prisma.deposit.create({
        data: {
            userId,
            amount: input.amount,
            status: 'initiated',
            idempotencyKey: input.idempotencyKey,
        },
    });

    logger.info({ userId, depositId: deposit.id, amount: input.amount }, 'Deposit record created');

    let paymentUrl = '';
    try {
        paymentUrl = await createCashfreeOrder({
            orderId: deposit.id,
            amount: Number(input.amount),
            customerId: userId,
            customerPhone: '9999999999', // Can be fetched from user record if needed
        });
    } catch (error) {
        // If Cashfree fails, mark deposit as failed
        await prisma.deposit.update({
            where: { id: deposit.id },
            data: { status: 'failed' },
        });
        throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Payment gateway initialization failed', 500);
    }

    // Optionally update deposit with session id (if needed) but we return it to client
    logger.info({ userId, depositId: deposit.id, paymentUrl }, 'Deposit initiated');

    return {
        depositId: deposit.id,
        amount: deposit.amount.toString(),
        status: deposit.status,
        idempotencyKey: deposit.idempotencyKey,
        paymentUrl,
    };
}

// ═══════════════════════════════════════════════════════
// DEPOSIT CONFIRMATION (called by webhook)
// ═══════════════════════════════════════════════════════

interface DepositConfirmResult {
    success: boolean;
    depositId: string;
    newBalance: string;
}

/**
 * Confirm a deposit — atomic CTE that:
 * 1. Locks the wallet row (FOR UPDATE NOWAIT)
 * 2. Updates the deposit_balance
 * 3. Inserts an immutable ledger entry
 * 4. Marks the deposit as confirmed
 *
 * Uses READ COMMITTED + FOR UPDATE NOWAIT (deadlock-safe).
 */
export async function confirmDeposit(
    depositId: string,
    gatewayTransactionId: string,
    webhookAmount: string,
): Promise<DepositConfirmResult> {
    return withRetry(async () => {
        return runInTransaction(pool, async (client: PoolClient) => {
            // Step 1: Lock deposit row and validate
            const depositResult = await client.query(
                `SELECT id, user_id, amount, status, idempotency_key
         FROM deposits
         WHERE id = $1
         FOR UPDATE NOWAIT`,
                [depositId],
            );

            const deposit = depositResult.rows[0];
            if (!deposit) throw notFound('Deposit');

            // Idempotent: already confirmed
            if (deposit.status === 'confirmed') {
                const walletResult = await client.query(
                    `SELECT deposit_balance FROM wallets WHERE user_id = $1`,
                    [deposit.user_id],
                );
                return {
                    success: true,
                    depositId: deposit.id,
                    newBalance: walletResult.rows[0]?.deposit_balance?.toString() ?? '0',
                };
            }

            if (deposit.status !== 'initiated') {
                throw new AppError(ERROR_CODES.VALIDATION_ERROR, `Deposit is ${deposit.status}`, 400);
            }

            // Amount mismatch check
            if (deposit.amount.toString() !== webhookAmount) {
                logger.error(
                    { depositId, expected: deposit.amount.toString(), received: webhookAmount },
                    'Deposit amount mismatch',
                );
                throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Amount mismatch', 400);
            }

            // Step 2: Atomic CTE — lock wallet, credit, insert ledger entry
            const cteResult = await client.query(
                `WITH wallet_lock AS (
          SELECT id, user_id, deposit_balance
          FROM wallets
          WHERE user_id = $1
          FOR UPDATE NOWAIT
        ),
        wallet_update AS (
          UPDATE wallets
          SET deposit_balance = wallet_lock.deposit_balance + $2::numeric,
              updated_at = now()
          FROM wallet_lock
          WHERE wallets.id = wallet_lock.id
          RETURNING wallets.id, wallets.deposit_balance AS new_balance,
                    wallet_lock.deposit_balance AS old_balance
        ),
        ledger_insert AS (
          INSERT INTO wallet_transactions (
            id, user_id, reference_id, transaction_type,
            debit_amount, credit_amount,
            balance_before, balance_after,
            status, idempotency_key, description, created_at
          )
          SELECT
            gen_random_uuid(),
            $1,
            $3::uuid,
            'deposit',
            0,
            $2::numeric,
            wu.old_balance,
            wu.new_balance,
            'confirmed',
            $4,
            'Deposit via payment gateway',
            now()
          FROM wallet_update wu
          RETURNING id
        )
        SELECT
          wu.new_balance,
          li.id AS ledger_id
        FROM wallet_update wu, ledger_insert li`,
                [deposit.user_id, webhookAmount, depositId, deposit.idempotency_key],
            );

            if (!cteResult.rows[0]) {
                throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Wallet not found for user', 500);
            }

            // Step 3: Mark deposit as confirmed
            await client.query(
                `UPDATE deposits
         SET status = 'confirmed',
             gateway_transaction_id = $2,
             updated_at = now()
         WHERE id = $1`,
                [depositId, gatewayTransactionId],
            );

            const newBalance = cteResult.rows[0].new_balance.toString();

            logger.info(
                { depositId, userId: deposit.user_id, amount: webhookAmount, newBalance },
                'Deposit confirmed',
            );

            return { success: true, depositId, newBalance };
        });
    });
}

// ═══════════════════════════════════════════════════════
// WITHDRAWAL REQUEST & OTP
// ═══════════════════════════════════════════════════════

/**
 * Generates an OTP for withdrawal verification and sends it to the user.
 * Returns a short-lived pre-auth token required for the actual withdrawal request.
 */
export async function generateWithdrawalOtp(userId: string): Promise<{ preAuthToken: string }> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, mobile: true, email: true },
    });
    if (!user) throw notFound('User');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, BCRYPT_ROUNDS);
    const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.user.update({
        where: { id: user.id },
        data: { currentOtp: hashedOtp, otpExpiry: expiry },
    });

    const otpTarget = user.email || user.mobile || 'unknown';
    logger.info(`[MOCK WITHDRAW OTP] Sending OTP ${otp} to ${otpTarget}`);
    console.log(`\n=========================================\n[MOCK WITHDRAW OTP] OTP for ${otpTarget}: ${otp}\n=========================================\n`);

    const preAuthToken = jwt.sign(
        { userId: user.id, type: 'withdraw_otp' },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '5m' }
    );

    return { preAuthToken };
}

interface WithdrawalResult {
    withdrawalId: string;
    amount: string;
    tdsAmount: string;
    netAmount: string;
    status: string;
}

/**
 * Request a withdrawal — validates all preconditions then atomically
 * deducts balance and creates a pending withdrawal.
 *
 * Preconditions checked:
 * 1. Account is active
 * 2. KYC is verified
 * 3. No 24-hour deposit cooldown
 * 4. Fraud score below threshold
 * 5. Sufficient winning_balance
 * 6. No other pending withdrawal
 */
export async function requestWithdrawal(
    userId: string,
    input: WithdrawRequestInput,
): Promise<WithdrawalResult> {
    // ── Pre-checks (read-only, no locks needed) ─────────

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            accountStatus: true,
            kycStatus: true,
            fraudScore: true,
            currentOtp: true,
            otpExpiry: true,
        },
    });
    if (!user) throw notFound('User');

    // ── OTP Verification ──
    let decoded: JwtPayload & { type: string, userId: string };
    try {
        decoded = jwt.verify(input.preAuthToken, env.JWT_ACCESS_SECRET) as JwtPayload & { type: string, userId: string };
    } catch {
        throw unauthorized('Pre-auth token expired or invalid. Please request a new OTP.');
    }

    if (decoded.type !== 'withdraw_otp' || decoded.userId !== userId) {
        throw unauthorized('Invalid token for withdrawal verification');
    }

    if (!user.currentOtp || !user.otpExpiry || user.otpExpiry < new Date()) {
        throw unauthorized('OTP has expired or was not requested. Please request a new OTP.');
    }

    const isValidOtp = await bcrypt.compare(input.otp, user.currentOtp);
    if (!isValidOtp) {
        throw unauthorized('Invalid OTP');
    }

    if (user.accountStatus !== 'active') throw accountFrozen();
    if (user.kycStatus !== 'verified') throw kycRequired();

    if (user.fraudScore >= FRAUD_AUTO_FREEZE_THRESHOLD) {
        throw new AppError(ERROR_CODES.FRAUD_DETECTED, 'Account flagged for security review', 403);
    }

    // Check for 24-hour cooldown after last deposit
    const recentDeposit = await prisma.deposit.findFirst({
        where: {
            userId,
            status: 'confirmed',
            createdAt: {
                gte: new Date(Date.now() - WITHDRAWAL_COOLDOWN_HOURS * 60 * 60 * 1000),
            },
        },
    });
    if (recentDeposit) throw cooldownActive();

    // Velocity check: max N withdrawals per 24 hours
    // Uses index on withdrawals(user_id, created_at) for performance
    const recentWithdrawalCount = await prisma.withdrawal.count({
        where: {
            userId,
            createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
            },
        },
    });
    if (recentWithdrawalCount >= MAX_WITHDRAWALS_PER_DAY) {
        throw new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            `Maximum ${MAX_WITHDRAWALS_PER_DAY} withdrawals allowed per 24 hours`,
            429,
        );
    }

    // Check for existing pending withdrawal
    const pendingWithdrawal = await prisma.withdrawal.findFirst({
        where: {
            userId,
            status: { in: ['requested', 'under_review', 'approved'] },
        },
    });
    if (pendingWithdrawal) {
        throw new AppError(
            ERROR_CODES.DUPLICATE_REQUEST,
            'You already have a pending withdrawal',
            400,
        );
    }

    // Calculate TDS
    const tds = await calculateTds(userId, input.amount);

    // ── Atomic deduction (raw pg + CTE) ─────────────────
    return withRetry(async () => {
        return runInTransaction(pool, async (client: PoolClient) => {
            // Check if user still exists within transaction
            await client.query(`UPDATE users SET current_otp = NULL, otp_expiry = NULL WHERE id = $1`, [userId]);

            // CTE: lock wallet → check balance → deduct → insert ledger → create withdrawal
            const result = await client.query(
                `WITH wallet_lock AS (
          SELECT id, user_id, winning_balance
          FROM wallets
          WHERE user_id = $1
          FOR UPDATE NOWAIT
        ),
        balance_check AS (
          SELECT *
          FROM wallet_lock
          WHERE winning_balance >= $2::numeric
        ),
        wallet_deduct AS (
          UPDATE wallets
          SET winning_balance = bc.winning_balance - $2::numeric,
              updated_at = now()
          FROM balance_check bc
          WHERE wallets.id = bc.id
          RETURNING wallets.id,
                    bc.winning_balance AS old_balance,
                    wallets.winning_balance AS new_balance
        ),
        ledger_insert AS (
          INSERT INTO wallet_transactions (
            id, user_id, reference_id, transaction_type,
            debit_amount, credit_amount,
            balance_before, balance_after,
            status, idempotency_key, description, created_at
          )
          SELECT
            gen_random_uuid(),
            $1,
            NULL,
            'withdrawal',
            $2::numeric,
            0,
            wd.old_balance,
            wd.new_balance,
            'pending',
            $3,
            'Withdrawal request',
            now()
          FROM wallet_deduct wd
          RETURNING id
        ),
        withdrawal_insert AS (
          INSERT INTO withdrawals (
            id, user_id, amount, status,
            fraud_score_snapshot, tds_amount, net_amount,
            idempotency_key, payout_method, payout_details, created_at
          )
          SELECT
            gen_random_uuid(),
            $1,
            $2::numeric,
            'requested',
            $4::int,
            $5::numeric,
            $6::numeric,
            $3,
            $7,
            $8::json,
            now()
          FROM wallet_deduct wd
          RETURNING id, amount, tds_amount, net_amount, status
        )
        SELECT
          wi.id AS withdrawal_id,
          wi.amount,
          wi.tds_amount,
          wi.net_amount,
          wi.status,
          wd.new_balance
        FROM withdrawal_insert wi, wallet_deduct wd`,
                [
                    userId,
                    input.amount,
                    input.idempotencyKey,
                    user.fraudScore,
                    tds.tdsAmount,
                    tds.netPayable,
                    input.payoutMethod,
                    JSON.stringify({
                        bankAccount: input.bankAccount,
                        ifsc: input.ifsc,
                        upiId: input.upiId
                    }),
                ],
            );

            if (!result.rows[0]) {
                throw insufficientBalance();
            }

            const row = result.rows[0];

            logger.info(
                {
                    userId,
                    withdrawalId: row.withdrawal_id,
                    amount: input.amount,
                    tds: tds.tdsAmount,
                    net: tds.netPayable,
                },
                'Withdrawal requested',
            );

            // Fire-and-forget AML checks — never blocks withdrawal flow
            runAmlChecks(userId, input.amount).catch(() => { });

            // Fire-and-forget user notification
            notifyWithdrawalRequested(
                userId,
                row.amount.toString(),
                row.net_amount.toString(),
                row.tds_amount.toString(),
                row.withdrawal_id,
            ).catch(() => { });

            return {
                withdrawalId: row.withdrawal_id,
                amount: row.amount.toString(),
                tdsAmount: row.tds_amount.toString(),
                netAmount: row.net_amount.toString(),
                status: row.status,
            };
        });
    });
}

// ═══════════════════════════════════════════════════════
// BALANCE & HISTORY
// ═══════════════════════════════════════════════════════

export async function getBalance(userId: string) {
    const wallet = await prisma.wallet.findUnique({
        where: { userId },
        select: {
            depositBalance: true,
            winningBalance: true,
            bonusBalance: true,
        },
    });

    if (!wallet) throw notFound('Wallet');

    return {
        depositBalance: wallet.depositBalance.toString(),
        winningBalance: wallet.winningBalance.toString(),
        bonusBalance: wallet.bonusBalance.toString(),
        totalBalance: (
            Number(wallet.depositBalance) +
            Number(wallet.winningBalance) +
            Number(wallet.bonusBalance)
        ).toFixed(2),
    };
}

export async function getTransactionHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
) {
    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
        prisma.walletTransaction.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: {
                id: true,
                transactionType: true,
                debitAmount: true,
                creditAmount: true,
                balanceBefore: true,
                balanceAfter: true,
                status: true,
                description: true,
                createdAt: true,
            },
        }),
        prisma.walletTransaction.count({ where: { userId } }),
    ]);

    return {
        transactions: transactions.map(t => ({
            ...t,
            debitAmount: t.debitAmount.toString(),
            creditAmount: t.creditAmount.toString(),
            balanceBefore: t.balanceBefore.toString(),
            balanceAfter: t.balanceAfter.toString(),
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}

export async function getWithdrawalHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
) {
    const skip = (page - 1) * limit;

    const [withdrawals, total] = await Promise.all([
        prisma.withdrawal.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            select: {
                id: true,
                amount: true,
                tdsAmount: true,
                netAmount: true,
                status: true,
                payoutMethod: true,
                payoutDetails: true,
                payoutError: true,
                createdAt: true,
                processedAt: true,
            },
        }),
        prisma.withdrawal.count({ where: { userId } }),
    ]);

    return {
        withdrawals: withdrawals.map(w => ({
            ...w,
            amount: w.amount.toString(),
            tdsAmount: w.tdsAmount.toString(),
            netAmount: w.netAmount?.toString() ?? null,
            // Exclude sensitive numbers if necessary, but returning them since it's the user's own data
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
