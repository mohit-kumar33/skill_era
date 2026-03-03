/**
 * Reports Service — Regulatory & compliance report generation.
 *
 * Provides structured exports for:
 *   1. TDS Report    — All TDS deductions with user details
 *   2. AML Report    — Fraud flags, suspicious transactions
 *   3. Audit Log     — All admin actions (immutable)
 *
 * All reports support date range filtering and pagination.
 * Returns JSON format; CSV conversion is caller-side.
 */

import { pool } from '../../config/database.js';
import { prisma } from '../../config/prisma.js';
import { logger } from '../../utils/logger.js';

// ── Types ──────────────────────────────────────────────────────────────

interface DateRange {
    startDate: Date;
    endDate: Date;
}

interface PaginationParams {
    page: number;
    limit: number;
}

// ═══════════════════════════════════════════════════════════════════════
// TDS REPORT
// ═══════════════════════════════════════════════════════════════════════
//
// Reports all TDS (Tax Deducted at Source) applied to withdrawals.
// Required quarterly by Indian income tax regulations for TDS filing.
// ═══════════════════════════════════════════════════════════════════════

export async function generateTdsReport(
    range: DateRange,
    pagination: PaginationParams,
) {
    const { startDate, endDate } = range;
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const client = await pool.connect();
    try {
        // Query: all withdrawals with TDS in date range
        const dataResult = await client.query(
            `SELECT
                w.id AS withdrawal_id,
                w.user_id,
                u.mobile,
                u.email,
                u.kyc_doc_type AS pan_type,
                u.kyc_doc_number AS pan_number,
                w.amount AS gross_amount,
                w.tds_amount,
                w.net_amount,
                w.status,
                w.created_at AS withdrawal_date,
                w.processed_at AS payout_date
             FROM withdrawals w
             JOIN users u ON w.user_id = u.id
             WHERE w.created_at >= $1
               AND w.created_at <= $2
               AND w.tds_amount > 0
             ORDER BY w.created_at ASC
             LIMIT $3 OFFSET $4`,
            [startDate, endDate, limit, offset],
        );

        // Aggregates for report header
        const aggResult = await client.query(
            `SELECT
                COUNT(*)::int AS total_records,
                COALESCE(SUM(tds_amount), 0) AS total_tds_collected,
                COALESCE(SUM(amount), 0) AS total_gross_amount,
                COALESCE(SUM(net_amount), 0) AS total_net_disbursed
             FROM withdrawals
             WHERE created_at >= $1
               AND created_at <= $2
               AND tds_amount > 0`,
            [startDate, endDate],
        );

        const agg = aggResult.rows[0];

        logger.info(
            { startDate, endDate, records: agg.total_records },
            'TDS report generated',
        );

        return {
            reportType: 'TDS_DEDUCTION_REPORT',
            period: {
                from: startDate.toISOString(),
                to: endDate.toISOString(),
            },
            summary: {
                totalRecords: agg.total_records,
                totalTdsCollected: agg.total_tds_collected.toString(),
                totalGrossAmount: agg.total_gross_amount.toString(),
                totalNetDisbursed: agg.total_net_disbursed.toString(),
            },
            records: dataResult.rows.map((r: any) => ({
                withdrawalId: r.withdrawal_id,
                userId: r.user_id,
                mobile: r.mobile,
                email: r.email,
                panType: r.pan_type,
                panNumber: r.pan_number,
                grossAmount: r.gross_amount?.toString(),
                tdsAmount: r.tds_amount?.toString(),
                netAmount: r.net_amount?.toString(),
                status: r.status,
                withdrawalDate: r.withdrawal_date,
                payoutDate: r.payout_date,
            })),
            pagination: {
                page,
                limit,
                total: agg.total_records,
                totalPages: Math.ceil(agg.total_records / limit),
            },
            generatedAt: new Date().toISOString(),
        };
    } finally {
        client.release();
    }
}

// ═══════════════════════════════════════════════════════════════════════
// AML REPORT (Anti-Money Laundering)
// ═══════════════════════════════════════════════════════════════════════
//
// Reports all fraud flags, suspicious transaction patterns, and
// AML-triggered events. Required for regulatory compliance.
// ═══════════════════════════════════════════════════════════════════════

export async function generateAmlReport(
    range: DateRange,
    pagination: PaginationParams,
) {
    const { startDate, endDate } = range;
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    // Fraud flags in date range
    const [flags, total] = await Promise.all([
        prisma.fraudFlag.findMany({
            where: {
                createdAt: { gte: startDate, lte: endDate },
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit,
            include: {
                user: {
                    select: {
                        id: true,
                        mobile: true,
                        email: true,
                        accountStatus: true,
                        fraudScore: true,
                        kycStatus: true,
                    },
                },
            },
        }),
        prisma.fraudFlag.count({
            where: {
                createdAt: { gte: startDate, lte: endDate },
            },
        }),
    ]);

    // Aggregate by flag type
    const flagTypeSummary = await prisma.fraudFlag.groupBy({
        by: ['flagType'],
        where: {
            createdAt: { gte: startDate, lte: endDate },
        },
        _count: true,
        _sum: { riskPoints: true },
    });

    // High-risk users (fraudScore >= 50) in range
    const highRiskUsers = await prisma.user.count({
        where: {
            fraudScore: { gte: 50 },
            updatedAt: { gte: startDate, lte: endDate },
        },
    });

    // Frozen/banned accounts in range
    const frozenAccounts = await prisma.user.count({
        where: {
            accountStatus: { in: ['frozen', 'banned'] },
            updatedAt: { gte: startDate, lte: endDate },
        },
    });

    logger.info(
        { startDate, endDate, records: total },
        'AML report generated',
    );

    return {
        reportType: 'AML_SUSPICIOUS_ACTIVITY_REPORT',
        period: {
            from: startDate.toISOString(),
            to: endDate.toISOString(),
        },
        summary: {
            totalFlags: total,
            highRiskUsers,
            frozenAccounts,
            flagBreakdown: flagTypeSummary.map(f => ({
                type: f.flagType,
                count: f._count,
                totalRiskPoints: f._sum.riskPoints ?? 0,
            })),
        },
        records: flags.map(f => ({
            id: f.id,
            userId: f.userId,
            userMobile: f.user.mobile,
            userEmail: f.user.email,
            accountStatus: f.user.accountStatus,
            currentFraudScore: f.user.fraudScore,
            kycStatus: f.user.kycStatus,
            flagType: f.flagType,
            riskPoints: f.riskPoints,
            description: f.description,
            createdAt: f.createdAt,
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        generatedAt: new Date().toISOString(),
    };
}

// ═══════════════════════════════════════════════════════════════════════
// AUDIT LOG EXPORT
// ═══════════════════════════════════════════════════════════════════════
//
// Exports all admin actions for compliance and governance review.
// Immutable — admin_logs table has no UPDATE/DELETE operations.
// ═══════════════════════════════════════════════════════════════════════

export async function exportAuditLog(
    range: DateRange,
    pagination: PaginationParams,
) {
    const { startDate, endDate } = range;
    const { page, limit } = pagination;
    const offset = (page - 1) * limit;

    const [logs, total] = await Promise.all([
        prisma.adminLog.findMany({
            where: {
                createdAt: { gte: startDate, lte: endDate },
            },
            orderBy: { createdAt: 'desc' },
            skip: offset,
            take: limit,
            include: {
                admin: { select: { id: true, mobile: true, email: true } },
                targetUser: { select: { id: true, mobile: true, email: true } },
            },
        }),
        prisma.adminLog.count({
            where: {
                createdAt: { gte: startDate, lte: endDate },
            },
        }),
    ]);

    // Action type summary
    const actionSummary = await prisma.adminLog.groupBy({
        by: ['actionType'],
        where: {
            createdAt: { gte: startDate, lte: endDate },
        },
        _count: true,
    });

    logger.info(
        { startDate, endDate, records: total },
        'Audit log exported',
    );

    return {
        reportType: 'ADMIN_AUDIT_LOG_EXPORT',
        period: {
            from: startDate.toISOString(),
            to: endDate.toISOString(),
        },
        summary: {
            totalActions: total,
            actionBreakdown: actionSummary.map(a => ({
                actionType: a.actionType,
                count: a._count,
            })),
        },
        records: logs.map(log => ({
            id: log.id,
            adminId: log.adminId,
            adminMobile: log.admin?.mobile,
            adminEmail: log.admin?.email,
            actionType: log.actionType,
            targetUserId: log.targetUserId,
            targetUserMobile: log.targetUser?.mobile,
            targetUserEmail: log.targetUser?.email,
            ipAddress: log.ipAddress,
            metadata: log.metadata,
            createdAt: log.createdAt,
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
        generatedAt: new Date().toISOString(),
    };
}
