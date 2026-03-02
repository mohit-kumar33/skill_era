-- ═══════════════════════════════════════════════════════════════════
-- POST-MIGRATION: Immutable Ledger Triggers
-- Run after Prisma migrate: psql -d skill_era -f prisma/raw/001_immutable_ledger.sql
-- ═══════════════════════════════════════════════════════════════════

-- Prevent UPDATE on wallet_transactions
CREATE OR REPLACE FUNCTION fn_prevent_wallet_txn_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'UPDATE on wallet_transactions is forbidden. Ledger entries are immutable.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_wallet_txn_update ON wallet_transactions;
CREATE TRIGGER trg_prevent_wallet_txn_update
    BEFORE UPDATE ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_wallet_txn_update();

-- Prevent DELETE on wallet_transactions
CREATE OR REPLACE FUNCTION fn_prevent_wallet_txn_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'DELETE on wallet_transactions is forbidden. Ledger entries are immutable.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_wallet_txn_delete ON wallet_transactions;
CREATE TRIGGER trg_prevent_wallet_txn_delete
    BEFORE DELETE ON wallet_transactions
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_wallet_txn_delete();
