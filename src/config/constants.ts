/**
 * Business rule constants for Skill Era.
 * All financial thresholds in INR (paisa-free, decimal handling in SQL).
 */

// ── Deposit ───────────────────────────────────────────
export const MIN_DEPOSIT_AMOUNT = '100.00';      // ₹100 minimum
export const MAX_DEPOSIT_AMOUNT = '100000.00';    // ₹1,00,000 per transaction

// ── Withdrawal ────────────────────────────────────────
export const MIN_WITHDRAWAL_AMOUNT = '100.00';    // ₹100 minimum
export const MAX_WITHDRAWAL_AMOUNT = '200000.00'; // ₹2,00,000 per transaction
export const WITHDRAWAL_COOLDOWN_HOURS = 24;      // Hours after deposit before withdrawal allowed
export const DUAL_APPROVAL_THRESHOLD = '25000.00'; // ₹25,000 — requires two admins

// ── Treasury ──────────────────────────────────────────
export const MIN_LIQUIDITY_RATIO = 1.3;           // Platform must hold 1.3x pending withdrawals

// ── Tournament ────────────────────────────────────────
export const MIN_COMMISSION_PERCENT = 10;
export const MAX_COMMISSION_PERCENT = 20;
export const MIN_ENTRY_FEE = '10.00';             // ₹10 minimum
export const MAX_PARTICIPANTS_LIMIT = 10000;

// ── Fraud ─────────────────────────────────────────────
export const FRAUD_AUTO_FREEZE_THRESHOLD = 80;    // Score >= 80 = auto freeze

// ── Auth ──────────────────────────────────────────────
export const BCRYPT_ROUNDS = 12;
export const MIN_AGE_YEARS = 18;

// ── Geo-Blocked States (India) ────────────────────────
export const BLOCKED_STATES: readonly string[] = [
    'Assam',
    'Odisha',
    'Telangana',
    'Andhra Pradesh',
    'Nagaland',
    'Sikkim',
] as const;

// ── Disposable Email Domains (L1 Security Check) ──────
export const DISPOSABLE_EMAIL_DOMAINS: readonly string[] = [
    'guerrillamail.com',
    'guerrillamailblock.com',
    'guerrillamail.net',
    'guerrillamail.org',
    'guerrillamail.biz',
    '10minutemail.com',
    '10minutemail.net',
    '10minutemail.org',
    'mailinator.com',
    'temp-mail.org',
    'throwawaymail.com',
    'yopmail.com',
    'dispostable.com',
] as const;

// ── Rate Limits ───────────────────────────────────────
export const RATE_LIMITS = {
    login: { max: 5, timeWindow: '15 minutes' },
    register: { max: 3, timeWindow: '1 hour' },
    deposit: { max: 10, timeWindow: '1 minute' },
    withdrawal: { max: 5, timeWindow: '1 minute' },
    tournamentJoin: { max: 10, timeWindow: '1 minute' },
    general: { max: 100, timeWindow: '1 minute' },
} as const;

// ── TDS (Section 194BA) ───────────────────────────────
export const TDS_NET_WINNINGS_THRESHOLD = 10000;  // ₹10,000 annual net winnings threshold
export const TDS_RATE = 0.30;                     // 30%
export const TDS_NO_PAN_RATE = 0.30;              // 30% if no PAN

// ── Fraud Hardening ──────────────────────────────────
export const MAX_WITHDRAWALS_PER_DAY = 3;          // Velocity check: max 3 withdrawals per 24h
export const SAME_IP_MATCH_PENALTY = 20;           // Fraud score increment for same-IP 1v1 match
export const FRAUD_FINGERPRINT_SALT = process.env['FRAUD_FINGERPRINT_SALT'] ?? 'skill-era-beta-salt-2026';
export const MAX_ACCOUNTS_PER_DEVICE = 3;           // Flag if same device fingerprint used by >3 users
export const GEO_CHANGE_WINDOW_MINUTES = 30;        // Flag if IP geo changes within 30 minutes

// ── GST (28% on online gaming — effective 1 Oct 2023) ──
export const GST_RATE = 0.28;                         // 28% GST on entry fee (inclusive)

// ── Responsible Gaming ────────────────────────────────
export const DAILY_DEPOSIT_CAP = '10000.00';          // ₹10,000 daily deposit limit
export const WEEKLY_DEPOSIT_CAP = '50000.00';         // ₹50,000 weekly deposit limit
export const SELF_EXCLUSION_DURATIONS = [1, 7, 30, 365] as const; // days

// ── Log Retention ─────────────────────────────────────
export const LOG_RETENTION_DAYS = 1825;               // 5 years (PMLA requirement)

// ── DPDP Act ──────────────────────────────────────────
export const ACCOUNT_DELETION_GRACE_DAYS = 30;        // 30-day grace period before PII anonymization
export const FINANCIAL_RECORD_RETENTION_YEARS = 5;    // Retain financial records even after deletion

