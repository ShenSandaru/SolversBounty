# Security checklist

Status: Phase 5 review checklist. Items are gates for later milestones. Checking a box requires the evidence named here, not a module folder.

Related: [threat model](THREAT_MODEL.md), [security review](SECURITY_REVIEW.md).

Kinds: **Verified** means the current tree already does this. **Gate** means a later milestone is not done without it.

## Current shell

- [x] **Verified.** `/health` returns process liveness only. Evidence: `HealthController` and the Phase 4 HTTP check.
- [x] **Verified.** `/health/ready` is a separate dependency check and does not echo a database URL. Evidence: `readiness.ts` and the Phase 4 503 probe.
- [x] **Verified.** Unexpected errors omit stacks. Evidence: `ApiExceptionFilter` and `api-conventions.spec.ts`.
- [x] **Verified.** Request logs omit the query string and the body. Evidence: `RequestLogInterceptor`.
- [x] **Verified.** Public bounty JSON cannot carry `expectedAnswer`. Evidence: `publicBountySchema` and the marketplace fixture test.
- [x] **Verified.** The preview create form does not send the expected answer. Evidence: `CreateBountyForm`.
- [x] **Verified.** No treasury key, answer key, or seed is in git, the schema, or the web app. Evidence: schema inspection and the Phase 4 secret search.
- [x] **Verified.** Lamports are `bigint` in shared code and `BigInt` in Prisma. Evidence: `lamports.ts`, `schema.prisma`.
- [ ] **Gate, SEC-M1.** Nonce and submission routes call the in-memory limiter. Evidence: an API test that the 11th nonce in a minute returns 429 `RATE_LIMITED`.
- [ ] **Gate, SEC-M2.** Every product write uses a Zod schema. Evidence: an invalid enum test per write route.
- [ ] **Gate, SEC-M6.** The demo's process check uses `/health/ready` before a funding or payout walkthrough. Evidence: a note in the demo script.

## Authentication

Do not treat a provider as selected. Privy, Reown, and native SIWS are still open.

- [ ] **Gate, SEC-H4.** The initial migration contains `auth_nonces_one_active_per_wallet`. Evidence: the migration SQL, applied only to a local development database.
- [ ] **Gate, AUTH-002.** The nonce is server-generated, at least 128 bits, and the previous active nonce is retired in the same transaction. Evidence: two outstanding nonces cannot both verify.
- [ ] **Gate, AUTH-004.** Ed25519 verification is local. A wrong message, wallet, or nonce gets no session. Evidence: AUTH-004 and AUTH-008 tests.
- [ ] **Gate, message binding.** The signed message includes domain, URI, wallet, nonce, issued-at, expiration, `solana:devnet`, and a statement that it is not a transfer. Evidence: a test that a mainnet chain id and a foreign domain fail.
- [ ] **Gate, AUTH-009.** A used or expired nonce does not issue a session. Consumption commits with the session insert.
- [ ] **Gate, AUTH-006 and AUTH-007.** The server stores a hash, disconnect revokes it, and the old credential fails. Evidence: a request after disconnect returns 401.
- [ ] **Gate, SEC-L4.** Wallet strings pass a Solana public-key check before insert. One new secret is hashed per session.
- [ ] **Gate, AUTH-010.** No request field accepts a seed or secret key. Logs of a failed login do not contain one.
- [ ] **Gate, SEC-I3.** A second wallet creates a second user. The implementation does not rewrite `walletAddress` in place.
- [ ] **Gate, PD-04.** Admin comes from `ADMIN_WALLET_ALLOWLIST`. An empty list creates no admin. A client role field is ignored.

## Bounty, consent, and answers

- [ ] **Gate, SEC-H5.** The expected answer is AES-256-GCM ciphertext before insert. The payload carries its nonce and tag. `encryptionKeyId` is stored. Evidence: PRIV-009, and a public GET snapshot with no plaintext.
- [ ] **Gate, SEC-H5.** Decrypt runs only in verification and the owner read. A bad key is 500 `INTERNAL` and does not mark the attempt incorrect.
- [ ] **Gate, BOUNTY-006.** Another creator's private bounty read is not found. Evidence: BOUNTY-006 test.
- [ ] **Gate, SOLVE-008.** A solving session insert requires a consent row for that user and bounty. Evidence: a session without consent is rejected and stores no attempt.
- [ ] **Gate, NFR-020.** `startedAt` and `submittedAt` are server times. Client timestamps are ignored.
- [ ] **Gate, VERIFY-009.** Client `isCorrect` is ignored. Evidence: a wrong answer with `isCorrect: true` is stored incorrect and unpaid.
- [ ] **Gate, SOLVE-004.** Attempt numbers are assigned inside the session transaction and cannot exceed `attemptLimit`.
- [ ] **Gate, SEC-M5.** Submitted answers are selected only for the owner and the submitting solver. Aggregates do not load the text.
- [ ] **Gate, SEC-I2.** Docs and consent copy still say a wallet is not one human and the product is not Sybil-proof.

## Ledger and payouts

The identity under test is `funded = reserved + paid + refundable + refunded`.

- [ ] **Gate, SEC-H1.** The E1 transaction locks the bounty row. Two concurrent correct solvers cannot both take the last slot. Evidence: a payment-safety test.
- [ ] **Gate, PAY-002.** The unique `(bountyId, solverId)` constraint is covered by a same-wallet double submit.
- [ ] **Gate, SEC-H6.** Allocation amount is copied from `Bounty.rewardLamports`. Client amounts are ignored. Ledger amounts are positive.
- [ ] **Gate, NFR-016.** A test asserts the identity after deposit, reserve, settle, release, and a rolled-back reservation.
- [ ] **Gate, SEC-H3.** Deposit activation checks commitment, treasury destination, creator source, system SOL, memo, and amount. The client signature alone does not activate.
- [ ] **Gate, SEC-M3.** A deposit signature cannot also settle a payout. Reprocessing a signature does not post a second entry.
- [ ] **Gate, SEC-H2.** A `submitted` or `confirmed` payout is not signed again. Before a new signature, the worker looks up memo `sb:payout:<payoutId>`.
- [ ] **Gate, PAY-006.** A known-dead signature stays on `ChainTransaction`, and the same payout row moves to `retryable`.
- [ ] **Gate, SEC-H7.** The worker does not sign when the treasury balance is below the sum of `reserved + refundable` plus the fee. Principal ledger rows do not pay fees.
- [ ] **Gate, ADR-008.** Deadline or full allocation does not refund unallocated principal to the creator and does not add it to `paid`. Creator close and admin close do not apply that retention. In-flight payouts stay `reserved`. Retention is not implemented.
- [ ] **Gate, SEC-C1.** The treasury key is absent from the client bundle, logs, fixtures, and Postgres. The answer key is a different secret. Evidence: PAY-014 review of a payout test run.
- [ ] **Gate, SEC-I4.** No balance cache column is added unless a later ADR says why the ledger sum is insufficient.

## Operations

- [ ] **Gate, migration.** The first migration is created only against local Postgres. It includes the partial nonce index. It is not applied to a shared or production database. `migrate reset` is not used.
- [ ] **Gate, SEC-M7.** Application logs do not print the `secrets` config object.
- [ ] **Gate, SEC-M8.** OpenAPI for public routes has no ciphertext, submitted answer, or session secret.
- [ ] **Gate, SEC-L2.** A deployed origin list is explicit. `CORS_ORIGIN=*` is not the production value.
- [ ] **Gate, SEC-C1.** Demo treasury balances stay small. The key is not reused on mainnet.
