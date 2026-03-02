/**
 * Safe money handling utilities.
 * RULE: Never use JavaScript floating-point for money.
 * All amounts are strings representing NUMERIC(18,2) values.
 * All arithmetic happens in PostgreSQL, not in JS.
 */

const MONEY_REGEX = /^\d{1,16}(\.\d{1,2})?$/;

/**
 * Validate a money string — must be a valid positive decimal.
 */
export function isValidMoneyString(value: string): boolean {
    if (!value || !MONEY_REGEX.test(value)) return false;
    // Must not be zero or negative
    const numeric = parseFloat(value);
    return numeric > 0 && isFinite(numeric);
}

/**
 * Compare two money strings. Returns:
 * -1 if a < b
 *  0 if a === b
 *  1 if a > b
 * 
 * NOTE: For financial comparisons in production, prefer SQL.
 * This is for pre-validation only.
 */
export function compareMoney(a: string, b: string): -1 | 0 | 1 {
    const numA = parseFloat(a);
    const numB = parseFloat(b);
    if (numA < numB) return -1;
    if (numA > numB) return 1;
    return 0;
}

/**
 * Format a numeric value to 2 decimal places (display only).
 */
export function formatMoney(value: string): string {
    const parts = value.split('.');
    const integer = parts[0] ?? '0';
    const decimal = (parts[1] ?? '').padEnd(2, '0').slice(0, 2);
    return `${integer}.${decimal}`;
}
