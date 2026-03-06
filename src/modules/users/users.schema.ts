import { z } from 'zod';

export const updateProfileSchema = z.object({
    email: z.string().email().optional(),
    panNumber: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Invalid PAN format').optional(),
});

export const mobileSchema = z.object({
    mobile: z.string().length(10).regex(/^\d{10}$/, 'Mobile number must be exactly 10 digits'),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateMobileInput = z.infer<typeof mobileSchema>;
