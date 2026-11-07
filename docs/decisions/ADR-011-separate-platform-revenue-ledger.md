# ADR-011 Simplified MVP platform revenue accounting

- Status: proposed
- Date: 2026-11-07

Proposed — pending review. This record is not binding. It does not approve tables, columns, enum values, ledger entry types, or transaction structures. It does not implement revenue collection. Requirement statuses stay `not_started`.

## Context

SolversBounty has two platform-revenue sources under accepted decisions:

1. The 5% creator commission in [ADR-007](ADR-007-company-platform-commission.md).
2. Unallocated solver reward-pool principal retained after deadline or the participant cap in [ADR-008](ADR-008-unused-reward-pool-retention.md).

The hackathon MVP needs a simple record of those amounts. It does not need an advanced financial reporting system.

The solver reward-pool identity stays:

```text
funded = reserved + paid + refundable + refunded
```

Platform revenue must not be classified as a solver payout or as a creator refund.

## Decision

Keep the reward-pool identity. Record platform revenue separately from that identity. Recognize only two revenue sources in the MVP.

### Solver reward-pool ledger

| Term | Meaning |
| --- | --- |
| `funded` | Confirmed creator-funded solver reward principal |
| `reserved` | Solver rewards allocated but not yet confirmed as paid |
| `paid` | Confirmed solver payouts only |
| `refundable` | Unallocated reward principal that has not yet been paid, refunded, or retained |
| `refunded` | Confirmed creator refunds, where an accepted policy permits them |

`refundable` is an accounting balance. It does not by itself entitle the creator to a refund. Refund entitlement stays with the accepted product decisions. [ADR-008](ADR-008-unused-reward-pool-retention.md) does not entitle the creator to the remainder after deadline or the participant cap.

The word "retained" in the `refundable` definition is that economic outcome. It is not a subtraction from the balance. While the closeout posting below stays unresolved, principal that ADR-008 retains still sits in `refundable`.

`paid` and `refunded` are not redefined.

### Platform revenue record

**Commission revenue.** 5% of the original solver reward pool, paid separately by the creator under ADR-007, and recorded apart from solver reward principal. The rate applies to the pool, not to the creator's total payment.

**Retained reward revenue.** Unallocated reward principal retained under ADR-008. This source applies only when a bounty reaches its deadline or its maximum rewarded participant limit. It is not a solver payout and not a creator refund.

No other revenue source is part of this proposal.

## Normal closure

Intended lifecycle of unallocated reward principal:

```text
Unallocated reward principal → solver payout, or creator refund where an accepted policy permits it, or platform revenue after normal closure
```

For normal closure:

1. The bounty reaches its deadline or its maximum rewarded participant limit.
2. Outstanding reserved solver payouts are reconciled under [ADR-004](ADR-004-immediate-individual-solver-payouts.md). Confirmation still follows [ADR-005](ADR-005-solana-confirmed-commitment.md).
3. Remaining unallocated reward principal is retained by SolversBounty under ADR-008.
4. That retained amount is recorded separately as platform revenue, linked to the bounty and the closure event.
5. The same retained amount is not counted twice.

### How the example balances

| Component | Amount |
| --- | ---: |
| Original solver reward pool | 1.00 SOL |
| Creator commission (5%) | 0.05 SOL |
| Total creator payment | 1.05 SOL |
| Confirmed solver payouts | 0.60 SOL |
| Retained unused reward principal | 0.40 SOL |
| Total platform revenue | 0.45 SOL |

Lamports: pool 1_000_000_000, commission 50_000_000, total payment 1_050_000_000, confirmed solver payouts 600_000_000, retained principal 400_000_000. Platform revenue is 50_000_000 + 400_000_000 = 450_000_000.

With `reserved = 0` and `refunded = 0` after those payouts confirm, the reward-pool identity is:

```text
funded 1.00 = paid 0.60 + refundable 0.40
```

The 0.05 SOL commission is outside `funded`. Total platform revenue is that commission plus the 0.40 SOL remainder. The 0.40 SOL is one amount. Adding platform revenue on top of `refundable` counts it twice.

### What is not yet resolved

Accepted decisions do not provide a posting that removes the retained 0.40 SOL from `refundable` and still keeps the identity true.

- The identity has these terms only: `funded`, `reserved`, `paid`, `refundable`, and `refunded`.
- ADR-008 forbids posting the remainder as `paid` or as `refunded`.
- Subtracting 0.40 SOL from `refundable` while leaving `funded` at 1.00 SOL and `paid` at 0.60 SOL makes the identity false: 1.00 ≠ 0.60.
- Reducing `funded` by the same amount would stop `funded` from meaning cumulative confirmed reward-pool principal. No accepted decision allows that.
- This proposal does not add a fifth identity term.

Until a later design supplies a matching movement, the retained-revenue record can only recognize the `refundable` remainder that the identity already holds. That recognition is not a second pile of lamports. The posting that would reclassify those lamports without breaking the identity or double-counting them is unresolved. This ADR does not invent that posting, a table, or an entry type.

## Accounting requirements

- Amounts are integer lamports, using a `BigInt`-compatible representation.
- Platform revenue stays outside solver reward-pool principal.
- Commission revenue and retained reward revenue stay distinct.
- A revenue record names its source, its bounty, and the funding or closure event it comes from.
- Posting is idempotent so the same event is not recognized twice.
- Confirmed payout meaning stays with ADR-004 and ADR-005.
- Eligibility rule E1 is unchanged. The canonical text is in the [README](../../README.md).
- The MVP does not add an advanced reporting or accounting system.

## Out of scope

This proposal does not decide:

- Cancelled bounties.
- Bounties that never become active.
- Failed or incomplete funding.
- Creator-initiated closure.
- Administrator-initiated closure.
- Commission treatment in those exceptional endings.

Those cases remain open.

## Database boundary

No revenue table name, Prisma model, ledger entry enum value, column, relationship, or transaction structure is approved. Those choices wait for the database design review. This proposal does not change `apps/api/prisma/schema.prisma`.

## Related decisions

- ADR-002: Custodial Devnet treasury.
- ADR-004: Immediate individual solver payouts.
- ADR-005: Solana `confirmed` commitment.
- ADR-007: Company platform commission. Accepted. This proposal does not change the 5% rate.
- ADR-008: Unused reward pool retention. Accepted for deadline and the participant cap. This proposal does not change that policy.

## Consequences

- Commission and retained principal can be reported without calling either one a solver payout.
- `refundable` remains a balance name, not a promise to pay the creator.
- Closeout still needs a later design before the lamports can leave `refundable` without breaking the identity.
- Exceptional endings stay unspecified.

## Alternatives

| Alternative | Why it was not selected |
| --- | --- |
| Post retained principal as `paid` or `refunded` | Those terms already have accepted meanings. ADR-008 forbids both |
| Subtract the remainder from `refundable` and leave the identity short | The equation would no longer hold |
| Specify tables and entry types in this proposal | The identity-preserving posting is still unresolved |
