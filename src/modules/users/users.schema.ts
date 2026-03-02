import { z } from 'zod';

export const updateProfileSchema = z.object({
    email: z.string().email().optional(),
    panNumber: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Invalid PAN format').optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
