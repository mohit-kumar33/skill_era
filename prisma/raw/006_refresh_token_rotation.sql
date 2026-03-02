-- 006_refresh_token_rotation.sql
-- Implements Refresh Token Rotation and Reuse Detection

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT false,
    replaced_by_id UUID UNIQUE REFERENCES refresh_tokens(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookup during token refresh
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- Documentation:
-- When a token is refreshed:
-- 1. JWT is verified (signature, expiry).
-- 2. Token hash is compared in this table.
-- 3. If found and NOT revoked:
--    - Revoke current token.
--    - Issue NEW token.
--    - Link old -> new via replaced_by_id.
-- 4. If found and IS revoked:
--    - THIS IS A REUSE ATTEMPT.
--    - Revoke every token in the chain (or all user tokens for safety).
--    - Log suspicious activity alert.
