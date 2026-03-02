import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { PoolClient } from 'pg';
import { env } from '../../config/env.js';
import { verifyHmacSignature } from '../../utils/hmac.js';
import { depositWebhookSchema } from './wallet.schema.js';
import { confirmDeposit } from './wallet.service.js';
import { pool } from '../../config/database.js';
import { runInTransaction } from '../../utils/transaction.js';
import { logger } from '../../utils/logger.js';
import { AppError, ERROR_CODES } from '../../utils/errors.js';
import { recordEvent } from '../../utils/alerting.js';
import { isWebhookReplay } from '../../config/redis.js';
import { notifyDepositConfirmed } from '../notification/notification.service.js';

// ── Webhook Security Constants ──────────────────────────────────────────
/** Maximum age of a webhook payload (in milliseconds) before it's rejected */
const WEBHOOK_TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes

// ═══════════════════════════════════════════════════════════════════════
// WEBHOOK RAW BODY PRESERVATION
// ═══════════════════════════════════════════════════════════════════════
//
// The raw request body (byte-for-byte) MUST be used for HMAC verification.
// JSON.stringify(parsedBody) can produce different byte sequences than
// the original payload (key ordering, unicode escaping, whitespace).
//
// We store the raw buffer on the request object, then use it for HMAC.
// ═══════════════════════════════════════════════════════════════════════

declare module 'fastify' {
    interface FastifyRequest {
        rawBodyBuffer?: Buffer;
    }
}

/**
 * Deposit webhook handler — receives callbacks from payment gateway.
 * No JWT auth required (uses HMAC signature verification instead).
 *
 * Security:
 * - HMAC-SHA256 signature validation against RAW bytes (not reconstructed JSON)
 * - Idempotent (safe to replay)
 * - Amount mismatch detection
 * - Chargeback/refund reversal handling
 */
export async function walletWebhookRoutes(app: FastifyInstance): Promise<void> {
    // Register raw body parser — preserves original bytes for HMAC
    app.addContentTypeParser(
        'application/json',
        { parseAs: 'buffer' },
        (req: FastifyRequest, body: Buffer, done) => {
            try {
                // Store raw bytes for HMAC verification
                req.rawBodyBuffer = body;
                done(null, JSON.parse(body.toString()));
            } catch (err) {
                done(err as Error);
            }
        },
    );

    // ── POST /deposit ─────────────────────────────────────
    app.post('/deposit', async (request, reply) => {
        // Step 1: Verify HMAC signature using RAW body bytes
        const signature = request.headers['x-webhook-signature'] as string | undefined;
        if (!signature) {
            logger.warn({ ip: request.ip }, 'Webhook missing signature');
            throw new AppError(ERROR_CODES.INVALID_SIGNATURE, 'Missing webhook signature', 401);
        }

        // Use the preserved raw buffer — NOT JSON.stringify(request.body)
        const rawBody = request.rawBodyBuffer;
        if (!rawBody) {
            logger.error({ ip: request.ip }, 'Webhook: raw body buffer missing');
            throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Raw body not available', 500);
        }

        const isValid = verifyHmacSignature(rawBody, signature, env.PAYMENT_WEBHOOK_SECRET);
        if (!isValid) {
            logger.warn({ ip: request.ip }, 'Webhook invalid signature');
            throw new AppError(ERROR_CODES.INVALID_SIGNATURE, 'Invalid webhook signature', 401);
        }

        // Step 2: Validate payload
        const parsed = depositWebhookSchema.safeParse(request.body);
        if (!parsed.success) {
            logger.warn({ errors: parsed.error.errors }, 'Webhook invalid payload');
            throw new AppError(ERROR_CODES.VALIDATION_ERROR, 'Invalid webhook payload', 400);
        }

        const { deposit_id, gateway_transaction_id, amount, status, timestamp, nonce } = parsed.data;

        // Step 3: Timestamp window validation — reject stale webhooks
        const webhookAge = Date.now() - new Date(timestamp).getTime();
        if (webhookAge > WEBHOOK_TIMESTAMP_TOLERANCE_MS || webhookAge < -WEBHOOK_TIMESTAMP_TOLERANCE_MS) {
            logger.warn(
                { ip: request.ip, webhookAge, depositId: deposit_id, nonce },
                'Webhook rejected: timestamp outside tolerance window',
            );
            throw new AppError(
                ERROR_CODES.VALIDATION_ERROR,
                `Webhook timestamp outside ${WEBHOOK_TIMESTAMP_TOLERANCE_MS / 1000}s tolerance`,
                400,
            );
        }

        // Step 4: Nonce replay protection — reject duplicate webhook deliveries
        const isDuplicate = await isWebhookReplay(nonce);
        if (isDuplicate) {
            logger.warn(
                { ip: request.ip, depositId: deposit_id, nonce },
                'Webhook rejected: nonce already processed (replay attempt)',
            );
            // Return 200 to prevent gateway from retrying — but do NOT process
            return reply.status(200).send({ success: true, message: 'Already processed (idempotent)' });
        }

        // Step 5: Handle different statuses
        if (status === 'success' || status === 'captured') {
            const result = await confirmDeposit(deposit_id, gateway_transaction_id, amount);

            logger.info(
                { depositId: deposit_id, gatewayTxn: gateway_transaction_id },
                'Webhook: deposit confirmed',
            );

            // Fire-and-forget user notification
            notifyDepositConfirmed(result.depositId, amount, deposit_id).catch(() => { });

            return reply.status(200).send({ success: true, data: result });
        }

        if (status === 'failed' || status === 'expired') {
            const { prisma } = await import('../../config/prisma.js');
            await prisma.deposit.updateMany({
                where: { id: deposit_id, status: 'initiated' },
                data: { status: status === 'failed' ? 'failed' : 'expired' },
            });

            logger.info({ depositId: deposit_id, status }, 'Webhook: deposit failed/expired');
            return reply.status(200).send({ success: true, message: `Deposit marked as ${status}` });
        }

        // ── CHARGEBACK / REFUND HANDLING ──────────────────────
        // If gateway reports a chargeback or refund, we must reverse the credit.
        // This is a financial operation — uses CTE for atomicity.
        if (status === 'refunded' || status === 'chargeback') {
            const result = await handleChargebackReversal(deposit_id, gateway_transaction_id, amount, status);

            return reply.status(200).send({ success: true, data: result });
        }

        logger.warn({ depositId: deposit_id, status }, 'Webhook: unknown status');
        return reply.status(200).send({ success: true, message: 'Acknowledged' });
    });
}

// ═══════════════════════════════════════════════════════════════════════
// CHARGEBACK / REFUND REVERSAL
// ═══════════════════════════════════════════════════════════════════════
//
// When a gateway reports a chargeback or refund:
//   1. Lock the deposit row
//   2. Verify it was previously confirmed (can't refund non-confirmed)
//   3. Lock the user's wallet
//   4. Debit the deposit_balance by the refunded amount
//   5. Insert a reversal ledger entry
//   6. Mark deposit as 'failed'
//   7. Create a fraud flag for audit trail
//
// Idempotent: if deposit is already failed/expired, no-op.
// ═══════════════════════════════════════════════════════════════════════

async function handleChargebackReversal(
    depositId: string,
    gatewayTransactionId: string,
    amount: string,
    eventType: 'refunded' | 'chargeback',
): Promise<{ reversed: boolean; depositId: string }> {
    const { prisma } = await import('../../config/prisma.js');

    return runInTransaction(pool, async (client: PoolClient) => {
        // Lock deposit row
        const depositResult = await client.query(
            `SELECT id, user_id, amount, status
             FROM deposits WHERE id = $1 FOR UPDATE NOWAIT`,
            [depositId],
        );

        const deposit = depositResult.rows[0];
        if (!deposit) {
            logger.warn({ depositId }, 'Chargeback: deposit not found');
            return { reversed: false, depositId };
        }

        // Already reversed or never confirmed — idempotent no-op
        if (deposit.status !== 'confirmed') {
            logger.info(
                { depositId, status: deposit.status },
                'Chargeback: deposit not in confirmed state — skipping reversal',
            );
            return { reversed: false, depositId };
        }

        // Reverse the balance: debit deposit_balance
        const reversalResult = await client.query(
            `WITH wallet_lock AS (
                SELECT id, user_id, deposit_balance
                FROM wallets WHERE user_id = $1
                FOR UPDATE NOWAIT
            ),
            wallet_debit AS (
                UPDATE wallets
                SET deposit_balance = wallet_lock.deposit_balance - $2::numeric,
                    updated_at = now()
                FROM wallet_lock
                WHERE wallets.id = wallet_lock.id
                RETURNING wallets.id,
                          wallet_lock.deposit_balance AS old_balance,
                          wallets.deposit_balance AS new_balance
            ),
            ledger_insert AS (
                INSERT INTO wallet_transactions (
                    id, user_id, reference_id, transaction_type,
                    debit_amount, credit_amount,
                    balance_before, balance_after,
                    status, idempotency_key, description, created_at
                )
                SELECT
                    gen_random_uuid(), $1, $3::uuid, 'refund',
                    $2::numeric, 0,
                    wd.old_balance, wd.new_balance,
                    'confirmed', 'chargeback-' || $3::text,
                    $4 || ' reversal via gateway — ref:' || $5,
                    now()
                FROM wallet_debit wd
                ON CONFLICT (idempotency_key) DO NOTHING
                RETURNING id
            )
            SELECT wd.new_balance FROM wallet_debit wd`,
            [
                deposit.user_id,
                amount,
                depositId,
                eventType,
                gatewayTransactionId,
            ],
        );

        // Mark deposit as failed
        await client.query(
            `UPDATE deposits SET status = 'failed', updated_at = now() WHERE id = $1`,
            [depositId],
        );

        const newBalance = reversalResult.rows[0]?.new_balance?.toString() ?? '0';

        logger.error(
            {
                event: `chargeback_reversal`,
                depositId,
                userId: deposit.user_id,
                amount,
                eventType,
                gatewayTransactionId,
                newBalance,
            },
            `ALERT: ${eventType} reversal processed — user balance debited`,
        );

        // Record alert event
        recordEvent('deposit_mismatch');

        // Create fraud flag (fire-and-forget outside transaction)
        prisma.fraudFlag.create({
            data: {
                userId: deposit.user_id,
                flagType: 'deposit_withdraw_velocity',
                riskPoints: eventType === 'chargeback' ? 50 : 20,
                description: `${eventType} on deposit ${depositId} — amount ₹${amount} reversed`,
            },
        }).catch(() => { });

        // Increment fraud score
        prisma.user.update({
            where: { id: deposit.user_id },
            data: { fraudScore: { increment: eventType === 'chargeback' ? 50 : 20 } },
        }).catch(() => { });

        return { reversed: true, depositId };
    });
}
