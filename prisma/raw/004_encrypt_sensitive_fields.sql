-- ============================================================
-- Migration: 004_encrypt_sensitive_fields.sql
-- Purpose : Add encrypted columns for PAN and TOTP secrets,
--           and TOTP lockout tracking columns.
--
-- Run AFTER prisma migrate dev (or apply manually):
--   psql -d skill_era -f prisma/raw/004_encrypt_sensitive_fields.sql
--
-- Generate ENCRYPTION_KEY:
--   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
-- then add to .env: ENCRYPTION_KEY=<output>
-- ============================================================

BEGIN;

-- ── AES-256-GCM encrypted PAN ─────────────────────────────────────────
-- Each field stores one component of the (ciphertext, iv, authTag) triple.
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_pan     TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pan_iv            TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pan_auth_tag      TEXT;

-- ── AES-256-GCM encrypted TOTP secret ────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS encrypted_2fa_secret TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_iv              TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_auth_tag        TEXT;

-- ── 2FA activation flag ───────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN NOT NULL DEFAULT false;

-- ── TOTP lockout tracking ─────────────────────────────────────────────
-- Fail count resets to 0 on successful verification.
-- Lockout expires after 15 minutes (enforced at app layer).
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_fail_count    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_lockout_until TIMESTAMPTZ;

-- ── Add CHECK constraint: fail count cannot be negative ───────────────
ALTER TABLE users
    ADD CONSTRAINT IF NOT EXISTS chk_totp_fail_count_non_negative
    CHECK (totp_fail_count >= 0);

-- ── Index for lockout queries ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_totp_lockout
    ON users (totp_lockout_until)
    WHERE totp_lockout_until IS NOT NULL;

-- ── Migrate existing plaintext twoFactorSecret if column exists ───────
-- Existing rows set encrypted_2fa_secret = NULL (no encryption done here).
-- Plaintext migration must be done by the Node.js migration script
-- which has access to ENCRYPTION_KEY. See: prisma/raw/migrate_encrypt_fields.ts
--
-- Original `two_factor_secret` column is kept during migration window.
-- Drop with: ALTER TABLE users DROP COLUMN two_factor_secret;
-- after running the Node.js migration script.

COMMIT;

-- ── Verification queries ──────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'users'
-- ORDER BY ordinal_position;
