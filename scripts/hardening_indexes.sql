-- ═══════════════════════════════════════════════════════════════════════
-- HARDENING INDEXES — Beta Stabilization Phase 2
-- ═══════════════════════════════════════════════════════════════════════
-- Run ONCE per environment.
-- Safe to re-run (IF NOT EXISTS / CONCURRENTLY where possible).
-- ═══════════════════════════════════════════════════════════════════════

-- Missing index for withdrawal status lookups.
-- Used by: requestWithdrawal() pending check, admin withdrawal listing.
-- Without this, queries filter on user_id via existing index then scan
-- for status match — slow at scale with historical withdrawal data.
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_status
    ON withdrawals(user_id, status);

-- Fraud flag lookup by user (for payout revalidation).
-- revalidateFraud() counts WHERE userId = X AND resolvedAt IS NULL.
CREATE INDEX IF NOT EXISTS idx_fraud_flags_user_unresolved
    ON fraud_flags(user_id)
    WHERE resolved_at IS NULL;

-- Deposit lookup for AML detection (recent confirmed deposits).
-- Used by: AML same-amount cycle detection within 48h window.
CREATE INDEX IF NOT EXISTS idx_deposits_user_status_created
    ON deposits(user_id, status, created_at);
