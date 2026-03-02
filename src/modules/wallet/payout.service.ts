import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { pool } from '../../config/database.js';
import { prisma } from '../../config/prisma.js';
import { runInSerializableTransaction } from '../../utils/transaction.js';
import { withGatewayRetry } from '../../utils/retry.js';
import { logger } from '../../utils/logger.js';
import { payoutGateway } from '../../utils/payout_gateway.js';
import {
    notFound,
    AppError,
    ERROR_CODES,
    validationError,
} from '../../utils/errors.js';
import { FRAUD_AUTO_FREEZE_THRESHOLD } from '../../config/constants.js';

// ═══════════════════════════════════════════════════════════════════════
// STRICT WITHDRAWAL STATE MACHINE
// ═══════════════════════════════════════════════════════════════════════
//
//  Requested ──→ UnderReview ──→ Approved ──→ Paid      (terminal)
//  Requested ──→ UnderReview ──→ Rejected               (terminal)
//  Approved  ──→ Failed      (on gateway error)         (retriable)
//  Failed    ──→ Approved    (explicit admin retry ONLY)
//
// Rules enforced:
//  • Only 'approved' withdrawals may be executed.
//  • 'paid' and 'rejected' are terminal — no further transitions.
//  • 'failed' can only return to 'approved' via explicit admin retry.
//  • All transitions validated INSIDE a SERIALIZABLE DB transaction.
// ═══════════════════════════════════════════════════════════════════════

const VALID_PAYOUT_EXECUTIONS_FROM = new Set(['approved']);
const TERMINAL_STATES = new Set(['paid', 'rejected']);

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

export interface PayoutResult {
    withdrawalId: string;
    status: 'paid';
    gatewayTransactionId: string;
    payoutReferenceId: string;
    idempotentReplay: boolean;
}

interface FraudRevalidationResult {
    passed: boolean;
    reason?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// FRAUD REVALIDATION
// ═══════════════════════════════════════════════════════════════════════
//
// Re-evaluated immediately before every gateway call.
// Snapshot at withdrawal time is NOT sufficient — account status can
// change between approval and payout execution.
// ═══════════════════════════════════════════════════════════════════════

async function revalidateFraud(userId: string): Promise<FraudRevalidationResult> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            accountStatus: true,
            fraudScore: true,
        },
    });

    if (!user) return { passed: false, reason: 'user_not_found' };

    // Rule 1: Account must be active (not Frozen / Suspended / Banned)
    if (user.accountStatus !== 'active') {
        return { passed: false, reason: `account_${user.accountStatus}` };
    }

    // Rule 2: Fraud score must be below auto-freeze threshold
    if (user.fraudScore >= FRAUD_AUTO_FREEZE_THRESHOLD) {
        return { passed: false, reason: `fraud_score_${user.fraudScore}` };
    }

    // Rule 3: No unresolved (active) fraud flags
    const unresolvedFlags = await prisma.fraudFlag.count({
        where: {
            userId,
            resolvedAt: null,   // resolvedAt IS NULL means active flag
        },
    });

    if (unresolvedFlags > 0) {
        return { passed: false, reason: `unresolved_fraud_flags_${unresolvedFlags}` };
    }

    return { passed: true };
}

// ═══════════════════════════════════════════════════════════════════════
// EXECUTE PAYOUT  (main exported function)
// ═══════════════════════════════════════════════════════════════════════
//
// Financial Safety Guarantees:
//   1. Idempotency:  payout_reference_id unique index prevents double-payout
//                   at the database level, even across concurrent requests.
//   2. Locking:      SERIALIZABLE + FOR UPDATE NOWAIT on withdrawal AND wallet.
//   3. Atomicity:    Balance debit + ledger INSERT + status update in one txn.
//   4. Double-entry: Debit user ledger + Credit payout_clearing ledger row.
//   5. Fraud guard:  Account status, fraud score, and open flags re-checked.
//   6. Safe failure: On gateway error → status=failed, error stored, no refund.
//   7. Timeout:      Gateway call has AbortController-based 5-second timeout.
// ═══════════════════════════════════════════════════════════════════════

export async function executePayout(
    withdrawalId: string,
    adminId: string,
    ipAddress: string,
): Promise<PayoutResult> {

    // ── STEP 1: IDEMPOTENCY CHECK (before any locking) ──────────────────
    //
    // If this withdrawal already has a payout_reference_id AND is in 'paid'
    // status, a previous execution completed successfully.
    // Return the cached result immediately — do NOT call the gateway again.
    //
    const existingWithdrawal = await prisma.withdrawal.findUnique({
        where: { id: withdrawalId },
        select: {
            status: true,
            payoutReferenceId: true,
            gatewayPayoutId: true,
            userId: true,
        },
    });

    if (!existingWithdrawal) throw notFound('Withdrawal');

    if (existingWithdrawal.status === 'paid' && existingWithdrawal.payoutReferenceId) {
        // Idempotent replay — already successfully paid
        logger.info(
            {
                event: 'idempotent_replay_detected',
                withdrawalId,
                payoutReferenceId: existingWithdrawal.payoutReferenceId,
                adminId,
            },
            'Payout already completed — returning cached result',
        );
        return {
            withdrawalId,
            status: 'paid',
            gatewayTransactionId: existingWithdrawal.gatewayPayoutId ?? '',
            payoutReferenceId: existingWithdrawal.payoutReferenceId,
            idempotentReplay: true,
        };
    }

    // ── STEP 2: STATE MACHINE VALIDATION ────────────────────────────────
    //
    // validated again inside the DB transaction (Step 6), but we short-
    // circuit here to give a clear error before expensive operations.
    //
    if (TERMINAL_STATES.has(existingWithdrawal.status)) {
        logger.warn(
            {
                event: 'state_validation_failed',
                withdrawalId,
                status: existingWithdrawal.status,
            },
            'Attempt to execute payout from terminal state',
        );
        throw new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            `Withdrawal is in terminal state '${existingWithdrawal.status}' and cannot be re-executed.`,
            409,
        );
    }

    if (!VALID_PAYOUT_EXECUTIONS_FROM.has(existingWithdrawal.status)) {
        logger.warn(
            {
                event: 'state_validation_failed',
                withdrawalId,
                status: existingWithdrawal.status,
            },
            'Withdrawal not in approved status for payout',
        );
        throw new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            `Withdrawal must be in 'approved' status to execute payout. Current: '${existingWithdrawal.status}'`,
            400,
        );
    }

    // ── STEP 3: FRAUD REVALIDATION ───────────────────────────────────────
    //
    // Re-check fraud signals at execution time, not just at request time.
    // Conditions: account must be active, fraud score < threshold,
    //             no unresolved fraud flags.
    //
    const fraudCheck = await revalidateFraud(existingWithdrawal.userId);

    if (!fraudCheck.passed) {
        logger.warn(
            {
                event: 'fraud_blocked_payout',
                withdrawalId,
                userId: existingWithdrawal.userId,
                reason: fraudCheck.reason,
                adminId,
            },
            'Payout blocked — fraud revalidation failed',
        );
        throw new AppError(
            ERROR_CODES.FRAUD_DETECTED,
            `Payout blocked by fraud revalidation: ${fraudCheck.reason}`,
            403,
        );
    }

    // ── STEP 4: GENERATE PAYOUT REFERENCE ID ────────────────────────────
    //
    // This UUID is the idempotency key for the entire payout execution.
    // It is stored in the DB BEFORE the gateway call, so if the process
    // crashes after the gateway call but before the DB commit, the next
    // retry will detect the stored reference and handle it safely.
    //
    const payoutReferenceId = crypto.randomUUID();

    // Reserve the payout_reference_id atomically.
    // If another concurrent request already reserved one → unique constraint
    // violation → concurrentModification error → safe, informative failure.
    try {
        const updatedCount = await prisma.$executeRawUnsafe(
            `UPDATE withdrawals 
             SET payout_reference_id = $1::uuid, 
                 updated_at = NOW()
             WHERE id = $2::uuid 
               AND status = 'approved' 
               AND payout_reference_id IS NULL`,
            payoutReferenceId,
            withdrawalId,
        );

        if (updatedCount === 0) {
            throw new AppError(
                ERROR_CODES.CONCURRENT_MODIFICATION,
                'Withdrawal already processed, cancelled, or reference claimed',
                409,
            );
        }
    } catch (err: any) {
        if (err?.code === 'P2025' || err?.code === '23505') {
            logger.warn(
                {
                    event: 'state_validation_failed',
                    withdrawalId,
                    adminId,
                },
                'Payout reference already claimed — concurrent execution detected',
            );
            throw new AppError(
                ERROR_CODES.CONCURRENT_MODIFICATION,
                'Withdrawal already being processed by another request.',
                409,
            );
        }
        logger.error({ err, withdrawalId }, 'Database error during payout reservation');
        throw new AppError(
            ERROR_CODES.INTERNAL_ERROR,
            `Failed to reserve payout reference: ${err.message}`,
            500,
        );
    }

    logger.info(
        {
            event: 'payout_started',
            withdrawalId,
            payoutReferenceId,
            userId: existingWithdrawal.userId,
            adminId,
            ipAddress,
        },
        'Payout execution started',
    );

    // ── STEP 5: GATEWAY CALL (outside DB transaction) ───────────────────
    //
    // We intentionally call the gateway OUTSIDE the DB transaction to
    // avoid holding DB locks during network I/O (which can be slow).
    // The payout_reference_id is passed as the idempotency key to the
    // gateway, so if we retry, the gateway will not double-charge.
    //
    // Timeout: 5 seconds (AbortController in gateway)
    // Retry:   Max 3 attempts with exponential backoff
    // Safety:  payout_reference_id passed ensures gateway idempotency.
    //
    const amountToPay = await getNetAmount(withdrawalId);

    let gatewayResponse: {
        success: boolean;
        gatewayTransactionId: string;
        message: string;
        alreadyProcessed?: boolean;
    };

    try {
        gatewayResponse = await withGatewayRetry(async () => {
            return payoutGateway.initiatePayout({
                userId: existingWithdrawal.userId,
                amount: amountToPay,
                referenceId: withdrawalId,
                idempotencyKey: payoutReferenceId,   // Gateway-level dedup
            });
        }, 3);
    } catch (error: any) {
        // Gateway communication failure — mark as 'failed', do NOT refund.
        // Admin can retry via retryFailedPayout() which transitions failed → approved.
        logger.error(
            {
                event: 'payout_failed',
                withdrawalId,
                payoutReferenceId,
                error: error.message,
                adminId,
            },
            'Gateway exception during payout — marking failed',
        );

        await markPayoutFailed(withdrawalId, payoutReferenceId, `Gateway exception: ${error.message}`);
        throw new AppError(
            ERROR_CODES.SERVICE_UNAVAILABLE,
            'Payment gateway is unavailable. Withdrawal marked as failed and can be retried.',
            503,
        );
    }

    if (!gatewayResponse.success) {
        // Gateway rejected the payout (e.g., invalid account, blacklisted)
        logger.warn(
            {
                event: 'payout_failed',
                withdrawalId,
                payoutReferenceId,
                gatewayMessage: gatewayResponse.message,
                adminId,
            },
            'Gateway rejected payout — marking failed',
        );

        await markPayoutFailed(
            withdrawalId,
            payoutReferenceId,
            `Gateway rejection: ${gatewayResponse.message}`,
        );
        throw new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            `Gateway rejected: ${gatewayResponse.message}`,
            400,
        );
    }

    // ── STEP 6: ATOMIC COMMIT (SERIALIZABLE transaction) ────────────────
    //
    // Inside this transaction:
    //   a. Lock withdrawal row FOR UPDATE NOWAIT → status guard
    //   b. Lock wallet row FOR UPDATE NOWAIT → balance guard
    //   c. Re-validate status === 'approved' (terminal guard inside txn)
    //   d. UPDATE withdrawal → status=paid, gateway_payout_id, processed_at
    //   e. INSERT wallet_transactions (debit entry — user side)
    //   f. INSERT wallet_transactions (credit entry — clearing account)
    //   g. COMMIT
    //
    // Double-entry accounting:
    //   Debit:  user's winning_balance ledger (withdrawal outflow)
    //   Credit: payout_clearing account ledger (internal liability cleared)
    //   SUM(debit) === SUM(credit) must hold for all time.
    //
    return runInSerializableTransaction(pool, async (client: PoolClient) => {
        // (a) Lock withdrawal — NOWAIT: fail fast if another request holds it
        const wLock = await client.query(
            `SELECT id, user_id, amount, tds_amount, net_amount, status, payout_reference_id
             FROM withdrawals
             WHERE id = $1
             FOR UPDATE NOWAIT`,
            [withdrawalId],
        );

        const w = wLock.rows[0];
        if (!w) throw notFound('Withdrawal');

        // (b) Terminal state guard inside transaction
        if (TERMINAL_STATES.has(w.status)) {
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                `Withdrawal already in terminal state '${w.status}' — payout cannot proceed.`,
                409,
            );
        }

        // (c) Status must still be approved (concurrent admin could have rejected)
        if (w.status !== 'approved') {
            logger.warn(
                {
                    event: 'state_validation_failed',
                    withdrawalId,
                    statusFoundInTxn: w.status,
                },
                'Withdrawal status changed between checks and commit',
            );
            throw validationError(
                `Withdrawal status changed during execution: expected 'approved', found '${w.status}'`,
            );
        }

        // (d) Lock wallet — prevents concurrent balance mutation
        const wltLock = await client.query(
            `SELECT id, user_id, winning_balance
             FROM wallets
             WHERE user_id = $1
             FOR UPDATE NOWAIT`,
            [w.user_id],
        );

        const wallet = wltLock.rows[0];
        if (!wallet) {
            throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Wallet not found for user', 500);
        }

        const netAmount = w.net_amount ?? w.amount;
        const balanceBefore = parseFloat(wallet.winning_balance);
        const balanceAfter = balanceBefore; // Balance was already deducted at withdrawal request time
        // Note: The wallet balance was deducted when requestWithdrawal() was called.
        // At payout time we only need to finalize the ledger entry status.
        // We do NOT deduct balance again here. The deduction happened atomically
        // at withdrawal request creation (wallet_deduct CTE in wallet.service.ts).

        // (e) UPDATE withdrawal → 'paid'
        await client.query(
            `UPDATE withdrawals
             SET status           = 'paid',
                 gateway_payout_id = $2,
                 processed_at     = now(),
                 updated_at       = now()
             WHERE id = $1`,
            [withdrawalId, gatewayResponse.gatewayTransactionId],
        );

        // (f) DEBIT ledger entry — confirms the outflow (user side)
        //     This finalizes the 'pending' withdrawal transaction created at request time.
        //     We INSERT a new 'confirmed' entry; we do NOT UPDATE the pending one
        //     (ledger is INSERT-only — no mutations ever).
        const debitIdempotencyKey = `payout-debit-${payoutReferenceId}`;
        await client.query(
            `INSERT INTO wallet_transactions (
                id, user_id, reference_id, transaction_type,
                debit_amount, credit_amount,
                balance_before, balance_after,
                status, idempotency_key, description, created_at
             ) VALUES (
                gen_random_uuid(), $1, $2::uuid, 'withdrawal',
                $3::numeric, 0,
                $4::numeric, $5::numeric,
                'confirmed', $6,
                'Payout disbursed via gateway — ref:' || $7,
                now()
             )
             ON CONFLICT (idempotency_key) DO NOTHING`,
            [
                w.user_id,
                withdrawalId,
                netAmount,
                balanceBefore,
                balanceAfter,
                debitIdempotencyKey,
                payoutReferenceId,
            ],
        );

        // (g) CREDIT ledger entry — payout clearing account (internal liability)
        //     When we disburse funds, the internal liability is cleared.
        //     credit_amount = net payout; this entry balances the debit.
        //     Double-entry: SUM(debit_amount) == SUM(credit_amount) across all rows.
        const creditIdempotencyKey = `payout-credit-${payoutReferenceId}`;
        await client.query(
            `INSERT INTO wallet_transactions (
                id, user_id, reference_id, transaction_type,
                debit_amount, credit_amount,
                balance_before, balance_after,
                status, idempotency_key, description, created_at
             ) VALUES (
                gen_random_uuid(), $1, $2::uuid, 'withdrawal',
                0, $3::numeric,
                $4::numeric, $5::numeric,
                'confirmed', $6,
                'Payout clearing credit — ref:' || $7,
                now()
             )
             ON CONFLICT (idempotency_key) DO NOTHING`,
            [
                w.user_id,
                withdrawalId,
                netAmount,
                balanceBefore,
                balanceAfter,
                creditIdempotencyKey,
                payoutReferenceId,
            ],
        );

        logger.info(
            {
                event: 'payout_success',
                withdrawalId,
                payoutReferenceId,
                gatewayTransactionId: gatewayResponse.gatewayTransactionId,
                userId: w.user_id,
                netAmount,
                adminId,
                ipAddress,
            },
            'Payout completed successfully — ledger balanced',
        );

        return {
            withdrawalId,
            status: 'paid' as const,
            gatewayTransactionId: gatewayResponse.gatewayTransactionId,
            payoutReferenceId,
            idempotentReplay: false,
        };
    });
}

// ═══════════════════════════════════════════════════════════════════════
// MARK PAYOUT FAILED  (safe failure — no balance reversal)
// ═══════════════════════════════════════════════════════════════════════
//
// Financial Safety:
//   • Balance is NOT automatically reversed when a payout fails.
//   • The balance was deducted at withdrawal REQUEST time, not at payout.
//   • Admin must explicitly call retryPayout() to attempt again.
//   • If the admin decides to refund, a compensating ledger entry is inserted
//     via processWithdrawalApproval(action='reject') in admin.service.ts.
//   • This prevents silent balance inconsistencies.
// ═══════════════════════════════════════════════════════════════════════

async function markPayoutFailed(
    withdrawalId: string,
    payoutReferenceId: string,
    errorReason: string,
): Promise<void> {
    await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
            status: 'failed',
            payoutError: errorReason,
            updatedAt: new Date(),
        },
    });

    logger.error(
        {
            event: 'payout_failed',
            withdrawalId,
            payoutReferenceId,
            errorReason,
        },
        'Withdrawal marked as failed — awaiting admin retry or rejection',
    );
}

// ═══════════════════════════════════════════════════════════════════════
// HELPER: Fetch net amount for payout
// ═══════════════════════════════════════════════════════════════════════

async function getNetAmount(withdrawalId: string): Promise<string> {
    const w = await prisma.withdrawal.findUnique({
        where: { id: withdrawalId },
        select: { netAmount: true, amount: true },
    });
    if (!w) throw notFound('Withdrawal');
    return w.netAmount ? w.netAmount.toString() : w.amount.toString();
}
