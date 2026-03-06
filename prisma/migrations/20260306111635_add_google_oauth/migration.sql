-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'suspended', 'frozen', 'banned', 'pending_deletion', 'deleted');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('pending', 'submitted', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin', 'finance_admin', 'super_admin');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('deposit', 'entry_fee', 'prize', 'withdrawal', 'refund', 'commission', 'tds', 'gst');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'confirmed', 'failed');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('initiated', 'confirmed', 'failed', 'expired');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('requested', 'under_review', 'approved', 'paid', 'rejected', 'failed');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('draft', 'open', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ParticipantResult" AS ENUM ('pending', 'won', 'lost', 'draw');

-- CreateEnum
CREATE TYPE "MatchResultStatus" AS ENUM ('submitted', 'verified', 'disputed', 'rejected');

-- CreateEnum
CREATE TYPE "FraudFlagType" AS ENUM ('multi_ip', 'deposit_withdraw_velocity', 'large_withdrawal', 'high_win_ratio', 'duplicate_kyc', 'failed_logins', 'high_balance_withdrawal', 'device_fingerprint', 'same_ip_1v1', 'manual_flag');

-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "mobile" VARCHAR(20),
    "email" VARCHAR(255),
    "password_hash" TEXT,
    "google_id" VARCHAR(255),
    "auth_provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
    "date_of_birth" DATE,
    "age_verified" BOOLEAN NOT NULL DEFAULT false,
    "account_status" "AccountStatus" NOT NULL DEFAULT 'active',
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'pending',
    "kyc_doc_type" VARCHAR(50),
    "kyc_doc_number" VARCHAR(100),
    "kyc_doc_url" TEXT,
    "pan_number" VARCHAR(10),
    "encrypted_pan" TEXT,
    "pan_iv" TEXT,
    "pan_auth_tag" TEXT,
    "fraud_score" INTEGER NOT NULL DEFAULT 0,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "state" VARCHAR(50),
    "two_factor_secret" VARCHAR(100),
    "encrypted_2fa_secret" TEXT,
    "totp_iv" TEXT,
    "totp_auth_tag" TEXT,
    "two_fa_enabled" BOOLEAN NOT NULL DEFAULT false,
    "totp_fail_count" INTEGER NOT NULL DEFAULT 0,
    "totp_lockout_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "self_exclusion_until" TIMESTAMPTZ,
    "deletion_requested_at" TIMESTAMPTZ,
    "deletion_scheduled_for" TIMESTAMPTZ,
    "deletion_executed_at" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "replaced_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "deposit_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "winning_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "bonus_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reference_id" UUID,
    "transaction_type" "TransactionType" NOT NULL,
    "debit_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "balance_before" DECIMAL(18,2) NOT NULL,
    "balance_after" DECIMAL(18,2) NOT NULL,
    "status" "TransactionStatus" NOT NULL,
    "idempotency_key" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposits" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "gateway_transaction_id" VARCHAR(255),
    "status" "DepositStatus" NOT NULL DEFAULT 'initiated',
    "idempotency_key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "deposits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'requested',
    "fraud_score_snapshot" INTEGER NOT NULL DEFAULT 0,
    "tds_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(18,2),
    "admin_approved_by" UUID,
    "dual_approved_by" UUID,
    "admin_notes" TEXT,
    "gateway_payout_id" VARCHAR(255),
    "idempotency_key" VARCHAR(255) NOT NULL,
    "payout_reference_id" UUID,
    "payout_error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "processed_at" TIMESTAMPTZ,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" UUID NOT NULL,
    "game_type" VARCHAR(50) NOT NULL DEFAULT 'chess',
    "title" VARCHAR(255) NOT NULL,
    "entry_fee" DECIMAL(18,2) NOT NULL,
    "prize_pool" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "commission_percent" DECIMAL(5,2) NOT NULL,
    "max_participants" INTEGER NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'draft',
    "scheduled_at" TIMESTAMPTZ NOT NULL,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "participants" (
    "id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "result_status" "ParticipantResult" NOT NULL DEFAULT 'pending',
    "rank" INTEGER,
    "prize_won" DECIMAL(18,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_results" (
    "id" UUID NOT NULL,
    "tournament_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "screenshot_url" TEXT,
    "external_match_id" VARCHAR(255),
    "verified_by" UUID,
    "status" "MatchResultStatus" NOT NULL DEFAULT 'submitted',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_flags" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "flag_type" "FraudFlagType" NOT NULL,
    "risk_points" INTEGER NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ,

    CONSTRAINT "fraud_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admin_logs" (
    "id" UUID NOT NULL,
    "admin_id" UUID NOT NULL,
    "action_type" VARCHAR(100) NOT NULL,
    "target_user_id" UUID,
    "ip_address" VARCHAR(45),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treasury_snapshots" (
    "id" UUID NOT NULL,
    "total_user_balance" DECIMAL(18,2) NOT NULL,
    "pending_withdrawals" DECIMAL(18,2) NOT NULL,
    "settlement_pending" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "liquidity_ratio" DECIMAL(10,4) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "treasury_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_logs" (
    "id" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "reference_id" UUID,
    "gateway_reference" VARCHAR(255) NOT NULL,
    "issue_type" VARCHAR(100) NOT NULL,
    "local_amount" DECIMAL(18,2),
    "gateway_amount" DECIMAL(18,2),
    "reconciliation_date" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_mobile_key" ON "users"("mobile");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

-- CreateIndex
CREATE INDEX "users_account_status_idx" ON "users"("account_status");

-- CreateIndex
CREATE INDEX "users_kyc_status_idx" ON "users"("kyc_status");

-- CreateIndex
CREATE INDEX "users_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "users_kyc_doc_type_kyc_doc_number_idx" ON "users"("kyc_doc_type", "kyc_doc_number");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_replaced_by_id_key" ON "refresh_tokens"("replaced_by_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_token_hash_idx" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

-- CreateIndex
CREATE INDEX "wallets_user_id_idx" ON "wallets"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_idempotency_key_key" ON "wallet_transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "wallet_transactions_user_id_idx" ON "wallet_transactions"("user_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_reference_id_idx" ON "wallet_transactions"("reference_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_status_idx" ON "wallet_transactions"("status");

-- CreateIndex
CREATE INDEX "wallet_transactions_created_at_idx" ON "wallet_transactions"("created_at");

-- CreateIndex
CREATE INDEX "wallet_transactions_transaction_type_idx" ON "wallet_transactions"("transaction_type");

-- CreateIndex
CREATE UNIQUE INDEX "deposits_gateway_transaction_id_key" ON "deposits"("gateway_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "deposits_idempotency_key_key" ON "deposits"("idempotency_key");

-- CreateIndex
CREATE INDEX "deposits_user_id_idx" ON "deposits"("user_id");

-- CreateIndex
CREATE INDEX "deposits_status_idx" ON "deposits"("status");

-- CreateIndex
CREATE INDEX "deposits_created_at_idx" ON "deposits"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawals_idempotency_key_key" ON "withdrawals"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "withdrawals_payout_reference_id_key" ON "withdrawals"("payout_reference_id");

-- CreateIndex
CREATE INDEX "withdrawals_user_id_idx" ON "withdrawals"("user_id");

-- CreateIndex
CREATE INDEX "withdrawals_status_idx" ON "withdrawals"("status");

-- CreateIndex
CREATE INDEX "withdrawals_payout_reference_id_idx" ON "withdrawals"("payout_reference_id");

-- CreateIndex
CREATE INDEX "withdrawals_created_at_idx" ON "withdrawals"("created_at");

-- CreateIndex
CREATE INDEX "tournaments_status_idx" ON "tournaments"("status");

-- CreateIndex
CREATE INDEX "tournaments_scheduled_at_idx" ON "tournaments"("scheduled_at");

-- CreateIndex
CREATE INDEX "participants_user_id_idx" ON "participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "participants_tournament_id_user_id_key" ON "participants"("tournament_id", "user_id");

-- CreateIndex
CREATE INDEX "match_results_tournament_id_idx" ON "match_results"("tournament_id");

-- CreateIndex
CREATE INDEX "match_results_user_id_idx" ON "match_results"("user_id");

-- CreateIndex
CREATE INDEX "fraud_flags_user_id_idx" ON "fraud_flags"("user_id");

-- CreateIndex
CREATE INDEX "fraud_flags_flag_type_idx" ON "fraud_flags"("flag_type");

-- CreateIndex
CREATE INDEX "fraud_flags_created_at_idx" ON "fraud_flags"("created_at");

-- CreateIndex
CREATE INDEX "admin_logs_admin_id_idx" ON "admin_logs"("admin_id");

-- CreateIndex
CREATE INDEX "admin_logs_target_user_id_idx" ON "admin_logs"("target_user_id");

-- CreateIndex
CREATE INDEX "admin_logs_action_type_idx" ON "admin_logs"("action_type");

-- CreateIndex
CREATE INDEX "admin_logs_created_at_idx" ON "admin_logs"("created_at");

-- CreateIndex
CREATE INDEX "treasury_snapshots_created_at_idx" ON "treasury_snapshots"("created_at");

-- CreateIndex
CREATE INDEX "reconciliation_logs_reference_id_idx" ON "reconciliation_logs"("reference_id");

-- CreateIndex
CREATE INDEX "reconciliation_logs_issue_type_idx" ON "reconciliation_logs"("issue_type");

-- CreateIndex
CREATE INDEX "reconciliation_logs_reconciliation_date_idx" ON "reconciliation_logs"("reconciliation_date");

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_logs_reference_id_issue_type_reconciliation__key" ON "reconciliation_logs"("reference_id", "issue_type", "reconciliation_date");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "participants" ADD CONSTRAINT "participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fraud_flags" ADD CONSTRAINT "fraud_flags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admin_logs" ADD CONSTRAINT "admin_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
