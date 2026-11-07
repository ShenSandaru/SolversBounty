# AGENTS.md

Authoritative instructions for humans and AI coding agents working in this repository.

Product behavior lives in [docs/product/PRD.md](docs/product/PRD.md) and [docs/product/REQUIREMENTS.md](docs/product/REQUIREMENTS.md). Architecture lives under [docs/architecture](docs/architecture/SYSTEM_ARCHITECTURE.md). Decisions that are already locked live in [docs/decisions](docs/decisions/README.md). This file wins on **how to work**. Those documents win on **what to build**. If they conflict, stop and report the conflict. Do not silently pick a side.

Phase 2 scaffold is in place: `apps/web`, `apps/api`, `packages/shared`, and `packages/typescript-config`. Product features are not started. Do not start Phase 3 unless the user explicitly asks. `apps/web/AGENTS.md` is a Next.js local note. This root file remains the product and repository authority.

## Project in one page

SolversBounty is a 40-hour Solana Devnet hackathon MVP.

- Creators publish cognitive challenges with protected predefined answers and fund a fixed SOL pool, plus the separate 5% commission in [ADR-007](docs/decisions/ADR-007-company-platform-commission.md).
- Solvers do not pay participation fees. They authenticate with a wallet, consent to research recording, and submit answers.
- The backend verifies answers. The browser does not.
- Every eligible correct solver receives the same configured reward, once, while funds and the max rewarded solvers cap allow it.
- Creators see aggregated research analytics for their own bounties: participant count, correctness, attempt count, and completion time ([ADR-009](docs/decisions/ADR-009-minimal-research-analytics.md)). The MVP does not collect strategy surveys or written explanations. Measurement does not claim to read private thoughts.
- There is no email, password, or KYC.
- Wallet addresses are pseudonymous. Solana transfers are public.
- The treasury is a custodial Devnet wallet controlled by the backend. Never describe it as trustless escrow.
- There is no custom Solana program in the MVP.

Confirmed decisions are IDs `CD-*`. Proposed decisions are IDs `PD-*` and stay labeled **proposed — pending confirmation** until an ADR or the implementation plan says they are accepted. The register is [docs/development/IMPLEMENTATION_PLAN.md](docs/development/IMPLEMENTATION_PLAN.md).

## Read before changing behavior

1. This file.
2. The requirement IDs you will touch in [REQUIREMENTS.md](docs/product/REQUIREMENTS.md).
3. The matching section of the [PRD](docs/product/PRD.md), [backend architecture](docs/architecture/BACKEND_ARCHITECTURE.md), [database design](docs/architecture/DATABASE_DESIGN.md), and [blockchain design](docs/architecture/BLOCKCHAIN_DESIGN.md).
4. [ADR-001](docs/decisions/ADR-001-modular-monolith.md) and [ADR-002](docs/decisions/ADR-002-custodial-devnet-treasury.md) when the change touches process shape or money.

## Architecture boundaries

Processes:

- `apps/web` renders UI, talks to Phantom, signs authentication messages, and calls the API. It may display server results. It must not decide correctness, eligibility, timestamps, balances, or payouts.
- `apps/api` is the NestJS modular monolith. It owns authorization, validation, the ledger, verification, and payout orchestration.
- `packages/shared` is for shared contracts and types. It must not import NestJS or React.
- PostgreSQL is the source of product state. Chain transactions are evidence used to advance that state.
- The treasury signing key exists only in API secret storage ([ADR-006](docs/decisions/ADR-006-devnet-treasury-private-key-storage.md)). It is never placed in the frontend, the database, logs, fixtures, or docs.

Module rules for the API:

- `verification` is a pure check. It does not write payouts or read HTTP requests.
- `rewards` and `solana` are the only modules that create or advance payout transfers.
- `auth` may call `solana` for local signature verification. Login must not depend on a healthy RPC.
- HTTP handlers record intent and return. An in-process worker confirms deposits and payouts (PD-16). Do not block ordinary reads on chain confirmation.
- Cross-module cycles are broken with a Nest event or a narrow interface, not with a new service.

Data rules:

- Public bounty payloads omit `expectedAnswer` and any field that can be reversed into it.
- Error bodies never include the expected answer, a treasury secret, or a raw signed transaction.
- Server clocks set `startedAt` and `submittedAt`. Ignore client clocks.
- Ignore client flags such as `isCorrect`, `eligible`, or `amountLamports` on write requests.
- Ledger math uses integer lamports (`bigint`). Do not use JavaScript `number` or binary floating point for SOL amounts.
- Eligibility rule E1 in the [README](README.md) is canonical. Copy it verbatim when restating it. Do not paraphrase it into a looser rule.

A schema change updates [DATABASE_DESIGN.md](docs/architecture/DATABASE_DESIGN.md) in the same change. A change to custody, the auth mechanism, privacy of research data, or money movement also needs an ADR. Leaving the modular monolith needs an ADR.

## Code quality

Follow [CODING_STANDARDS.md](docs/development/CODING_STANDARDS.md).

- TypeScript strict mode. No `any`. No suppressed errors without a stated reason.
- Prefer the simplest design that meets the requirement inside the 40-hour limit.
- Feature folders on the frontend. One Nest module per backend boundary listed in the backend architecture.
- Validate external input with Zod at the edge. Share the contract through `packages/shared` when PD-17 is in force.
- Structured logs. Log identifiers needed to debug a payout. Never log expected answers, submitted answers, authorization headers, cookies, session tokens, or secret keys.
- Comments explain a non-obvious invariant. Do not narrate the code.
- Do not add a dependency for a problem the standard library or an existing dependency already solves.

## Security requirements

- Verify wallet signatures on the backend. Nonces are single-use and expire.
- Authorize every creator-only and admin-only operation on the server.
- A solver cannot read another solver's submissions. A creator cannot read another creator's private bounty configuration or expected answer.
- Enforce attempt limits, rate limits, and the unique reward constraint on the server.
- Payout processing is idempotent. Retry the same payout row. Do not sign a second transfer while an earlier signature is unconfirmed or already confirmed.
- Total solver payouts for a bounty cannot exceed the confirmed funded principal.
- Network fees come from the treasury fee buffer (PD-07), not from bounty principal.
- Separate the treasury key from the answer-encryption key (PD-02, [ADR-006](docs/decisions/ADR-006-devnet-treasury-private-key-storage.md)).
- Rate-limit authentication and submissions (PD-20).
- Treat the MVP treasury as a compromised-hot-wallet risk even on Devnet. Keep balances small. Never point this design at mainnet without a new ADR.

## Testing requirements

Follow [TESTING_STRATEGY.md](docs/development/TESTING_STRATEGY.md).

- P0 payment, auth, verification, and answer-secrecy behavior needs automated API tests before it can be called done.
- Payment tests must cover double claim, pool exhaustion, insufficient funds, answer leakage, and a failed send that retries without a second transfer.
- Tests use a fake Solana gateway unless an explicitly marked Devnet test is requested.
- Do not use production-like secrets in fixtures. Devnet-only key material used in a local demo stays out of git.

## Documentation maintenance

- Keep terminology aligned with the README glossary.
- New product behavior gets a stable requirement ID before implementation. Do not invent IDs in code comments only.
- When implementation status changes, update the status column in [REQUIREMENTS.md](docs/product/REQUIREMENTS.md) and the milestone notes in [PROGRESS.md](docs/development/PROGRESS.md).
- Allowed requirement statuses: `not_started`, `in_progress`, `implemented`, `deferred`. `implemented` requires the acceptance criteria to pass. Evidence is a test name or a checked demo step recorded in progress.
- Do not delete or renumber requirement IDs, ADR numbers, `CD-*` IDs, or `PD-*` IDs. Supersede them in place.
- User-facing copy says custodial Devnet treasury, not trustless escrow and not "fully decentralized custody."
- Do not expand P1 or P2 work while the critical path is incomplete: auth, bounty, fund, marketplace, submit, verify, pay, analytics.

## Prohibited practices

- Do not invent completed features, screens, endpoints, or test results.
- Do not silently change product requirements. Propose a doc change and an ID update instead.
- Do not mark an unimplemented requirement `implemented`.
- Do not commit, print, or paste secrets, seed phrases, or private keys.
- Do not trust frontend-submitted correctness, timestamps, prices, or payout eligibility.
- Do not describe custodial funds as trustless, non-custodial, or smart-contract escrow.
- Do not add a custom Solana program, email/password login, KYC, or a microservice split in the MVP.
- Do not introduce a queue cluster, a second database, or a generic plugin system for the hackathon.
- Do not expose the expected answer through a public route, a GraphQL field, a log, an error, a client bundle, or a test snapshot of a public DTO.
- Do not start Phase 3, or a product feature, from a scaffold or documentation task.

## Definition of Done

A change is done when all of the following hold:

1. The requirement IDs it implements are named in the change summary.
2. Acceptance criteria for those IDs are satisfied and covered by tests when the ID is P0 auth, bounty secrecy, verification, ledger, or payout behavior.
3. Requirement status and [PROGRESS.md](docs/development/PROGRESS.md) match the evidence. Status stays `not_started` or `in_progress` when evidence is missing.
4. Public responses still hide expected answers. Ledger amounts are lamports. E1 is unchanged, or an ADR records a new eligibility rule and every copy of E1 is updated together.
5. Docs that describe the changed behavior are updated in the same change, including an ADR when the boundary section above requires one.
6. Logs and commits contain no secrets and no answer material.
7. The critical path still works, or the change summary says which P0 path is temporarily broken and why.

## Current phase

The Phase 5 security review is written. The Phase 4 backend foundation remains the code: Nest module boundaries, configuration, Prisma models for the proposed schema, health, and API conventions. No migration has been applied. Product requirements remain `not_started`. Do not start Phase 6 or a product workflow unless the user explicitly asks. PD-03 is superseded by [ADR-003](docs/decisions/ADR-003-postgresql-server-side-sessions.md). PD-05 is superseded by [ADR-004](docs/decisions/ADR-004-immediate-individual-solver-payouts.md). PD-13 is superseded by [ADR-005](docs/decisions/ADR-005-solana-confirmed-commitment.md). PD-15 is superseded by [ADR-006](docs/decisions/ADR-006-devnet-treasury-private-key-storage.md). CD-12 is superseded by [ADR-007](docs/decisions/ADR-007-company-platform-commission.md). PD-08 is superseded for deadline and full allocation by [ADR-008](docs/decisions/ADR-008-unused-reward-pool-retention.md). MVP analytics are [ADR-009](docs/decisions/ADR-009-minimal-research-analytics.md). PD-10 is not an MVP analytics requirement. PD-14 remains open. Cancelled, never-activated, failed-funding, and other exceptional endings remain unspecified.
