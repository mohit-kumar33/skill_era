/**
 * KYC Provider — External identity verification adapter.
 *
 * Supports multiple KYC verification backends:
 *   - DigiLocker (India government identity verification)
 *   - Manual (admin-reviewed document upload — current default)
 *
 * Design:
 *   - Fire-and-forget: verification requests are async
 *   - Callback-based: results arrive via webhook or polling
 *   - Graceful fallback: if external API is down, falls back to manual review
 */

import { env } from '../../config/env.js';
import { prisma } from '../../config/prisma.js';
import { logger } from '../../utils/logger.js';
import { notifyKycStatusUpdate } from '../notification/notification.service.js';

// ── Types ──────────────────────────────────────────────────────────────

type KycDocType = 'aadhaar' | 'pan' | 'passport' | 'voter_id' | 'driving_license';

interface VerificationRequest {
    userId: string;
    docType: KycDocType;
    docNumber: string;
    docUrl?: string;
}

interface VerificationResult {
    status: 'verified' | 'rejected' | 'pending' | 'error';
    providerRefId?: string;
    message?: string;
    verifiedName?: string;
}

// ── Provider Interface ────────────────────────────────────────────────

interface KycProviderAdapter {
    verifyIdentity(req: VerificationRequest): Promise<VerificationResult>;
    getVerificationStatus(providerRefId: string): Promise<VerificationResult>;
}

// ═══════════════════════════════════════════════════════════════════════
// DIGILOCKER PROVIDER (India — Aadhaar + PAN eKYC)
// ═══════════════════════════════════════════════════════════════════════

const digilockerProvider: KycProviderAdapter = {
    async verifyIdentity(req: VerificationRequest): Promise<VerificationResult> {
        const apiKey = env.KYC_API_KEY;
        const baseUrl = env.KYC_API_URL ?? 'https://api.digilocker.gov.in';

        if (!apiKey) {
            logger.warn('DigiLocker: KYC_API_KEY not configured — falling back to manual');
            return { status: 'pending', message: 'KYC API not configured — manual review required' };
        }

        try {
            const response = await fetch(`${baseUrl}/v3/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    document_type: req.docType,
                    document_number: req.docNumber,
                    consent: 'Y',
                    reason: 'Identity verification for gaming platform',
                }),
                signal: AbortSignal.timeout(15_000),
            });

            if (!response.ok) {
                const body = await response.text();
                logger.error(
                    { statusCode: response.status, body },
                    'DigiLocker verification API error',
                );
                return { status: 'error', message: `API error: ${response.status}` };
            }

            const data = await response.json() as {
                status: string;
                reference_id: string;
                verified_name?: string;
                message?: string;
            };

            if (data.status === 'VALID') {
                return {
                    status: 'verified',
                    providerRefId: data.reference_id,
                    verifiedName: data.verified_name,
                };
            } else if (data.status === 'INVALID') {
                return {
                    status: 'rejected',
                    providerRefId: data.reference_id,
                    message: data.message ?? 'Document verification failed',
                };
            }

            return {
                status: 'pending',
                providerRefId: data.reference_id,
                message: 'Verification in progress',
            };
        } catch (err) {
            logger.error({ err }, 'DigiLocker verification request failed');
            return { status: 'error', message: 'External KYC API unreachable' };
        }
    },

    async getVerificationStatus(providerRefId: string): Promise<VerificationResult> {
        const apiKey = env.KYC_API_KEY;
        const baseUrl = env.KYC_API_URL ?? 'https://api.digilocker.gov.in';

        if (!apiKey) {
            return { status: 'pending', message: 'API not configured' };
        }

        try {
            const response = await fetch(`${baseUrl}/v3/status/${providerRefId}`, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
                signal: AbortSignal.timeout(10_000),
            });

            if (!response.ok) {
                return { status: 'error', message: `Status check failed: ${response.status}` };
            }

            const data = await response.json() as {
                status: string;
                verified_name?: string;
                message?: string;
            };

            return {
                status: data.status === 'VALID' ? 'verified' : data.status === 'INVALID' ? 'rejected' : 'pending',
                providerRefId,
                verifiedName: data.verified_name,
                message: data.message,
            };
        } catch (err) {
            logger.error({ err, providerRefId }, 'DigiLocker status check failed');
            return { status: 'error', message: 'Status check failed' };
        }
    },
};

// ═══════════════════════════════════════════════════════════════════════
// MANUAL PROVIDER (fallback — admin-reviewed)
// ═══════════════════════════════════════════════════════════════════════

const manualProvider: KycProviderAdapter = {
    async verifyIdentity(_req: VerificationRequest): Promise<VerificationResult> {
        return { status: 'pending', message: 'Awaiting manual admin review' };
    },
    async getVerificationStatus(_providerRefId: string): Promise<VerificationResult> {
        return { status: 'pending', message: 'Awaiting manual admin review' };
    },
};

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════

function getProvider(): KycProviderAdapter {
    const provider = env.KYC_PROVIDER ?? 'manual';
    switch (provider) {
        case 'digilocker':
            return digilockerProvider;
        default:
            return manualProvider;
    }
}

/**
 * Submit a document for external KYC verification.
 * Called after KYC document upload by the user.
 * Non-blocking — results update the user record asynchronously.
 */
export async function requestExternalVerification(
    req: VerificationRequest,
): Promise<VerificationResult> {
    const provider = getProvider();
    const result = await provider.verifyIdentity(req);

    logger.info(
        { userId: req.userId, docType: req.docType, status: result.status },
        'KYC external verification requested',
    );

    // If immediately verified/rejected, update user record
    if (result.status === 'verified') {
        await prisma.user.update({
            where: { id: req.userId },
            data: { kycStatus: 'verified' },
        });
        notifyKycStatusUpdate(req.userId, 'verified').catch(() => { });
    } else if (result.status === 'rejected') {
        await prisma.user.update({
            where: { id: req.userId },
            data: { kycStatus: 'rejected' },
        });
        notifyKycStatusUpdate(req.userId, 'rejected', result.message).catch(() => { });
    }

    return result;
}

/**
 * Poll external provider for verification status update.
 * Called by reconciliation job or admin action.
 */
export async function pollVerificationStatus(
    userId: string,
    providerRefId: string,
): Promise<VerificationResult> {
    const provider = getProvider();
    const result = await provider.getVerificationStatus(providerRefId);

    if (result.status === 'verified') {
        await prisma.user.update({
            where: { id: userId },
            data: { kycStatus: 'verified' },
        });
        notifyKycStatusUpdate(userId, 'verified').catch(() => { });
    } else if (result.status === 'rejected') {
        await prisma.user.update({
            where: { id: userId },
            data: { kycStatus: 'rejected' },
        });
        notifyKycStatusUpdate(userId, 'rejected', result.message).catch(() => { });
    }

    return result;
}
