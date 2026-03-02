/**
 * Storage Service — Object storage adapter for file uploads.
 *
 * Supports:
 *   - AWS S3 / S3-compatible (MinIO, DigitalOcean Spaces)
 *   - Local filesystem (development)
 *
 * Used for:
 *   - KYC document storage (private, IAM-restricted)
 *   - Screenshot/evidence uploads (tournament results)
 *
 * Security:
 *   - Pre-signed URLs with 15-minute expiry for uploads
 *   - Pre-signed URLs with 1-hour expiry for downloads
 *   - Bucket-level IAM policies restrict direct access
 */

import crypto from 'crypto';
import { env } from '../config/env.js';
import { logger } from './logger.js';

// ── Types ──────────────────────────────────────────────────────────────

interface UploadResult {
    key: string;
    url: string;
    signedUploadUrl?: string;
}

interface DownloadResult {
    signedUrl: string;
    expiresIn: number;
}

type StorageBucket = 'kyc-documents' | 'tournament-evidence' | 'general';

// ═══════════════════════════════════════════════════════════════════════
// S3-COMPATIBLE STORAGE
// ═══════════════════════════════════════════════════════════════════════

/**
 * Generate a unique storage key for a file upload.
 */
function generateStorageKey(
    bucket: StorageBucket,
    userId: string,
    originalFilename: string,
): string {
    const ext = originalFilename.split('.').pop() ?? 'bin';
    const uniqueId = crypto.randomUUID();
    const datePath = new Date().toISOString().split('T')[0]!.replace(/-/g, '/');
    return `${bucket}/${datePath}/${userId}/${uniqueId}.${ext}`;
}

/**
 * Generate a pre-signed URL for uploading a file to S3.
 * Returns the storage key and a pre-signed PUT URL.
 */
export async function generateUploadUrl(
    bucket: StorageBucket,
    userId: string,
    filename: string,
    contentType: string,
): Promise<UploadResult> {
    const key = generateStorageKey(bucket, userId, filename);

    // Development: use local mock
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
        logger.info(
            { key, userId, contentType },
            'Storage (dev): simulated upload URL generated',
        );
        return {
            key,
            url: `http://localhost:9000/${env.STORAGE_BUCKET ?? 'skill-era'}/${key}`,
            signedUploadUrl: `http://localhost:9000/${env.STORAGE_BUCKET ?? 'skill-era'}/${key}?X-Amz-Signature=dev-mock`,
        };
    }

    const s3Endpoint = env.STORAGE_ENDPOINT;
    const s3Region = env.STORAGE_REGION ?? 'ap-south-1';
    const s3Bucket = env.STORAGE_BUCKET ?? 'skill-era';
    const accessKey = env.STORAGE_ACCESS_KEY;
    const secretKey = env.STORAGE_SECRET_KEY;

    if (!s3Endpoint || !accessKey || !secretKey) {
        logger.warn('S3: Storage credentials not configured — returning mock URL');
        return {
            key,
            url: `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${key}`,
        };
    }

    // Generate pre-signed PUT URL using AWS Signature V4
    const expiresIn = 900; // 15 minutes
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').split('T')[0]!;
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const credentialScope = `${dateStamp}/${s3Region}/s3/aws4_request`;

    const canonicalQueryString = [
        `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
        `X-Amz-Credential=${encodeURIComponent(`${accessKey}/${credentialScope}`)}`,
        `X-Amz-Date=${amzDate}`,
        `X-Amz-Expires=${expiresIn}`,
        `X-Amz-SignedHeaders=content-type;host`,
    ].sort().join('&');

    const host = `${s3Bucket}.${s3Endpoint.replace(/^https?:\/\//, '')}`;
    const canonicalRequest = [
        'PUT',
        `/${key}`,
        canonicalQueryString,
        `content-type:${contentType}`,
        `host:${host}`,
        '',
        'content-type;host',
        'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    // HMAC signing chain
    const signingKey = ['aws4_request', 's3', s3Region, dateStamp].reduce(
        (key, msg) => crypto.createHmac('sha256', key).update(msg).digest(),
        Buffer.from(`AWS4${secretKey}`),
    );

    const signature = crypto
        .createHmac('sha256', signingKey)
        .update(stringToSign)
        .digest('hex');

    const signedUrl = `https://${host}/${key}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

    logger.info({ key, userId, bucket }, 'Storage: pre-signed upload URL generated');

    return {
        key,
        url: `https://${host}/${key}`,
        signedUploadUrl: signedUrl,
    };
}

/**
 * Generate a pre-signed URL for downloading/viewing a file from S3.
 */
export async function generateDownloadUrl(
    key: string,
): Promise<DownloadResult> {
    const expiresIn = 3600; // 1 hour

    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
        return {
            signedUrl: `http://localhost:9000/${env.STORAGE_BUCKET ?? 'skill-era'}/${key}?X-Amz-Signature=dev-mock`,
            expiresIn,
        };
    }

    const s3Endpoint = env.STORAGE_ENDPOINT;
    const s3Region = env.STORAGE_REGION ?? 'ap-south-1';
    const s3Bucket = env.STORAGE_BUCKET ?? 'skill-era';
    const accessKey = env.STORAGE_ACCESS_KEY;
    const secretKey = env.STORAGE_SECRET_KEY;

    if (!s3Endpoint || !accessKey || !secretKey) {
        return {
            signedUrl: `https://${s3Bucket}.s3.${s3Region}.amazonaws.com/${key}`,
            expiresIn,
        };
    }

    const host = `${s3Bucket}.${s3Endpoint.replace(/^https?:\/\//, '')}`;
    const now = new Date();
    const dateStamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '').split('T')[0]!;
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const credentialScope = `${dateStamp}/${s3Region}/s3/aws4_request`;

    const canonicalQueryString = [
        `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
        `X-Amz-Credential=${encodeURIComponent(`${accessKey}/${credentialScope}`)}`,
        `X-Amz-Date=${amzDate}`,
        `X-Amz-Expires=${expiresIn}`,
        `X-Amz-SignedHeaders=host`,
    ].sort().join('&');

    const canonicalRequest = [
        'GET',
        `/${key}`,
        canonicalQueryString,
        `host:${host}`,
        '',
        'host',
        'UNSIGNED-PAYLOAD',
    ].join('\n');

    const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = ['aws4_request', 's3', s3Region, dateStamp].reduce(
        (key, msg) => crypto.createHmac('sha256', key).update(msg).digest(),
        Buffer.from(`AWS4${secretKey}`),
    );

    const signature = crypto
        .createHmac('sha256', signingKey)
        .update(stringToSign)
        .digest('hex');

    return {
        signedUrl: `https://${host}/${key}?${canonicalQueryString}&X-Amz-Signature=${signature}`,
        expiresIn,
    };
}

/**
 * Delete a file from storage.
 * Used for KYC document cleanup after rejection.
 */
export async function deleteFile(key: string): Promise<void> {
    if (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
        logger.info({ key }, 'Storage (dev): simulated file deletion');
        return;
    }

    const s3Endpoint = env.STORAGE_ENDPOINT;
    const s3Bucket = env.STORAGE_BUCKET ?? 'skill-era';

    if (!s3Endpoint) {
        logger.warn({ key }, 'Storage: cannot delete — endpoint not configured');
        return;
    }

    try {
        const host = `${s3Bucket}.${s3Endpoint.replace(/^https?:\/\//, '')}`;
        await fetch(`https://${host}/${key}`, {
            method: 'DELETE',
            signal: AbortSignal.timeout(10_000),
        });
        logger.info({ key }, 'Storage: file deleted');
    } catch (err) {
        logger.error({ err, key }, 'Storage: file deletion failed');
    }
}
