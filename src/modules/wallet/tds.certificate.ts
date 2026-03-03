/**
 * TDS Certificate Generation — Section 194BA compliance.
 *
 * Generates a user-facing TDS certificate summarizing all TDS deductions
 * for a given financial year, equivalent to Form 26AS data for gaming.
 */

import { pool } from '../../config/database.js';
import { prisma } from '../../config/prisma.js';
import { logger } from '../../utils/logger.js';

interface TdsCertificate {
    userId: string;
    userName: string;
    panNumber: string | null;
    financialYear: string;
    deductorName: string;
    deductorTan: string;
    totalGrossAmount: string;
    totalTdsDeducted: string;
    totalNetPaid: string;
    deductions: Array<{
        withdrawalId: string;
        date: string;
        grossAmount: string;
        tdsAmount: string;
        netAmount: string;
        tdsRate: number;
    }>;
    generatedAt: string;
}

function getFinancialYearDates(fyLabel: string): {
    start: Date; end: Date;
} {
    // fyLabel format: "2025-2026"
    const [startYear] = fyLabel.split('-').map(Number);
    return {
        start: new Date(startYear!, 3, 1),  // April 1
        end: new Date(startYear! + 1, 2, 31, 23, 59, 59),  // March 31
    };
}

export async function generateTdsCertificate(
    userId: string,
    financialYear: string,
): Promise<TdsCertificate> {
    const fy = getFinancialYearDates(financialYear);

    // Get user details
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            mobile: true,
            email: true,
            kycDocType: true,
            kycDocNumber: true,
        },
    });

    if (!user) throw new Error('User not found');

    const panNumber = user.kycDocType === 'pan' ? user.kycDocNumber : null;

    // All withdrawals with TDS in this FY
    const client = await pool.connect();
    try {
        const result = await client.query(
            `SELECT
                w.id AS withdrawal_id,
                w.amount AS gross_amount,
                w.tds_amount,
                w.net_amount,
                w.created_at AS withdrawal_date,
                w.status
             FROM withdrawals w
             WHERE w.user_id = $1
               AND w.created_at >= $2
               AND w.created_at <= $3
               AND w.tds_amount > 0
               AND w.status IN ('paid', 'confirmed', 'approved', 'requested')
             ORDER BY w.created_at ASC`,
            [userId, fy.start, fy.end],
        );

        const deductions = result.rows.map((r: any) => ({
            withdrawalId: r.withdrawal_id,
            date: r.withdrawal_date.toISOString(),
            grossAmount: r.gross_amount?.toString() ?? '0',
            tdsAmount: r.tds_amount?.toString() ?? '0',
            netAmount: r.net_amount?.toString() ?? '0',
            tdsRate: 0.30,
        }));

        const totalGross = deductions.reduce((sum: number, d: any) => sum + parseFloat(d.grossAmount), 0);
        const totalTds = deductions.reduce((sum: number, d: any) => sum + parseFloat(d.tdsAmount), 0);
        const totalNet = deductions.reduce((sum: number, d: any) => sum + parseFloat(d.netAmount), 0);

        logger.info(
            { userId, financialYear, deductionCount: deductions.length },
            'TDS certificate generated',
        );

        return {
            userId,
            userName: user.mobile,
            panNumber,
            financialYear,
            deductorName: 'Skill Era Gaming Pvt. Ltd.',
            deductorTan: process.env['COMPANY_TAN'] ?? 'XXXXXXXXXX',
            totalGrossAmount: totalGross.toFixed(2),
            totalTdsDeducted: totalTds.toFixed(2),
            totalNetPaid: totalNet.toFixed(2),
            deductions,
            generatedAt: new Date().toISOString(),
        };
    } finally {
        client.release();
    }
}
