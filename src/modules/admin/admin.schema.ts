import { z } from 'zod';
import { DUAL_APPROVAL_THRESHOLD } from '../../config/constants.js';

export const approveWithdrawalSchema = z.object({
    withdrawalId: z.string().uuid(),
    action: z.enum(['approve', 'reject']),
    notes: z.string().max(500).optional(),
});

export const fraudFlagSchema = z.object({
    userId: z.string().uuid(),
    flagType: z.enum([
        'multi_ip',
        'deposit_withdraw_velocity',
        'large_withdrawal',
        'high_win_ratio',
        'duplicate_kyc',
        'failed_logins',
        'high_balance_withdrawal',
        'device_fingerprint',
        'manual_flag',
    ]),
    riskPoints: z.number().int().min(1).max(100),
    description: z.string().min(1).max(500),
});

export const listWithdrawalsQuerySchema = z.object({
    status: z.enum(['requested', 'under_review', 'approved', 'paid', 'rejected']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ApproveWithdrawalInput = z.infer<typeof approveWithdrawalSchema>;
export type FraudFlagInput = z.infer<typeof fraudFlagSchema>;
export type ListWithdrawalsQuery = z.infer<typeof listWithdrawalsQuerySchema>;
