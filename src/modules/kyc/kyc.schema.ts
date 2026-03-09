import { z } from 'zod';

export const submitKycSchema = z.object({
    docType: z.enum(['aadhaar', 'pan', 'passport', 'voter_id', 'driving_license']),
    docNumber: z.string().min(4).max(50),
    docUrl: z.string().url(),
});

export const verifyKycSchema = z.object({
    userId: z.string().uuid(),
    action: z.enum(['approve', 'reject']),
    reason: z.string().min(1).optional(),
});

export const presignedUrlSchema = z.object({
    fileName: z.string().min(1).max(255),
    contentType: z.string().regex(/^image\/(jpeg|png)$/, "Only JPEG and PNG images are allowed."),
});

export type SubmitKycInput = z.infer<typeof submitKycSchema>;
export type VerifyKycInput = z.infer<typeof verifyKycSchema>;
export type PresignedUrlInput = z.infer<typeof presignedUrlSchema>;
