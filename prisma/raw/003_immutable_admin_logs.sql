-- ═══════════════════════════════════════════════════════════════════
-- POST-MIGRATION: Immutable Admin Logs
-- Run after Prisma migrate: psql -d skill_era -f prisma/raw/003_immutable_admin_logs.sql
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION fn_prevent_admin_log_update()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'UPDATE on admin_logs is forbidden. Audit logs are immutable.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_admin_log_update ON admin_logs;
CREATE TRIGGER trg_prevent_admin_log_update
    BEFORE UPDATE ON admin_logs
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_admin_log_update();

CREATE OR REPLACE FUNCTION fn_prevent_admin_log_delete()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'DELETE on admin_logs is forbidden. Audit logs are immutable.';
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_admin_log_delete ON admin_logs;
CREATE TRIGGER trg_prevent_admin_log_delete
    BEFORE DELETE ON admin_logs
    FOR EACH ROW
    EXECUTE FUNCTION fn_prevent_admin_log_delete();
