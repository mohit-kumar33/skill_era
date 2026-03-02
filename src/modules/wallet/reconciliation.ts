import { pool } from '../../config/database.js';
import { prisma } from '../../config/prisma.js';
import { confirmDeposit } from './wallet.service.js';
import { logger } from '../../utils/logger.js';
import { recordEvent } from '../../utils/alerting.js';
import { env } from '../../config/env.js';

// ═══════════════════════════════════════════════════════════════════════
// DEPOSIT RECONCILIATION JOB
// ═══════════════════════════════════════════════════════════════════════
//
// Runs every 10 minutes via recursive async loop (not setInterval).
// Guarantees:
//   1. No overlapping execution — next run scheduled AFTER completion.
//   2. pg_try_advisory_lock prevents concurrent execution across instances.
//   3. Idempotent — confirmDeposit() handles duplicates safely.
//   4. Environment-namespaced lock key to avoid cross-env collision.
//
// Sweeps: deposits with status='initiated' older than 15 minutes.
// Action: queries gateway API, then confirms or marks failed.
// ═══════════════════════════════════════════════════════════════════════

const RECONCILIATION_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const STALE_DEPOSIT_MINUTES = 15;

let isRunning = false;
let shutdownRequested = false;

/**
 * Start the reconciliation loop.
 * Uses recursive setTimeout to guarantee no overlap.
 */
export function startReconciliationLoop(): void {
    if (isRunning) return;
    isRunning = true;
    logger.info('Deposit reconciliation loop started');
    scheduleNext(5000); // First run after 5 seconds
}

/**
 * Stop the reconciliation loop gracefully.
 */
export function stopReconciliationLoop(): void {
    shutdownRequested = true;
    logger.info('Deposit reconciliation loop stopping');
}

function scheduleNext(delayMs: number): void {
    if (shutdownRequested) {
        isRunning = false;
        return;
    }
    setTimeout(async () => {
        try {
            await runReconciliation();
        } catch (err) {
            // Errors must never break the loop
            logger.error({ err }, 'Reconciliation loop error (non-fatal, will retry)');
        }
        scheduleNext(RECONCILIATION_INTERVAL_MS);
    }, delayMs);
}

/**
 * Single reconciliation run.
 * Acquires a PostgreSQL advisory lock namespaced by environment.
 */
async function runReconciliation(): Promise<void> {
    const client = await pool.connect();

    try {
        // Advisory lock prevents concurrent execution across multiple instances.
        // hashtext() generates a stable int4 from the string key.
        const lockKey = `${env.NODE_ENV}_apex_reconciliation`;
        const lockResult = await client.query(
            `SELECT pg_try_advisory_lock(hashtext($1)) AS acquired`,
            [lockKey],
        );

        if (!lockResult.rows[0]?.acquired) {
            logger.debug('Reconciliation: another instance holds the lock — skipping');
            return;
        }

        try {
            await reconcileStaleDeposits();
        } finally {
            // Always release the advisory lock
            await client.query(
                `SELECT pg_advisory_unlock(hashtext($1))`,
                [lockKey],
            );
        }
    } finally {
        client.release();
    }
}

/**
 * Fetch and process stale deposits.
 */
async function reconcileStaleDeposits(): Promise<void> {
    const cutoff = new Date(Date.now() - STALE_DEPOSIT_MINUTES * 60 * 1000);

    const staleDeposits = await prisma.deposit.findMany({
        where: {
            status: 'initiated',
            createdAt: { lt: cutoff },
        },
        select: {
            id: true,
            userId: true,
            amount: true,
            gatewayTransactionId: true,
            createdAt: true,
        },
        take: 50, // Process in batches to avoid long-running queries
    });

    if (staleDeposits.length === 0) {
        logger.debug('Reconciliation: no stale deposits found');
        return;
    }

    logger.info(
        { count: staleDeposits.length },
        'Reconciliation: processing stale deposits',
    );

    for (const deposit of staleDeposits) {
        try {
            await reconcileSingleDeposit(deposit);
        } catch (err) {
            // Log and continue — one failure shouldn't block others
            logger.error(
                { depositId: deposit.id, err },
                'Reconciliation: failed to process deposit',
            );
        }
    }
}

/**
 * Query gateway for a single deposit and reconcile.
 */
async function reconcileSingleDeposit(deposit: {
    id: string;
    userId: string;
    amount: any;
    gatewayTransactionId: string | null;
    createdAt: Date;
}): Promise<void> {
    // If no gateway API configured, mark very old deposits as expired
    const gatewayUrl = env.GATEWAY_API_URL;
    const gatewayKey = env.GATEWAY_API_KEY;

    if (!gatewayUrl || !gatewayKey || !deposit.gatewayTransactionId) {
        // No gateway to query — mark as expired if older than 1 hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (deposit.createdAt < oneHourAgo) {
            await prisma.deposit.update({
                where: { id: deposit.id },
                data: { status: 'expired', updatedAt: new Date() },
            });
            logger.info({ depositId: deposit.id }, 'Reconciliation: deposit expired (no gateway)');
        }
        return;
    }

    // Query the payment gateway settlement API
    try {
        const response = await fetch(
            `${gatewayUrl}/payments/${deposit.gatewayTransactionId}/status`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${gatewayKey}`,
                    'Content-Type': 'application/json',
                },
                signal: AbortSignal.timeout(10000),
            },
        );

        if (!response.ok) {
            logger.warn(
                { depositId: deposit.id, status: response.status },
                'Reconciliation: gateway returned non-200',
            );
            return; // Retry on next cycle
        }

        const data = await response.json() as {
            status: string;
            transaction_id?: string;
            amount?: string;
        };

        if (data.status === 'success' || data.status === 'captured') {
            // Confirm deposit — confirmDeposit is idempotent
            const result = await confirmDeposit(
                deposit.id,
                data.transaction_id ?? 'reconciled',
                data.amount ?? deposit.amount.toString(),
            );
            logger.info(
                { depositId: deposit.id, newBalance: result.newBalance },
                'Reconciliation: deposit confirmed via gateway query',
            );
        } else if (data.status === 'failed' || data.status === 'expired') {
            await prisma.deposit.update({
                where: { id: deposit.id },
                data: { status: data.status === 'expired' ? 'expired' : 'failed', updatedAt: new Date() },
            });
            logger.info(
                { depositId: deposit.id, gatewayStatus: data.status },
                'Reconciliation: deposit marked as failed/expired',
            );
        } else {
            // Unknown or pending — check for amount mismatch
            if (data.amount && data.amount !== deposit.amount.toString()) {
                recordEvent('deposit_mismatch');
                logger.error(
                    {
                        depositId: deposit.id,
                        expected: deposit.amount.toString(),
                        received: data.amount,
                    },
                    'Reconciliation: DEPOSIT AMOUNT MISMATCH',
                );
            }
            // Still pending at gateway — do nothing, retry next cycle
        }
    } catch (err) {
        logger.warn({ depositId: deposit.id, err }, 'Reconciliation: gateway query failed');
    }
}
