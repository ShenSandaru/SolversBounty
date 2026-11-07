# SolversBounty

**Solve Problems. Earn Rewards. Unlock Human Insights.**

SolversBounty is a wallet-authenticated cognitive micro-task marketplace and human reasoning research platform. Creators publish predefined challenges, fund a fixed SOL reward pool on Solana Devnet, and study how people attempt those challenges. Solvers connect a wallet, submit answers, and receive the same micro-reward when the backend judges them eligible.

**Document status:** Phase 1 documentation foundation. No application is implemented.

The hackathon MVP uses a **backend-managed custodial Devnet treasury**. Wallet login and SOL transfers are on Solana. Custody of reward funds is not trustless escrow. See [ADR-002](docs/decisions/ADR-002-custodial-devnet-treasury.md).

## Product objectives

SolversBounty has two equal purposes:

1. **Human intelligence marketplace.** Creators publish cognitive challenges and fund rewards. Eligible correct solvers receive a fixed micro-payment, one reward per wallet per bounty.
2. **Human reasoning research.** With explicit consent, the platform records observable solving activity and optional self-reports so creators can study correctness, attempts, completion time, answer changes, and strategies.

The product is privacy-conscious. It does not promise anonymity. A wallet address is a pseudonym, and Solana transactions are public. The MVP does not collect email addresses, passwords, or KYC data.

The demo story is one complete path: a researcher creates a challenge, funds it, solvers connect their wallets and submit answers, the backend verifies those answers, eligible solvers are paid on Devnet, and the researcher reads the resulting analytics.

## Tech stack

Confirmed choices:

| Area | Choice |
| --- | --- |
| Monorepo | pnpm workspaces and Turborepo |
| Frontend | Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui |
| Client state | Zustand |
| Server state | TanStack Query |
| Forms | React Hook Form and Zod |
| Backend | NestJS modular monolith, TypeScript |
| API contract | Swagger / OpenAPI |
| Database | PostgreSQL (local development, Neon for the shared hackathon database) and Prisma |
| Blockchain | Solana Devnet and `@solana/web3.js` |
| Authentication | Sign-In with Solana via wallet signature verification (Phantom) |
| Tests | Vitest for the web app, Jest for the API (intended; not installed) |

Details and the proposal register: [Implementation plan](docs/development/IMPLEMENTATION_PLAN.md).

## Repository overview

This repository currently contains documentation only.

```text
.
├── AGENTS.md
├── README.md
└── docs/
    ├── architecture/
    ├── decisions/
    ├── development/
    └── product/
```

Intended application layout for Phase 2. These directories do not exist yet:

```text
.
├── apps/
│   ├── web/          Next.js frontend
│   └── api/          NestJS API
├── packages/
│   └── shared/       Shared Zod contracts and types
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

## Development workflow

The commands below are the intended workflow **after Phase 2 scaffolds the monorepo**. They are not available today. There is no root `package.json`.

```bash
pnpm install
pnpm dev
pnpm --filter api test
pnpm --filter web test
pnpm lint
```

Until that scaffold exists, work in this repository is documentation. Read [AGENTS.md](AGENTS.md) before changing product behavior. Update [progress](docs/development/PROGRESS.md) when a milestone actually changes. Do not mark a requirement `implemented` until its acceptance criteria pass.

Local development is planned against PostgreSQL. The shared hackathon database is planned on Neon. Schema in the database design is proposed, not approved DDL.

## Documentation

| Document | Purpose |
| --- | --- |
| [AGENTS.md](AGENTS.md) | Repository-wide instructions for people and coding agents |
| [Product requirements](docs/product/PRD.md) | Product scope, journeys, priorities, and reconciliations |
| [Requirements catalogue](docs/product/REQUIREMENTS.md) | Stable IDs, acceptance criteria, and implementation status |
| [User stories](docs/product/USER_STORIES.md) | Creator, solver, and administrator stories |
| [System architecture](docs/architecture/SYSTEM_ARCHITECTURE.md) | Boundaries, trust, and data flow |
| [Backend architecture](docs/architecture/BACKEND_ARCHITECTURE.md) | NestJS modules, transactions, and errors |
| [Database design](docs/architecture/DATABASE_DESIGN.md) | Proposed entities, constraints, and sensitive data |
| [Blockchain design](docs/architecture/BLOCKCHAIN_DESIGN.md) | Deposits, treasury, payouts, refunds, and failures |
| [Implementation plan](docs/development/IMPLEMENTATION_PLAN.md) | 40-hour plan, proposals, open questions, conflicts |
| [Progress](docs/development/PROGRESS.md) | Current milestone and verification |
| [Coding standards](docs/development/CODING_STANDARDS.md) | TypeScript, structure, validation, logging |
| [Testing strategy](docs/development/TESTING_STRATEGY.md) | Unit, API, payment safety, and demo-path tests |
| [ADR index](docs/decisions/README.md) | When and how to record a decision |
| [ADR-001 Modular monolith](docs/decisions/ADR-001-modular-monolith.md) | Why the backend is one modular process |
| [ADR-002 Custodial treasury](docs/decisions/ADR-002-custodial-devnet-treasury.md) | Why MVP custody is a Devnet hot wallet |

## Glossary

Use these terms in copy, code, and docs.

| Term | Meaning |
| --- | --- |
| Bounty | The funded challenge record. In the MVP it has one question. |
| Challenge | Solver-facing name for a bounty. |
| Creator | Authenticated wallet that owns a bounty. |
| Solver | Authenticated wallet that attempts a bounty. |
| Administrator | Allowlisted wallet with the `admin` role. Proposed in PD-04. |
| Expected answer | Creator-defined answer. Hidden from public APIs. |
| Submitted answer | Text the solver sent for one attempt. |
| Solving session | One solver's server-timed attempt window on one bounty. |
| Submission attempt | One submitted answer inside a solving session. |
| Reward allocation | The single reserved reward for one solver on one bounty. |
| Payout | The on-chain transfer attempt for one allocation. |
| Treasury | Backend-managed custodial Devnet wallet that holds reward SOL. |
| Refundable balance | Deposited lamports not reserved, paid, or refunded. |
| Max rewarded solvers | Maximum number of wallets that may receive the reward. |
| Pseudonymous | Identified by wallet address, without a claim of real-world uniqueness or anonymity. |

Ledger identity used throughout the design:

```text
funded = reserved + paid + refundable + refunded
```

`funded` is cumulative deposits. `reserved` is held for an unconfirmed payout. `paid` is confirmed solver payouts. `refundable` can still be reserved or later refunded. `refunded` is confirmed creator refunds. See [Blockchain design](docs/architecture/BLOCKCHAIN_DESIGN.md).

## Eligibility rule E1

This paragraph is canonical. Related docs repeat it verbatim.

A reward allocation is created only inside one database transaction when the submission attempt is verified correct, the attempt belongs to the authenticated solver's solving session, a consent record exists, the attempt number is within the bounty attempt limit, the bounty is active, the server time is at or before the deadline, that solver has no allocation on that bounty, the number of allocations is below max rewarded solvers, and refundable lamports are at least the reward. The same transaction moves the reward from refundable to reserved and inserts one payout in `pending`. The chain transfer happens after the transaction commits. A correct attempt that fails only the capacity checks (allocation cap or refundable balance) is stored with an ineligibility reason and creates no payout. Requests that fail consent, ownership, attempt limit, bounty activity, or deadline are rejected and store no attempt.

## License

No license has been selected.
