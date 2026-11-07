# Architecture decision records

ADRs record decisions that later work must not undo quietly. Product requirements stay in [REQUIREMENTS.md](../product/REQUIREMENTS.md). Proposed defaults stay in the [implementation plan](../development/IMPLEMENTATION_PLAN.md) until they are accepted.

## Filename

`ADR-NNN-kebab-title.md`

- `NNN` is a three-digit sequence: `001`, `002`, `003`.
- Numbers are never reused, even if an ADR is superseded or rejected.
- The next ADR uses the next integer. Do not insert a number to keep themes together.
- The slug is short, lowercase, and stable. Do not rename a file after other docs link to it.

## When to write one

Write an ADR before implementing a change that:

- Splits or merges the modular monolith.
- Changes custody, the treasury model, or the payout asset.
- Changes the authentication mechanism.
- Changes who can see wallet-linked research data, or how answers are protected.
- Changes eligibility rule E1 or the ledger identity.
- Adopts a new datastore, a new chain, or a custom Solana program.

Do not write an ADR for a bug fix that follows an existing decision, a copy change, or a visual tweak.

A `PD-*` item that the user accepts without changing its meaning can be marked accepted in the implementation plan. Write an ADR if acceptance changes the consequences or if the decision is one of the bullets above. PD-03 is superseded by ADR-003. PD-05 is superseded by ADR-004. PD-13 is superseded by ADR-005. PD-15 is superseded by ADR-006. PD-08 is superseded by ADR-008 for deadline and full-allocation closure. PD-14 is superseded for analytics visibility by ADR-010.

## Required sections

```markdown
# ADR-NNN Title

- Status: proposed | accepted | superseded by ADR-MMM | rejected
- Date: YYYY-MM-DD

## Context

## Decision

## Consequences

## Alternatives
```

Status meanings:

| Status | Meaning |
| --- | --- |
| `proposed` | Not binding |
| `accepted` | Binding until superseded |
| `superseded by ADR-MMM` | Kept for history. The new ADR is the one to follow |
| `rejected` | Considered and not adopted |

## Current records

| ADR | Status | Decision |
| --- | --- | --- |
| [ADR-001 Modular monolith](ADR-001-modular-monolith.md) | accepted | One NestJS process with module boundaries |
| [ADR-002 Custodial Devnet treasury](ADR-002-custodial-devnet-treasury.md) | accepted | Backend-managed custodial wallet. Not trustless escrow |
| [ADR-003 PostgreSQL server-side sessions](ADR-003-postgresql-server-side-sessions.md) | accepted | HttpOnly cookie session. Hash stored on `AuthSession`. Not JWT |
| [ADR-004 Immediate individual solver payouts](ADR-004-immediate-individual-solver-payouts.md) | accepted | Pay each eligible solver after reservation. No batch. E1 unchanged |
| [ADR-005 Solana confirmed commitment](ADR-005-solana-confirmed-commitment.md) | accepted | Funding and payouts complete at `confirmed`, plus detail checks. Not `processed` or `finalized` |
| [ADR-006 Devnet treasury private-key storage](ADR-006-devnet-treasury-private-key-storage.md) | accepted | `TREASURY_SECRET_KEY` stays in the API environment. Devnet only. Not a Mainnet custody strategy |
| [ADR-007 Company platform commission](ADR-007-company-platform-commission.md) | accepted | 5% of the solver reward pool, paid on top. Not deducted from solver rewards. Supersedes CD-12 |
| [ADR-008 Unused reward pool retention](ADR-008-unused-reward-pool-retention.md) | accepted | After deadline or the participant cap, unallocated principal is platform revenue. Not a creator refund. E1 unchanged |
| [ADR-009 Minimal research analytics](ADR-009-minimal-research-analytics.md) | accepted | MVP records correctness, attempt count, completion time, and participant count. Strategies, explanations, answer changes, and export are later |
| [ADR-010 Role-based analytics visibility](ADR-010-role-based-analytics-visibility.md) | accepted | Creators see aggregates for their own bounties. Administrators see platform aggregates. Neither sees individual solver research records or wallets in analytics |
| [ADR-011 Simplified MVP platform revenue accounting](ADR-011-separate-platform-revenue-ledger.md) | proposed | Commission and ADR-008 retained principal are recorded apart from the reward pool. Identity unchanged. Removing the retained amount from `refundable` is unresolved. No schema approved |

## How to supersede

1. Add the new ADR with the next number and status `accepted`.
2. Change the old ADR status to `superseded by ADR-NNN` and link the new file.
3. Update the PRD, the affected design doc, and this index in the same change.
4. Do not delete the old file.
