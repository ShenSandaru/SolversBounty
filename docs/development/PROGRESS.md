# Progress

| | |
| --- | --- |
| Phase | 2, monorepo scaffold |
| Milestone | M1 complete |
| Application | Shells only. No product features. |
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

## In progress

Nothing. Phase 2 is finished. Phase 3 is not in progress.

## Not started

- Wallet login, bounties, marketplace, verification, payouts, analytics
- Prisma models and migrations
- Devnet treasury, airdrops, and demo transactions
- Product requirement implementation. Every requirement status stays `not_started`.

## Blockers

No blocker remains for the scaffold.

Phase 3 should not treat PD-03, PD-05, PD-08, PD-13, PD-10, PD-14, or PD-15 as accepted until the open questions in the [implementation plan](IMPLEMENTATION_PLAN.md) are answered. PD-10 can wait until P1. The other six affect authentication or the money path.

## Next actions

1. User confirms or replaces the open questions.
2. User explicitly asks for Phase 3.
3. Do not mark product requirements implemented during later scaffolds.

## Verification

Scaffold checks on 2026-11-07:

- `pnpm install` completed at the root.
- `pnpm --filter @solversbounty/web dev` responded on port 3000. The home page showed `SolversBounty API: ok`.
- `pnpm --filter @solversbounty/api dev` responded. `GET /health` returned the shared health payload. Swagger at `/docs` returned 200.
- `pnpm build` compiled shared, the API, and the web app.
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` passed. Shared and web tests import `@solversbounty/shared`. The API health test imports it too.
- Env examples exist at the root, `apps/api`, and `apps/web`. Secret fields are empty. A search found no private keys.

Documentation review for M0, checked on 2026-11-07:

- The 16 planned Markdown files exist.
- 119 relative documentation links were checked. None are broken.
- 124 requirement IDs are present, with no duplicate IDs. Every status is `not_started`.
- Eligibility rule E1 is identical in the README, system architecture, and blockchain design.
- The treasury is described as custodial in the README, PRD, blockchain design, and ADR-002.

If a later edit breaks a link, fix it in the same change and note it here.
