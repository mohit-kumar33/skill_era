import { z } from 'zod';
import { MIN_ENTRY_FEE, MAX_PARTICIPANTS_LIMIT, MIN_COMMISSION_PERCENT, MAX_COMMISSION_PERCENT } from '../../config/constants.js';

export const createTournamentSchema = z.object({
    title: z.string().min(3).max(255),
    gameType: z.string().default('chess'),
    entryFee: z
        .string()
        .regex(/^\d{1,16}(\.\d{1,2})?$/)
        .refine((v) => parseFloat(v) >= parseFloat(MIN_ENTRY_FEE), {
            message: `Minimum entry fee is ₹${MIN_ENTRY_FEE}`,
        }),
    commissionPercent: z
        .number()
        .min(MIN_COMMISSION_PERCENT)
        .max(MAX_COMMISSION_PERCENT),
    maxParticipants: z.number().int().min(2).max(MAX_PARTICIPANTS_LIMIT),
    scheduledAt: z.string().refine(
        (dt) => new Date(dt).getTime() > Date.now(),
        { message: 'Scheduled time must be in the future' },
    ),
});

export const joinTournamentSchema = z.object({
    tournamentId: z.string().uuid(),
    idempotencyKey: z
        .string()
        .min(5)
        .max(255)
        .regex(/^[a-zA-Z0-9_-]+$/),
});

export const submitResultSchema = z.object({
    tournamentId: z.string().uuid(),
    winnerId: z.string().uuid(),
    screenshotUrl: z.string().url().optional(),
    externalMatchId: z.string().optional(),
});

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type JoinTournamentInput = z.infer<typeof joinTournamentSchema>;
export type SubmitResultInput = z.infer<typeof submitResultSchema>;
