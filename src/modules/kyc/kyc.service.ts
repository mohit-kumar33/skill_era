import { prisma } from '../../config/prisma.js';
import { notFound, validationError, AppError, ERROR_CODES } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { MIN_AGE_YEARS } from '../../config/constants.js';
import { notifyKycStatusUpdate } from '../notification/notification.service.js';
import { requestExternalVerification } from './kyc.provider.js';
import type { SubmitKycInput, VerifyKycInput } from './kyc.schema.js';

/**
 * Check if user meets minimum age requirement.
 */
function isUnderAge(dateOfBirth: Date | null | undefined): boolean {
    if (!dateOfBirth) return true; // No DOB = treat as underage (fail-safe)
    const today = new Date();
    const age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
        return (age - 1) < MIN_AGE_YEARS;
    }
    return age < MIN_AGE_YEARS;
}

export async function submitKyc(userId: string, input: SubmitKycInput) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw notFound('User');

    if (user.kycStatus === 'verified') {
        throw new AppError(ERROR_CODES.DUPLICATE_REQUEST, 'KYC already verified', 400);
    }

    // ── Cross-user duplicate document detection ─────────────
    // Check if another user has already submitted/verified with the same doc number.
    // This prevents multi-accounting through shared PAN/Aadhaar documents.
    const duplicateUser = await prisma.user.findFirst({
        where: {
            kycDocNumber: input.docNumber,
            kycDocType: input.docType,
            kycStatus: { in: ['submitted', 'verified'] },
            id: { not: userId }, // Exclude the current user (re-submission scenario)
        },
        select: { id: true, mobile: true, kycStatus: true },
    });

    if (duplicateUser) {
        logger.warn(
            {
                userId,
                duplicateUserId: duplicateUser.id,
                docType: input.docType,
                // Intentionally NOT logging docNumber for PII safety
            },
            'Duplicate KYC document detected across users',
        );

        // Auto-flag both users for fraud review
        await prisma.$transaction([
            // Flag the submitting user
            prisma.fraudFlag.create({
                data: {
                    userId,
                    flagType: 'duplicate_kyc',
                    riskPoints: 30,
                    description: `Same ${input.docType} document already used by another account (user: ${duplicateUser.id})`,
                },
            }),
            // Flag the existing holder
            prisma.fraudFlag.create({
                data: {
                    userId: duplicateUser.id,
                    flagType: 'duplicate_kyc',
                    riskPoints: 20,
                    description: `Another account (user: ${userId}) attempted KYC with the same ${input.docType} document`,
                },
            }),
            // Increase fraud score on the submitting user
            prisma.user.update({
                where: { id: userId },
                data: { fraudScore: { increment: 30 } },
            }),
            // Increase fraud score on the existing holder
            prisma.user.update({
                where: { id: duplicateUser.id },
                data: { fraudScore: { increment: 20 } },
            }),
        ]);

        throw new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            'This document is already associated with another account. Your submission has been flagged for review.',
            409,
        );
    }

    const updated = await prisma.user.update({
        where: { id: userId },
        data: {
            kycDocType: input.docType,
            kycDocNumber: input.docNumber,
            kycDocUrl: input.docUrl,
            kycStatus: 'submitted',
        },
        select: { id: true, kycStatus: true, kycDocType: true },
    });

    logger.info({ userId, docType: input.docType }, 'KYC submitted');

    // Fire-and-forget external KYC verification
    requestExternalVerification({
        userId,
        docType: input.docType as 'aadhaar' | 'pan' | 'passport' | 'voter_id' | 'driving_license',
        docNumber: input.docNumber,
        docUrl: input.docUrl,
    }).catch(() => { });

    return updated;
}

export async function verifyKyc(adminId: string, input: VerifyKycInput) {
    const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { kycStatus: true, dateOfBirth: true },
    });
    if (!user) throw notFound('User');

    if (user.kycStatus !== 'submitted') {
        throw validationError(`Cannot verify KYC in status: ${user.kycStatus}`);
    }

    // Age enforcement: reject KYC approval if user is under 18
    if (input.action === 'approve' && isUnderAge(user.dateOfBirth)) {
        logger.warn({ userId: input.userId, adminId }, 'KYC approval blocked: user under 18');
        throw new AppError(
            ERROR_CODES.VALIDATION_ERROR,
            `User must be at least ${MIN_AGE_YEARS} years old for KYC approval. Date of birth does not meet minimum age requirement.`,
            403,
        );
    }

    const newStatus = input.action === 'approve' ? 'verified' : 'rejected';

    const [updated] = await prisma.$transaction([
        prisma.user.update({
            where: { id: input.userId },
            data: { kycStatus: newStatus as any },
            select: { id: true, kycStatus: true },
        }),
        prisma.adminLog.create({
            data: {
                adminId,
                actionType: `kyc_${input.action}`,
                targetUserId: input.userId,
                metadata: { reason: input.reason ?? null },
            },
        }),
    ]);

    logger.info({ adminId, userId: input.userId, action: input.action }, 'KYC verified by admin');

    // Fire-and-forget user notification
    notifyKycStatusUpdate(
        input.userId,
        input.action === 'approve' ? 'verified' : 'rejected',
        input.reason,
    ).catch(() => { });

    return updated;
}

export async function getKycStatus(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            kycStatus: true,
            kycDocType: true,
            kycDocNumber: true,
        },
    });

    if (!user) throw notFound('User');
    return user;
}
