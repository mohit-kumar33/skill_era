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

export const withdrawOtpSchema = z.object({
    amount: z
        .string()
        .regex(/^\d{1,16}(\.\d{1,2})?$/, 'Invalid amount format')
        .refine((v) => parseFloat(v) >= parseFloat(MIN_WITHDRAWAL_AMOUNT), {
            message: `Minimum withdrawal is ₹${MIN_WITHDRAWAL_AMOUNT}`,
        })
        .refine((v) => parseFloat(v) <= parseFloat(MAX_WITHDRAWAL_AMOUNT), {
            message: `Maximum withdrawal is ₹${MAX_WITHDRAWAL_AMOUNT}`,
        }),
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
    payoutMethod: z.enum(['bank_transfer', 'upi']),
    bankAccount: z.string().optional(),
    ifsc: z.string().optional(),
    upiId: z.string().optional(),
    preAuthToken: z.string().min(1, 'Pre-auth token is required'),
    otp: z.string().length(6, 'OTP must be 6 digits').regex(/^\d{6}$/, 'OTP must be numeric'),
}).superRefine((data, ctx) => {
    if (data.payoutMethod === 'bank_transfer') {
        if (!data.bankAccount || data.bankAccount.length < 5) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid bank account number required', path: ['bankAccount'] });
        }
        if (!data.ifsc || data.ifsc.length !== 11) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid 11-character IFSC code required', path: ['ifsc'] });
        }
    } else if (data.payoutMethod === 'upi') {
        if (!data.upiId || !data.upiId.includes('@')) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Valid UPI ID required', path: ['upiId'] });
        }
    }
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
export type WithdrawOtpInput = z.infer<typeof withdrawOtpSchema>;
export type WithdrawRequestInput = z.infer<typeof withdrawRequestSchema>;
export type DepositWebhookInput = z.infer<typeof depositWebhookSchema>;
