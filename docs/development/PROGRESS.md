# Progress

| | |
| --- | --- |
| Phase | Backend and Prisma foundation |
| Milestone | M1 complete. API infrastructure is in place. Product milestones are not started. |
| Application | Static web preview. API serves health, readiness, and OpenAPI only. |
| Updated | 2026-11-07 |

No requirement is `implemented`. The catalogue in [REQUIREMENTS.md](../product/REQUIREMENTS.md) stays `not_started` until acceptance criteria pass. This file must not be updated to claim a demo, a test run of a product flow, or a deployed API unless that work actually happened.

## Completed

Documentation files written in Phase 1:

- [README.md](../../README.md)
- [AGENTS.md](../../AGENTS.md)
- [docs/product/PRD.md](../product/PRD.md)
- [docs/product/REQUIREMENTS.md](../product/REQUIREMENTS.md)
- [docs/product/USER_STORIES.md](../product/USER_STORIES.md)
- [docs/architecture/SYSTEM_ARCHITECTURE.md](../architecture/SYSTEM_ARCHITECTURE.md)
- [docs/architecture/BACKEND_ARCHITECTURE.md](../architecture/BACKEND_ARCHITECTURE.md)
- [docs/architecture/DATABASE_DESIGN.md](../architecture/DATABASE_DESIGN.md)
- [docs/architecture/BLOCKCHAIN_DESIGN.md](../architecture/BLOCKCHAIN_DESIGN.md)
- [docs/development/IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)
- [docs/development/PROGRESS.md](PROGRESS.md)
- [docs/development/CODING_STANDARDS.md](CODING_STANDARDS.md)
- [docs/development/TESTING_STRATEGY.md](TESTING_STRATEGY.md)
- [docs/decisions/README.md](../decisions/README.md)
- [docs/decisions/ADR-001-modular-monolith.md](../decisions/ADR-001-modular-monolith.md)
- [docs/decisions/ADR-002-custodial-devnet-treasury.md](../decisions/ADR-002-custodial-devnet-treasury.md)

Decisions recorded: CD-01 through CD-15 are confirmed. PD-01 through PD-21 are proposed. ADR-001 and ADR-002 are accepted.

M1 scaffold, checked on 2026-11-07:

- pnpm workspace and Turborepo at the repository root.
- `apps/web` Next.js shell with Tailwind, a shadcn button, TanStack Query, and Vitest.
- `apps/api` NestJS shell with Swagger, `GET /health`, and Prisma 7 configured without models.
- `packages/shared` and `packages/typescript-config`.
- Root `pnpm install`, `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test`, and `pnpm typecheck` succeed.
- `GET http://localhost:3001/health` returns `{ "status": "ok", "service": "SolversBounty" }`.
- The web home page reads that health response.

Frontend preview, checked on 2026-11-07. Requirement statuses stay `not_started` because these pages use sample data and do not meet API acceptance criteria.

- Shared public bounty schema rejects an `expectedAnswer` field. Lamport helpers cover the 0.01 SOL by 100 solvers example.
- Web routes: `/`, `/bounties`, `/bounties/create`, `/bounties/[id]`, `/dashboard`, `/research`.
- Marketplace search, category filter, sort, empty state, and unknown-id error state were exercised in the browser.
- The create form validates in the browser and shows a receipt that omits the expected answer. It does not save or fund a bounty.
- Research analytics are labeled demonstration data, including an empty-session sample.
- `pnpm --filter @solversbounty/web lint`, `test`, and `build` passed.

Backend foundation, checked on 2026-11-07. Requirement statuses stay `not_started`. These pieces do not authenticate, create bounties, verify answers, or move SOL.

- Nest modules: `auth`, `users`, `bounties`, `submissions`, `verification`, `rewards`, `analytics`, `solana`, `anti-abuse`, `audit`. Boundaries only.
- Config validates app, database, Solana, and optional secret settings. Health starts without an auth secret, a treasury key, or `DATABASE_URL`.
- Prisma models match the proposed database design. `StrategyResponse` is omitted. The partial nonce index is written and not applied.
- `GET /health` still returns the shared liveness payload. `GET /health/ready` reports `not_configured`, `up`, or `down`.
- Global validation, exception filter, request id, security headers, redacted request logs, and bigint string serialization are in place.
- API infrastructure tests passed: 8 suites, 27 tests. They do not open a database connection.

## In progress

Nothing. Phase 4 infrastructure is ready for review. Phase 5 is not in progress.

## Not started

- Wallet login, bounty APIs, marketplace data, verification, payouts, analytics calculations
- Prisma migration and a connected development database
- Devnet treasury, airdrops, and demo transactions
- Product requirement implementation. Every requirement status stays `not_started`.

## Blockers

Local PostgreSQL on `127.0.0.1:5432` refused connections on 2026-11-07. The initial migration is deferred until a development database is configured. Do not point that migration at a shared or production database.

Phase 5 should not treat PD-03, PD-05, PD-08, PD-13, PD-10, PD-14, or PD-15 as accepted until the open questions in the [implementation plan](IMPLEMENTATION_PLAN.md) are answered. PD-10 can wait until P1. The other six affect authentication or the money path.

## Next actions

1. Review the Phase 4 foundation before any product workflow.
2. User confirms or replaces the open questions before authentication, funding, or payout work treats those proposals as accepted.
3. Apply the initial migration, including `prisma/manual/partial-indexes.sql`, only against a local development database.
4. Do not mark product requirements implemented because module folders or Prisma models exist.

## Verification

Scaffold checks on 2026-11-07:

- `pnpm install` completed at the root.
- `pnpm --filter @solversbounty/web dev` responded on port 3000. The home page showed `SolversBounty API: ok`.
- `pnpm --filter @solversbounty/api dev` responded. `GET /health` returned the shared health payload. Swagger at `/docs` returned 200.
- `pnpm build` compiled shared, the API, and the web app.
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` passed. Shared and web tests import `@solversbounty/shared`. The API health test imports it too.
- Env examples exist at the root, `apps/api`, and `apps/web`. Secret fields are empty. A search found no private keys.

Phase 4 checks on 2026-11-07:

- `pnpm install` completed.
- `pnpm --filter @solversbounty/api lint`, `test`, and `build` passed. API tests: 8 suites, 27 tests.
- `pnpm typecheck`, `pnpm build`, `pnpm lint`, and `pnpm test` passed. Shared tests: 3 passed. Web tests: 6 passed.
- The watched API on port 3001 started. `GET /health` returned `{ "status": "ok", "service": "SolversBounty" }`. `GET /health/ready` returned `{ "status": "ready", "checks": { "database": "not_configured" } }` because that process has no `DATABASE_URL`.
- `GET /docs` returned 200. OpenAPI lists `/health` and `/health/ready` only.
- A separate process on port 3002 with `DATABASE_URL` set to local PostgreSQL stayed up. `GET /health` stayed 200. `GET /health/ready` returned 503 `{ "status": "not_ready", "checks": { "database": "down" } }`. The log said the server at `127.0.0.1:5432` could not be reached and did not print the connection string.
- `prisma generate` wrote the client. No migration was created. PostgreSQL on `127.0.0.1:5432` refused connections.
- The web home page still showed `SolversBounty API: ok`.
- A search of source, docs, and env examples found no private keys.

Documentation review for M0, checked on 2026-11-07:

- The 16 planned Markdown files exist.
- 119 relative documentation links were checked. None are broken.
- 124 requirement IDs are present, with no duplicate IDs. Every status is `not_started`.
- Eligibility rule E1 is identical in the README, system architecture, and blockchain design.
- The treasury is described as custodial in the README, PRD, blockchain design, and ADR-002.

If a later edit breaks a link, fix it in the same change and note it here.
