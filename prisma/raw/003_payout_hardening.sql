-- ============================================================
-- Migration: 003_payout_hardening.sql
-- Purpose : Harden payout execution flow with fintech-grade
--           schema guarantees.
-- IMPORTANT: Run this inside a transaction. PostgreSQL enum
--            ADD VALUE cannot be inside a transaction in PG < 12,
--            so enum additions are done first, outside the txn.
-- ============================================================

-- ── Step 1: New enum values (must run outside BEGIN/COMMIT) ──
-- If already applied, these are safe to re-run (Postgres 12+)
ALTER TYPE "WithdrawalStatus" ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE "UserRole"         ADD VALUE IF NOT EXISTS 'finance_admin';
ALTER TYPE "UserRole"         ADD VALUE IF NOT EXISTS 'super_admin';

-- ── Step 2: Remaining changes inside transaction ─────────────
BEGIN;

-- 2a. Add payout_reference_id: UUID v4 set at payout execution.
--     UNIQUE constraint prevents any double-payout at DB level.
ALTER TABLE withdrawals
    ADD COLUMN IF NOT EXISTS payout_reference_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_withdrawals_payout_reference_id
    ON withdrawals (payout_reference_id)
    WHERE payout_reference_id IS NOT NULL;

-- 2b. Store gateway error reason when status = 'failed'.
ALTER TABLE withdrawals
    ADD COLUMN IF NOT EXISTS payout_error TEXT;

-- 2c. Track last state-change timestamp.
ALTER TABLE withdrawals
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2d. 2FA secret for finance_admin / super_admin.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(100);

-- 2e. Non-negative balance constraint on ledger (immutability guard).
--     wallet_transactions is INSERT-only; this prevents corrupt entries.
ALTER TABLE wallet_transactions
    DROP CONSTRAINT IF EXISTS chk_wt_non_negative_balance;

ALTER TABLE wallet_transactions
    ADD CONSTRAINT chk_wt_non_negative_balance
    CHECK (balance_before >= 0 AND balance_after >= 0);

-- 2f. wallet balance itself can never go negative.
ALTER TABLE wallets
    DROP CONSTRAINT IF EXISTS chk_wallets_non_negative;

ALTER TABLE wallets
    ADD CONSTRAINT chk_wallets_non_negative
    CHECK (deposit_balance >= 0 AND winning_balance >= 0 AND bonus_balance >= 0);

-- 2g. Performance index: payout_reference_id lookups.
CREATE INDEX IF NOT EXISTS idx_withdrawals_payout_ref
    ON withdrawals (payout_reference_id)
    WHERE payout_reference_id IS NOT NULL;

-- 2h. Composite index for admin approval queue queries.
CREATE INDEX IF NOT EXISTS idx_withdrawals_status_created
    ON withdrawals (status, created_at);

-- 2i. Enforce immutability on wallet_transactions via trigger.
--     Any UPDATE or DELETE will raise an exception.
CREATE OR REPLACE FUNCTION fn_deny_wallet_txn_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'wallet_transactions is immutable: UPDATE and DELETE are forbidden. '
        'Use compensating INSERT entries instead. '
        'Attempted operation: % on row id=%', TG_OP, OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS trg_deny_wallet_txn_update ON wallet_transactions;
CREATE TRIGGER trg_deny_wallet_txn_update
    BEFORE UPDATE ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION fn_deny_wallet_txn_mutation();

DROP TRIGGER IF EXISTS trg_deny_wallet_txn_delete ON wallet_transactions;
CREATE TRIGGER trg_deny_wallet_txn_delete
    BEFORE DELETE ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION fn_deny_wallet_txn_mutation();

-- 2j. Enforce immutability on admin_logs via trigger.
CREATE OR REPLACE FUNCTION fn_deny_admin_log_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION
        'admin_logs is immutable: UPDATE and DELETE are forbidden. '
        'Attempted operation: % on row id=%', TG_OP, OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS trg_deny_admin_log_update ON admin_logs;
CREATE TRIGGER trg_deny_admin_log_update
    BEFORE UPDATE ON admin_logs
    FOR EACH ROW EXECUTE FUNCTION fn_deny_admin_log_mutation();

DROP TRIGGER IF EXISTS trg_deny_admin_log_delete ON admin_logs;
CREATE TRIGGER trg_deny_admin_log_delete
    BEFORE DELETE ON admin_logs
    FOR EACH ROW EXECUTE FUNCTION fn_deny_admin_log_mutation();

COMMIT;

-- ── Step 3: Verification queries (run manually to confirm) ────
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'withdrawals' ORDER BY ordinal_position;
-- SELECT constraint_name FROM information_schema.table_constraints
--   WHERE table_name = 'wallet_transactions';
