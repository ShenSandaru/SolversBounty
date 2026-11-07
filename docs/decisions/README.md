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

A `PD-*` item that the user accepts without changing its meaning can be marked accepted in the implementation plan. Write an ADR if acceptance changes the consequences or if the decision is one of the bullets above. PD-03 is superseded by ADR-003. PD-05, PD-13, PD-14, and PD-15 are the proposals most likely to need that update.

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

## How to supersede

1. Add the new ADR with the next number and status `accepted`.
2. Change the old ADR status to `superseded by ADR-NNN` and link the new file.
3. Update the PRD, the affected design doc, and this index in the same change.
4. Do not delete the old file.
