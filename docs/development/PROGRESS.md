# Progress

| | |
| --- | --- |
| Phase | Security and architecture review |
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
- A Zod validation pipe exists and is tested. It is not registered globally. The live routes have no request bodies.
- Exception filter, request id, security headers, request logs without bodies, and bigint string serialization are in place.
- API infrastructure tests passed: 8 suites, 27 tests. They do not open a database connection.

Security review, written on 2026-11-07. No product workflow was added. Requirement statuses stay `not_started`.

- [Threat model](../security/THREAT_MODEL.md), [security review](../security/SECURITY_REVIEW.md), and [security checklist](../security/SECURITY_CHECKLIST.md).
- No verified live exploit. The running surface is health, readiness, and OpenAPI.
- Open `PD-*` items were not accepted. The ledger identity was not changed.

## In progress

Wallet login on the API is proven against the Neon development database and, earlier, a disposable PostgreSQL database. The web client connects Phantom through Solana Wallet Adapter and signs the exact nonce message. AUTH-002, AUTH-004, AUTH-005, AUTH-008, and AUTH-009 are `implemented`. AUTH-001, AUTH-003, AUTH-006, AUTH-007, AUTH-010, and AUTH-011 stay `in_progress` because a real Phantom browser session has not been verified. The 8-hour lifetime and logout CSRF check are working defaults, not accepted ADR decisions. The initial migration is applied to the development database `neondb`. Do not apply it to a production database.

Authenticated creators can save and edit bounty drafts. BOUNTY-001, BOUNTY-002, BOUNTY-003, BOUNTY-005, BOUNTY-012, BOUNTY-013, and BOUNTY-014 are `implemented`. BOUNTY-004, BOUNTY-006, BOUNTY-007, BOUNTY-008, BOUNTY-009, BOUNTY-010, BOUNTY-011, BOUNTY-016, and PRIV-009 are `in_progress`. BOUNTY-015 stays `not_started`. [ADR-012](../decisions/ADR-012-two-devnet-funding-transfers.md) funds the reward pool and the 5% commission as two Devnet transfers. Mocked RPC tests pass. A live Devnet transfer was not sent. Solvers can consent, start one session, and submit answers. The API verifies the answer and, when E1 passes, reserves one pending payout. A 15-second in-process worker can sign one Devnet transfer for that row and settle `reserved` to `paid` after `confirmed`. Mocked RPC tests cover reconciliation. A live payout was not broadcast. Creator analytics return the four ADR-009 aggregates without solver wallets. No new migration was added.

## Not started

- Funding, marketplace data from the API, verification, payouts, analytics calculations
- Devnet treasury, airdrops, and demo transactions
- Browser wallet connection is coded and covered with mocked client tests. A real Phantom session is not verified. The manual procedure is [MANUAL_PHANTOM_AUTH.md](MANUAL_PHANTOM_AUTH.md).

## Blockers

Local PostgreSQL on `127.0.0.1:5432` refused connections on 2026-11-07. The initial migration was later applied to the Neon development database `neondb`. Do not point another migration at a shared or production database.

PD-03 is superseded by [ADR-003](../decisions/ADR-003-postgresql-server-side-sessions.md). PD-05 is superseded by [ADR-004](../decisions/ADR-004-immediate-individual-solver-payouts.md). PD-13 is superseded by [ADR-005](../decisions/ADR-005-solana-confirmed-commitment.md). PD-15 is superseded by [ADR-006](../decisions/ADR-006-devnet-treasury-private-key-storage.md). PD-08 is superseded for deadline and full allocation by [ADR-008](../decisions/ADR-008-unused-reward-pool-retention.md). MVP analytics follow [ADR-009](../decisions/ADR-009-minimal-research-analytics.md). Who may read them follows [ADR-010](../decisions/ADR-010-role-based-analytics-visibility.md). PD-10 is not an MVP requirement. PD-14 is answered for analytics visibility and is not implemented. Authentication must follow ADR-003. Payout timing must follow ADR-004. Confirmation must follow ADR-005. Treasury key storage must follow ADR-006. The platform commission must follow ADR-007. Unused reward principal after deadline or the participant cap must follow ADR-008, including the rule that those lamports stay in `refundable`. [ADR-011](../decisions/ADR-011-separate-platform-revenue-ledger.md) is accepted and does not approve a revenue schema. Funding, submissions, verification, payouts, and analytics are not started. Cancelled, never-activated, failed-funding, and other exceptional endings remain unspecified. A draft cannot be activated until both the reward pool and the separate 5% commission are verified.

## Next actions

1. Approve the Phantom login message in the browser before marking AUTH-001, AUTH-003, AUTH-006, or AUTH-007 implemented. The login message is plain text, and the click calls Phantom's injected `signMessage` with a utf8 display so Phantom does not parse it as Sign In With Solana. A live approval has not been completed.
2. Free port 3001 for this API, then retry Phantom sign-in. The development database has the initial schema.
3. Unlock Phantom and approve the login signature in Chrome, then save a draft from `/bounties/create`. The local answer key is already configured.
4. Set `TREASURY_PUBLIC_KEY` to the custodial Devnet address, fund a draft from `/bounties/:id/fund` with two Phantom transfers, and activate only after both confirm. Do not mark BOUNTY-007, BOUNTY-016, PAY-008, or PAY-018 `implemented` until that live transfer is recorded.

## Verification

Scaffold checks on 2026-11-07:

- `pnpm install` completed at the root.
- `pnpm --filter @solversbounty/web dev` responded on port 3000. The home page showed `SolversBounty API: ok`.
- `pnpm --filter @solversbounty/api dev` responded. `GET /health` returned the shared health payload. Swagger at `/docs` returned 200.
- `pnpm build` compiled shared, the API, and the web app.
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` passed. Shared and web tests import `@solversbounty/shared`. The API health test imports it too.
- Env examples exist at the root, `apps/api`, and `apps/web`. Secret fields are empty. A search found no private keys.

Phase 6 wallet-login checks on 2026-11-07:

- `node --experimental-vm-modules ./node_modules/jest/bin/jest.js` in `apps/api`: 12 suites, 37 tests, all passed.
- Auth tests sign with a real Ed25519 key and a fake Prisma client. They do not open a database connection.
- The migration file was not applied. Neon was not contacted.

Disposable PostgreSQL authentication check on 2026-11-07:

- A new container `solversbounty-auth-pg` on `127.0.0.1:55432` received `prisma migrate deploy` for `20261107173154_initial_schema`. The datasource host was `127.0.0.1`. Neon was not contacted.
- Schema checks: 14 product tables plus `_prisma_migrations`, 13 enums, 21 foreign keys, the partial nonce index, BIGINT lamport columns, and both positive-amount checks. A second funding row with the same purpose was rejected. Two null chain ids were accepted. A zero ledger amount was rejected.
- `auth.postgres.spec.ts` passed against that database: nonce retirement, valid signature, repeat login, invalid signature, expired nonce, replay, session rotation, cookie lookup, logout, and a closed port returning 503.
- Full API Jest run with that database: 13 suites, 39 tests, all passed.
- AUTH-002, AUTH-004, AUTH-005, AUTH-008, and AUTH-009 are `implemented`. AUTH-006 and AUTH-007 stay `in_progress` because the browser session, the 8-hour lifetime, and creator routes are still open. CSRF for logout is now a working default, not an accepted ADR decision.
- The disposable container and its volume were removed afterward. No other container was changed.

Browser wallet authentication on 2026-11-07:

- The web app uses `@solana/web3.js` 1.99.0 and `@solana/wallet-adapter-phantom`. The API keeps `@solana/web3.js` 3.2.0. `@solana/wallet-adapter-wallets` was not kept because it pulled hardware and mobile wallets and failed the install.
- Web tests: 4 files, 16 tests, all passed. The auth client tests mock fetch and `signMessage`.
- API tests: 13 suites, 38 passed, 1 skipped. The skipped test is the disposable PostgreSQL spec. Logout without the CSRF header returns 403.
- A real Phantom signature in the browser was not exercised. Follow [MANUAL_PHANTOM_AUTH.md](MANUAL_PHANTOM_AUTH.md). AUTH-001, AUTH-003, AUTH-006, AUTH-007, AUTH-010, and AUTH-011 stay `in_progress`.

Bounty drafts on 2026-11-07:

- `bounties.http.spec.ts` passed: unauthenticated create is 401, a missing CSRF token is 403, invalid title, past deadline, and zero reward are 400 and the error body does not contain the answer, a created bounty stays `draft`, 0.01 SOL for 100 solvers stores 10_000_000 reward lamports and 1_000_000_000 principal lamports with a separate 50_000_000 commission, the public active list stays empty, another creator receives 404 and an empty own-list, the owner can read and update the draft, and activation returns 409.
- API `tsc --noEmit` passed.
- Web tests `bounty-api.test.ts` and `create-bounty-schema.test.ts`: 7 passed. The client omits difficulty, consent, and creator identity.
- Browser check on `http://localhost:3000`: an empty create form shows "Enter a title." The signed-out dashboard says "Sign in to see your drafts." The edit route says "Sign in to edit this draft." A saved draft was not created in the browser because port 3001 was already in use and `ANSWER_ENCRYPTION_KEY` is empty.
- The Prisma bounty repository was not run against Neon in that pass. No new migration was created.

Neon bounty validation on 2026-11-07:

- Port 3001 is this API. No other project was stopped, and the frontend still calls `http://localhost:3001`.
- `ANSWER_ENCRYPTION_KEY` is a local 32-byte base64url value in `apps/api/.env`. It is gitignored and was not printed. `answer-cipher.spec.ts` rejects a missing or invalid key with `NOT_READY`.
- The connected database is `neondb`. The runtime URL is pooled, the direct URL is not, both name the same database, and `reward_lamports` is `bigint`. The bounty, question, and audit columns are present. No migration was applied.
- `bounties.postgres.spec.ts` passed against Neon. It created draft `9405639f-59d3-406f-aaa1-70dc95f16845`, stored ciphertext, decrypted it for the owner, wrote both audit actions, hid the draft from the active list, rejected another creator, updated the title and description, and refused activation. The row was left in place.
- Phantom on Devnet connected in Chrome, but the login signature was not approved. The page reported that the wallet could not sign the login message. No browser draft was saved and no SOL was transferred.

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
