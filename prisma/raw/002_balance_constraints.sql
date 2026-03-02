-- ═══════════════════════════════════════════════════════════════════
-- POST-MIGRATION: Balance Arithmetic & Non-Negative CHECK Constraints
-- Run after Prisma migrate: psql -d skill_era -f prisma/raw/002_balance_constraints.sql
-- ═══════════════════════════════════════════════════════════════════

-- Wallet balances must never go negative
ALTER TABLE wallets
    ADD CONSTRAINT IF NOT EXISTS chk_deposit_balance_non_negative
        CHECK (deposit_balance >= 0);

ALTER TABLE wallets
    ADD CONSTRAINT IF NOT EXISTS chk_winning_balance_non_negative
        CHECK (winning_balance >= 0);

ALTER TABLE wallets
    ADD CONSTRAINT IF NOT EXISTS chk_bonus_balance_non_negative
        CHECK (bonus_balance >= 0);

-- Ledger entry amounts must be non-negative
ALTER TABLE wallet_transactions
    ADD CONSTRAINT IF NOT EXISTS chk_debit_amount_non_negative
        CHECK (debit_amount >= 0);

ALTER TABLE wallet_transactions
    ADD CONSTRAINT IF NOT EXISTS chk_credit_amount_non_negative
        CHECK (credit_amount >= 0);

-- Ledger: exactly one side must be positive (double-entry)
ALTER TABLE wallet_transactions
    ADD CONSTRAINT IF NOT EXISTS chk_not_both_positive
        CHECK (NOT (debit_amount > 0 AND credit_amount > 0));

ALTER TABLE wallet_transactions
    ADD CONSTRAINT IF NOT EXISTS chk_at_least_one_positive
        CHECK (debit_amount > 0 OR credit_amount > 0);

-- Ledger: arithmetic must be consistent
ALTER TABLE wallet_transactions
    ADD CONSTRAINT IF NOT EXISTS chk_balance_arithmetic
        CHECK (balance_after = balance_before + credit_amount - debit_amount);

-- Ledger: balances must be non-negative
ALTER TABLE wallet_transactions
    ADD CONSTRAINT IF NOT EXISTS chk_balance_before_non_negative
        CHECK (balance_before >= 0);

ALTER TABLE wallet_transactions
    ADD CONSTRAINT IF NOT EXISTS chk_balance_after_non_negative
        CHECK (balance_after >= 0);

-- Deposit amount must be positive
ALTER TABLE deposits
    ADD CONSTRAINT IF NOT EXISTS chk_deposit_amount_positive
        CHECK (amount > 0);

-- Withdrawal amount must be positive
ALTER TABLE withdrawals
    ADD CONSTRAINT IF NOT EXISTS chk_withdrawal_amount_positive
        CHECK (amount > 0);

-- Fraud score must be non-negative
ALTER TABLE users
    ADD CONSTRAINT IF NOT EXISTS chk_fraud_score_non_negative
        CHECK (fraud_score >= 0);
