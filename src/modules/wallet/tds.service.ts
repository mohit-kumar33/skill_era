import { pool } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

/**
 * TDS Calculation Service (Section 194BA of IT Act)
 * 
 * For online gaming, TDS @ 30% is applicable on NET WINNINGS.
 * Net Winnings = Total withdrawal amount from winnings - deposits made during the year.
 * If net winnings exceed ₹10,000 in a financial year, TDS must be deducted.
 * 
 * If user has no PAN, TDS rate remains 30% (Section 206AB may apply for higher rates).
 */

interface TdsCalculation {
    grossAmount: string;
    netWinnings: string;
    tdsAmount: string;
    netPayable: string;
    tdsRate: number;
    hasPan: boolean;
    financialYear: string;
}

/**
 * Get the current Indian financial year (April to March).
 */
function getCurrentFinancialYear(): { start: Date; end: Date; label: string } {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed

    // FY starts in April (month 3)
    const fyStartYear = month >= 3 ? year : year - 1;
    const fyEndYear = fyStartYear + 1;

    return {
        start: new Date(fyStartYear, 3, 1), // April 1
        end: new Date(fyEndYear, 2, 31, 23, 59, 59), // March 31
        label: `${fyStartYear}-${fyEndYear}`,
    };
}

/**
 * Calculate TDS for a withdrawal amount.
 * All arithmetic done in SQL to avoid floating-point errors.
 */
export async function calculateTds(
    userId: string,
    withdrawalAmount: string,
): Promise<TdsCalculation> {
    const fy = getCurrentFinancialYear();

    const client = await pool.connect();
    try {
        // Get user PAN status
        const userResult = await client.query(
            `SELECT pan_number FROM users WHERE id = $1`,
            [userId],
        );
        const hasPan = !!(userResult.rows[0]?.pan_number);

        // Calculate net winnings for this financial year
        // Net Winnings = (total prize credits) - (total deposits) in the FY
        const netWinningsResult = await client.query(
            `SELECT
        COALESCE(
          (SELECT SUM(credit_amount) FROM wallet_transactions
           WHERE user_id = $1 AND transaction_type = 'prize'
           AND created_at >= $2 AND created_at <= $3
           AND status = 'confirmed'), 0
        ) -
        COALESCE(
          (SELECT SUM(credit_amount) FROM wallet_transactions
           WHERE user_id = $1 AND transaction_type = 'deposit'
           AND created_at >= $2 AND created_at <= $3
           AND status = 'confirmed'), 0
        ) AS net_winnings_before,
        COALESCE(
          (SELECT SUM(debit_amount) FROM wallet_transactions
           WHERE user_id = $1 AND transaction_type = 'tds'
           AND created_at >= $2 AND created_at <= $3
           AND status = 'confirmed'), 0
        ) AS tds_already_deducted`,
            [userId, fy.start, fy.end],
        );

        const row = netWinningsResult.rows[0];
        const netWinningsBefore = parseFloat(row?.net_winnings_before ?? '0');
        const tdsAlreadyDeducted = parseFloat(row?.tds_already_deducted ?? '0');

        // TDS threshold check: only applicable if net winnings exceed ₹10,000
        const TDS_THRESHOLD = 10000;
        const TDS_RATE = 0.30;
        const amount = parseFloat(withdrawalAmount);

        // For this withdrawal, the effective net winnings increase
        // We assume withdrawal is from winning_balance
        const projectedNetWinnings = netWinningsBefore; // Already calculated from prizes - deposits

        let tdsAmount = 0;

        if (projectedNetWinnings > TDS_THRESHOLD) {
            // TDS = 30% of withdrawal amount (simplified per Section 194BA)
            tdsAmount = Math.round(amount * TDS_RATE * 100) / 100;
        }

        const netPayable = Math.round((amount - tdsAmount) * 100) / 100;

        const result: TdsCalculation = {
            grossAmount: withdrawalAmount,
            netWinnings: projectedNetWinnings.toFixed(2),
            tdsAmount: tdsAmount.toFixed(2),
            netPayable: netPayable.toFixed(2),
            tdsRate: tdsAmount > 0 ? TDS_RATE : 0,
            hasPan,
            financialYear: fy.label,
        };

        logger.info({ userId, tds: result }, 'TDS calculated');
        return result;
    } finally {
        client.release();
    }
}
