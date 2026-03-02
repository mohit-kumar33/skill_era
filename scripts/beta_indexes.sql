-- Beta Hardening — Performance Indexes
-- Run this migration before beta launch.

-- Withdrawal velocity check: SELECT COUNT(*) WHERE user_id = ? AND created_at > ?
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_created
ON withdrawals(user_id, created_at);

-- Reconciliation job: SELECT * WHERE status = 'initiated' AND created_at < ?
CREATE INDEX IF NOT EXISTS idx_deposits_status_created
ON deposits(status, created_at)
WHERE status = 'initiated';

-- Fraud flag resolution check: SELECT COUNT(*) WHERE user_id = ? AND resolved_at IS NULL
CREATE INDEX IF NOT EXISTS idx_fraud_flags_user_unresolved
ON fraud_flags(user_id)
WHERE resolved_at IS NULL;

-- M3: Cross-user KYC uniqueness — prevents same document number across multiple accounts.
-- Partial unique index: only enforced for submitted/verified KYC with non-null doc number.
-- NULL values and rejected/pending statuses do not conflict.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_users_kyc_doc_verified
ON users (kyc_doc_number)
WHERE kyc_status IN ('submitted', 'verified') AND kyc_doc_number IS NOT NULL;
