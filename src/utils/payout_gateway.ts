import crypto from 'crypto';
import { logger } from './logger.js';

export interface PayoutGatewayParams {
    userId: string;
    amount: string;
    referenceId: string;
    idempotencyKey: string;          // UUIDv4 — passed to gateway for dedup
    accountDetails?: Record<string, unknown>;
}

export interface PayoutGatewayResponse {
    success: boolean;
    gatewayTransactionId: string;
    message: string;
    alreadyProcessed?: boolean;      // true when gateway confirms idempotent replay
}

// ═══════════════════════════════════════════════════════════════════════
// MOCK PAYOUT GATEWAY
// ═══════════════════════════════════════════════════════════════════════
//
// In production, replace with Razorpay Payouts / Cashfree Payouts / bank API.
// The interface contract:
//   • idempotencyKey MUST be forwarded as the gateway request's idempotency key.
//   • Gateway MUST return { success: true, alreadyProcessed: true } for replays.
//   • A 5-second AbortController timeout is enforced by the caller (withGatewayRetry).
// ═══════════════════════════════════════════════════════════════════════

import { env } from '../config/env.js';
import axios, { AxiosError } from 'axios';

// In-memory idempotency store for the mock (simulates gateway-side dedup if needed for tests)
const _gatewayProcessed = new Map<string, PayoutGatewayResponse>();

export const payoutGateway = {
    /**
     * Initiates a payout to a user's bank account / VPA.
     *
     * Financial Safety:
     *   • The `idempotencyKey` (= payout_reference_id) is forwarded to the
     *     gateway so that if this function is called multiple times with the
     *     same key, the gateway only processes the payment once.
     *   • A 5-second AbortSignal timeout is enforced by the caller.
     */
    async initiatePayout(params: PayoutGatewayParams): Promise<PayoutGatewayResponse> {
        logger.info(
            {
                userId: params.userId,
                amount: params.amount,
                referenceId: params.referenceId,
                idempotencyKey: params.idempotencyKey,
            },
            'Initiating mock payout gateway call',
        );

        // ── Cashfree Integration ──────────────────────────────────────────

        // Throw an error if the Cashfree keys are not set
        if (!env.CASHFREE_APP_ID || !env.CASHFREE_API_KEY) {
            throw new Error('Cashfree credentials are not configured');
        }

        try {
            // Initiate real payout via Cashfree API
            const cashfreeResult = await axios.post(
                `${env.CASHFREE_API_URL}/payout/v1/requestAsyncPayout`,
                {
                    batchTransferId: params.idempotencyKey,
                    batchFormat: 'BANK_ACCOUNT',
                    batch: [
                        {
                            transferId: params.referenceId,
                            amount: params.amount,
                            phone: params.accountDetails?.phone || '',
                            email: params.accountDetails?.email || '',
                            name: params.accountDetails?.name || '',
                            remarks: `Payout for User ${params.userId}`,
                            bankAccount: params.accountDetails?.bankAccount || '',
                            ifsc: params.accountDetails?.ifsc || '',
                        }
                    ]
                },
                {
                    headers: {
                        'X-Client-Id': env.CASHFREE_APP_ID,
                        'X-Client-Secret': env.CASHFREE_API_KEY,
                        'X-Idempotency-Key': params.idempotencyKey,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Assuming a 200 OM means success for batch creation
            const gatewayTransactionId = cashfreeResult.data.referenceId || `cf_${crypto.randomUUID().split('-')[0]}`;

            const response: PayoutGatewayResponse = {
                success: true,
                gatewayTransactionId,
                message: 'Payout processed successfully via Cashfree',
            };

            // Update local mock store just in case it is still used by tests
            _gatewayProcessed.set(params.idempotencyKey, response);
            return response;

        } catch (error) {
            const err = error as AxiosError;

            logger.error({
                userId: params.userId,
                error: err.response?.data || err.message,
            }, 'Cashfree payout initiation failed');

            // Handle idempotency replay based on specific Cashfree error codes/messages if needed
            // For now, map standard failures based on the HTTP status or data
            if (err.response?.status === 409 || (err.response?.data as any)?.message?.includes('already processed')) {
                logger.info(
                    { idempotencyKey: params.idempotencyKey },
                    'Cashfree gateway: idempotent replay detected',
                );
                return {
                    success: true,
                    gatewayTransactionId: `cf_replay_${crypto.randomUUID().split('-')[0]}`,
                    message: 'Idempotency replay detected by Cashfree',
                    alreadyProcessed: true
                };
            }

            return {
                success: false,
                gatewayTransactionId: '',
                message: (err.response?.data as any)?.message || 'Cashfree gateway error',
            };
        }
    },

    /**
     * Reset the mock gateway state (for use in tests only).
     */
    _resetForTests(): void {
        _gatewayProcessed.clear();
    },
};
