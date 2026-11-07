# ADR-008 Unused reward pool retention

- Status: accepted
- Date: 2026-11-07

PD-08 is superseded for normal closure. This decision does not implement retention, refunds, or ledger postings.

## Context

Creators are the funding parties. They pay SolversBounty to publish and fund cognitive challenges. Solvers do not pay participation fees. Solvers earn rewards when they satisfy eligibility rule E1.

Creators pay the full solver reward pool plus the separate 5% platform commission established by ADR-007. The earlier product story returned unused reward-pool principal to the creator. That refund is not the policy for a bounty that closes because its deadline or its rewarded-participant limit has been reached.

## Decision

When a bounty reaches either its configured deadline or its maximum rewarded participant limit, any remaining unallocated solver reward-pool principal is retained by SolversBounty as platform revenue.

Creators do not receive refunds for this unused reward balance under this policy.

The policy applies only to normal bounty closure after the deadline or the participant limit.

### Business model

- Creators are the funding parties.
- Creators pay SolversBounty to publish and fund cognitive challenges.
- Solvers do not pay any participation fees.
- Solvers earn rewards when they satisfy eligibility rule E1.
- Creators pay the full solver reward pool plus the separate 5% platform commission established by ADR-007.

### Explicit exclusions

This decision does not cover:

- Cancelled bounties.
- Bounties that never become active.
- Failed or incomplete funding.
- Other exceptional termination scenarios, including a creator close or an admin close.

Those situations remain unspecified and require separate decisions.

### Commission separation

The 5% commission remains separate from the solver reward pool. It is calculated on the original reward pool, not on the total payment.

Example:

| Component | Amount | Lamports |
| --- | ---: | ---: |
| Solver reward pool | 1.00 SOL | 1_000_000_000 |
| Platform commission (5%) | 0.05 SOL | 50_000_000 |
| Total creator payment | 1.05 SOL | 1_050_000_000 |
| Rewards paid to eligible solvers | 0.60 SOL | 600_000_000 |
| Unused reward principal retained by SolversBounty | 0.40 SOL | 400_000_000 |

In-flight reserved payouts are allocated, not unused principal. Their confirmation and failure handling remain ADR-004.

## Accounting requirements

The reward-pool identity remains unchanged:

```text
funded = reserved + paid + refundable + refunded
```

`paid` is not redefined to include retained unused rewards. `paid` remains confirmed solver payouts.

Retained unused reward principal must be accounted for separately as platform revenue after normal bounty closure.

Commission revenue remains separate from reward-pool accounting and is not part of `funded`.

This decision does not add database fields, ledger entry types, or a posting procedure. The precise ledger representation of retained platform revenue is an implementation-planning item.

## Consequences

- A creator who funds a bounty that reaches its deadline or participant cap does not receive the unallocated remainder.
- Solvers still receive the advertised reward when E1 is met, until the cap or the pool is exhausted.
- Platform revenue from this policy is distinct from the ADR-007 commission and from solver `paid` amounts.
- Cancelled, never-activated, and failed-funding balances still have no accepted disposition.

## Scope

This ADR records the retention policy only. It does not implement retention, refunds, commission collection, Solana transactions, treasury signing, schema changes, or migrations.

Eligibility rule E1 is unchanged. The canonical text is in the [README](../../README.md).

## Related decisions

- ADR-002: Custodial Devnet treasury.
- ADR-004: Immediate individual solver payouts.
- ADR-007: Company platform commission.

## Alternatives

| Alternative | Why it was not selected |
| --- | --- |
| Refund unused principal to the creator after close (PD-08) | Normal closure now keeps that unallocated remainder as platform revenue |
| Add the unused remainder to `paid` | `paid` would no longer mean confirmed solver payouts, and the ledger identity would be doing two jobs |
