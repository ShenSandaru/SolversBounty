-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "bounty_category" AS ENUM ('logic', 'mathematics', 'numerical_patterns', 'ciphers');

-- CreateEnum
CREATE TYPE "bounty_status" AS ENUM ('draft', 'funding_pending', 'active', 'closed');

-- CreateEnum
CREATE TYPE "bounty_close_reason" AS ENUM ('creator', 'deadline', 'fully_allocated', 'admin');

-- CreateEnum
CREATE TYPE "verification_method" AS ENUM ('exact', 'case_insensitive', 'normalized_text', 'numeric_exact');

-- CreateEnum
CREATE TYPE "funding_status" AS ENUM ('pending', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "funding_purpose" AS ENUM ('reward_pool', 'commission');

-- CreateEnum
CREATE TYPE "ledger_entry_type" AS ENUM ('deposit', 'reserve', 'settle', 'release', 'refund');

-- CreateEnum
CREATE TYPE "solving_session_status" AS ENUM ('active', 'completed');

-- CreateEnum
CREATE TYPE "ineligibility_reason" AS ENUM ('pool_exhausted', 'insufficient_refundable');

-- CreateEnum
CREATE TYPE "allocation_status" AS ENUM ('reserved', 'paid', 'released');

-- CreateEnum
CREATE TYPE "payout_status" AS ENUM ('pending', 'submitted', 'confirmed', 'failed', 'retryable');

-- CreateEnum
CREATE TYPE "chain_transaction_kind" AS ENUM ('deposit', 'payout', 'refund');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "wallet_address" VARCHAR(44) NOT NULL,
    "role" "user_role" NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_nonces" (
    "id" UUID NOT NULL,
    "user_wallet" VARCHAR(44) NOT NULL,
    "nonce" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "retired_at" TIMESTAMPTZ(6),

    CONSTRAINT "auth_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "refresh_token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bounties" (
    "id" UUID NOT NULL,
    "creator_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "category" "bounty_category" NOT NULL,
    "reward_lamports" BIGINT NOT NULL,
    "max_rewarded_solvers" INTEGER NOT NULL,
    "attempt_limit" INTEGER NOT NULL,
    "deadline" TIMESTAMPTZ(6) NOT NULL,
    "status" "bounty_status" NOT NULL DEFAULT 'draft',
    "close_reason" "bounty_close_reason",
    "published_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "bounties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bounty_questions" (
    "id" UUID NOT NULL,
    "bounty_id" UUID NOT NULL,
    "prompt" TEXT NOT NULL,
    "expected_answer_ciphertext" TEXT NOT NULL,
    "encryption_key_id" TEXT NOT NULL,
    "verification_method" "verification_method" NOT NULL,

    CONSTRAINT "bounty_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bounty_fundings" (
    "id" UUID NOT NULL,
    "bounty_id" UUID NOT NULL,
    "purpose" "funding_purpose" NOT NULL,
    "deposit_reference" TEXT NOT NULL,
    "expected_lamports" BIGINT NOT NULL,
    "observed_lamports" BIGINT,
    "chain_transaction_id" UUID,
    "status" "funding_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmed_at" TIMESTAMPTZ(6),

    CONSTRAINT "bounty_fundings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bounty_ledger_entries" (
    "id" UUID NOT NULL,
    "bounty_id" UUID NOT NULL,
    "entry_type" "ledger_entry_type" NOT NULL,
    "amount_lamports" BIGINT NOT NULL,
    "payout_id" UUID,
    "funding_id" UUID,
    "chain_transaction_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bounty_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- SEC-H6. Not represented in schema.prisma.
ALTER TABLE "bounty_ledger_entries"
ADD CONSTRAINT "bounty_ledger_entries_amount_lamports_positive"
CHECK ("amount_lamports" > 0);

-- CreateTable
CREATE TABLE "consent_records" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "bounty_id" UUID NOT NULL,
    "policy_version" TEXT NOT NULL,
    "accepted_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "consent_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solving_sessions" (
    "id" UUID NOT NULL,
    "bounty_id" UUID NOT NULL,
    "solver_id" UUID NOT NULL,
    "consent_id" UUID NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "status" "solving_session_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "solving_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submission_attempts" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "attempt_number" INTEGER NOT NULL,
    "submitted_answer" TEXT NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "ineligibility_reason" "ineligibility_reason",
    "submitted_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "submission_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reward_allocations" (
    "id" UUID NOT NULL,
    "bounty_id" UUID NOT NULL,
    "solver_id" UUID NOT NULL,
    "attempt_id" UUID NOT NULL,
    "amount_lamports" BIGINT NOT NULL,
    "status" "allocation_status" NOT NULL DEFAULT 'reserved',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reward_allocations_pkey" PRIMARY KEY ("id")
);

-- SEC-H6. Not represented in schema.prisma.
ALTER TABLE "reward_allocations"
ADD CONSTRAINT "reward_allocations_amount_lamports_positive"
CHECK ("amount_lamports" > 0);

-- CreateTable
CREATE TABLE "payouts" (
    "id" UUID NOT NULL,
    "allocation_id" UUID NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "status" "payout_status" NOT NULL DEFAULT 'pending',
    "send_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chain_transactions" (
    "id" UUID NOT NULL,
    "signature" TEXT NOT NULL,
    "kind" "chain_transaction_kind" NOT NULL,
    "amount_lamports" BIGINT NOT NULL,
    "source_address" VARCHAR(44) NOT NULL,
    "destination_address" VARCHAR(44) NOT NULL,
    "commitment" TEXT NOT NULL,
    "payout_id" UUID,
    "confirmed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chain_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "auth_nonces_nonce_key" ON "auth_nonces"("nonce");

-- CreateIndex
CREATE INDEX "auth_nonces_user_wallet_idx" ON "auth_nonces"("user_wallet");

-- Prisma cannot declare this partial index. One unused, unretired nonce per wallet.
CREATE UNIQUE INDEX auth_nonces_one_active_per_wallet
  ON auth_nonces (user_wallet)
  WHERE used_at IS NULL AND retired_at IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_refresh_token_hash_key" ON "auth_sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");

-- CreateIndex
CREATE INDEX "bounties_status_deadline_idx" ON "bounties"("status", "deadline");

-- CreateIndex
CREATE INDEX "bounties_creator_id_created_at_idx" ON "bounties"("creator_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bounty_questions_bounty_id_key" ON "bounty_questions"("bounty_id");

-- CreateIndex
CREATE UNIQUE INDEX "bounty_fundings_deposit_reference_key" ON "bounty_fundings"("deposit_reference");

-- CreateIndex
CREATE UNIQUE INDEX "bounty_fundings_bounty_id_purpose_key" ON "bounty_fundings"("bounty_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "bounty_fundings_chain_transaction_id_purpose_key" ON "bounty_fundings"("chain_transaction_id", "purpose");

-- CreateIndex
CREATE INDEX "bounty_ledger_entries_bounty_id_created_at_idx" ON "bounty_ledger_entries"("bounty_id", "created_at");

-- CreateIndex
CREATE INDEX "bounty_ledger_entries_payout_id_idx" ON "bounty_ledger_entries"("payout_id");

-- CreateIndex
CREATE INDEX "bounty_ledger_entries_funding_id_idx" ON "bounty_ledger_entries"("funding_id");

-- CreateIndex
CREATE UNIQUE INDEX "bounty_ledger_entries_chain_transaction_id_entry_type_key" ON "bounty_ledger_entries"("chain_transaction_id", "entry_type");

-- CreateIndex
CREATE INDEX "consent_records_bounty_id_idx" ON "consent_records"("bounty_id");

-- CreateIndex
CREATE UNIQUE INDEX "consent_records_user_id_bounty_id_key" ON "consent_records"("user_id", "bounty_id");

-- CreateIndex
CREATE INDEX "solving_sessions_solver_id_idx" ON "solving_sessions"("solver_id");

-- CreateIndex
CREATE INDEX "solving_sessions_consent_id_idx" ON "solving_sessions"("consent_id");

-- CreateIndex
CREATE UNIQUE INDEX "solving_sessions_bounty_id_solver_id_key" ON "solving_sessions"("bounty_id", "solver_id");

-- CreateIndex
CREATE UNIQUE INDEX "submission_attempts_session_id_attempt_number_key" ON "submission_attempts"("session_id", "attempt_number");

-- CreateIndex
CREATE UNIQUE INDEX "reward_allocations_attempt_id_key" ON "reward_allocations"("attempt_id");

-- CreateIndex
CREATE INDEX "reward_allocations_solver_id_idx" ON "reward_allocations"("solver_id");

-- CreateIndex
CREATE UNIQUE INDEX "reward_allocations_bounty_id_solver_id_key" ON "reward_allocations"("bounty_id", "solver_id");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_allocation_id_key" ON "payouts"("allocation_id");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_idempotency_key_key" ON "payouts"("idempotency_key");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "payouts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "chain_transactions_signature_key" ON "chain_transactions"("signature");

-- CreateIndex
CREATE INDEX "chain_transactions_payout_id_idx" ON "chain_transactions"("payout_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_created_at_idx" ON "audit_logs"("entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounties" ADD CONSTRAINT "bounties_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounty_questions" ADD CONSTRAINT "bounty_questions_bounty_id_fkey" FOREIGN KEY ("bounty_id") REFERENCES "bounties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounty_fundings" ADD CONSTRAINT "bounty_fundings_bounty_id_fkey" FOREIGN KEY ("bounty_id") REFERENCES "bounties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounty_fundings" ADD CONSTRAINT "bounty_fundings_chain_transaction_id_fkey" FOREIGN KEY ("chain_transaction_id") REFERENCES "chain_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounty_ledger_entries" ADD CONSTRAINT "bounty_ledger_entries_bounty_id_fkey" FOREIGN KEY ("bounty_id") REFERENCES "bounties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounty_ledger_entries" ADD CONSTRAINT "bounty_ledger_entries_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounty_ledger_entries" ADD CONSTRAINT "bounty_ledger_entries_funding_id_fkey" FOREIGN KEY ("funding_id") REFERENCES "bounty_fundings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounty_ledger_entries" ADD CONSTRAINT "bounty_ledger_entries_chain_transaction_id_fkey" FOREIGN KEY ("chain_transaction_id") REFERENCES "chain_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_records" ADD CONSTRAINT "consent_records_bounty_id_fkey" FOREIGN KEY ("bounty_id") REFERENCES "bounties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solving_sessions" ADD CONSTRAINT "solving_sessions_bounty_id_fkey" FOREIGN KEY ("bounty_id") REFERENCES "bounties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solving_sessions" ADD CONSTRAINT "solving_sessions_solver_id_fkey" FOREIGN KEY ("solver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "solving_sessions" ADD CONSTRAINT "solving_sessions_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "consent_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submission_attempts" ADD CONSTRAINT "submission_attempts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "solving_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_allocations" ADD CONSTRAINT "reward_allocations_bounty_id_fkey" FOREIGN KEY ("bounty_id") REFERENCES "bounties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_allocations" ADD CONSTRAINT "reward_allocations_solver_id_fkey" FOREIGN KEY ("solver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reward_allocations" ADD CONSTRAINT "reward_allocations_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "submission_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_allocation_id_fkey" FOREIGN KEY ("allocation_id") REFERENCES "reward_allocations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chain_transactions" ADD CONSTRAINT "chain_transactions_payout_id_fkey" FOREIGN KEY ("payout_id") REFERENCES "payouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
