-- ============================================================
-- Migration: 005_failed_payouts_dlq.sql
-- Purpose : Dead-letter queue table for exhausted payout retries.
--
-- When payout retry is exhausted (monitoring.service.ts emits
-- `retry_exhausted`), the payout.service inserts a row here and
-- fires a structured ALERT log event for ops escalation.
--
-- This table is append-only (DELETE/UPDATE blocked by convention).
-- Apply: psql -d skill_era -f prisma/raw/005_failed_payouts_dlq.sql
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS failed_payouts (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    withdrawal_id   UUID        NOT NULL REFERENCES withdrawals(id),
    payout_reference_id TEXT,   -- the idempotency key forwarded to gateway
    failure_reason  TEXT        NOT NULL,
    gateway_response JSONB,     -- raw gateway error payload (no PII)
    attempt_count   INTEGER     NOT NULL DEFAULT 1 CHECK (attempt_count > 0),
    -- Timestamps
    first_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_attempt_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────
-- Fast lookup by withdrawal for admin retry UI
CREATE UNIQUE INDEX IF NOT EXISTS idx_failed_payouts_withdrawal_id
    ON failed_payouts (withdrawal_id);

CREATE INDEX IF NOT EXISTS idx_failed_payouts_created_at
    ON failed_payouts (created_at DESC);

-- ── Comments ──────────────────────────────────────────────────────────
COMMENT ON TABLE failed_payouts IS
    'Dead-letter queue for payout retries exhausted after max attempts. '
    'Rows are written by payout.service.ts when retry_count >= MAX_RETRY. '
    'Ops must manually review and resolve these entries.';

COMMIT;
