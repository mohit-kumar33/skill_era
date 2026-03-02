import { z } from 'zod';
import { MIN_DEPOSIT_AMOUNT, MAX_DEPOSIT_AMOUNT, MIN_WITHDRAWAL_AMOUNT, MAX_WITHDRAWAL_AMOUNT } from '../../config/constants.js';

export const depositInitiateSchema = z.object({
    amount: z
        .string()
        .regex(/^\d{1,16}(\.\d{1,2})?$/, 'Invalid amount format')
        .refine((v) => parseFloat(v) >= parseFloat(MIN_DEPOSIT_AMOUNT), {
            message: `Minimum deposit is ₹${MIN_DEPOSIT_AMOUNT}`,
        })
        .refine((v) => parseFloat(v) <= parseFloat(MAX_DEPOSIT_AMOUNT), {
            message: `Maximum deposit is ₹${MAX_DEPOSIT_AMOUNT}`,
        }),
    idempotencyKey: z
        .string()
        .min(5)
        .max(255)
        .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid idempotency key format'),
});

export const withdrawRequestSchema = z.object({
    amount: z
        .string()
        .regex(/^\d{1,16}(\.\d{1,2})?$/, 'Invalid amount format')
        .refine((v) => parseFloat(v) >= parseFloat(MIN_WITHDRAWAL_AMOUNT), {
            message: `Minimum withdrawal is ₹${MIN_WITHDRAWAL_AMOUNT}`,
        })
        .refine((v) => parseFloat(v) <= parseFloat(MAX_WITHDRAWAL_AMOUNT), {
            message: `Maximum withdrawal is ₹${MAX_WITHDRAWAL_AMOUNT}`,
        }),
    idempotencyKey: z
        .string()
        .min(5)
        .max(255)
        .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid idempotency key format'),
});

export const depositWebhookSchema = z.object({
    deposit_id: z.string().uuid(),
    gateway_transaction_id: z.string().min(1),
    amount: z.string().regex(/^\d{1,16}(\.\d{1,2})?$/),
    status: z.string(),
    /** ISO 8601 timestamp from gateway — used for replay window check */
    timestamp: z.string().datetime({ message: 'timestamp must be ISO 8601' }),
    /** Unique nonce from gateway — prevents replay attacks */
    nonce: z.string().min(8).max(255),
});

export type DepositInitiateInput = z.infer<typeof depositInitiateSchema>;
export type WithdrawRequestInput = z.infer<typeof withdrawRequestSchema>;
export type DepositWebhookInput = z.infer<typeof depositWebhookSchema>;
