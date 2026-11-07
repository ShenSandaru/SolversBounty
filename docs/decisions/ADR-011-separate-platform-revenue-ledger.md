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
| `refundable` | Unallocated reward principal that has not been paid or refunded. After normal closure the lamports stay here |
| `refunded` | Confirmed creator refunds, where an accepted policy permits them |

`refundable` is an accounting classification inside the reward-pool identity. It does not by itself entitle the creator to a refund. Refund entitlement stays with the accepted product decisions. [ADR-008](ADR-008-unused-reward-pool-retention.md) does not entitle the creator to the remainder after deadline or the participant cap.

After that normal closure, the unallocated principal stays in `refundable`. This proposal does not deduct it.

Three different ideas stay separate:

| Idea | What it is |
| --- | --- |
| Reward-pool accounting balance | The identity terms. The 0.40 SOL remainder is `refundable` |
| Platform revenue recognition | A record that classifies that same 0.40 SOL as retained revenue, plus the separate 0.05 SOL commission |
| Custody balance | SOL held by the custodial treasury on Devnet. One on-chain balance. Not a second copy of the ledger |

`paid` and `refunded` are not redefined. No new reward-pool bucket is added.

### Platform revenue record

**Commission revenue.** 5% of the original solver reward pool, paid separately by the creator under ADR-007, and recorded apart from solver reward principal. The rate applies to the pool, not to the creator's total payment.

**Retained reward revenue.** A classification of the unallocated principal that remains in `refundable` after a bounty reaches its deadline or its maximum rewarded participant limit under ADR-008. The record refers to that existing reward-pool amount. It is not a solver payout, not a creator refund, and not an additional financial balance.

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
4. That retained amount is recognized in a separate revenue record linked to the bounty and the closure event. The record classifies the `refundable` remainder. It does not move those lamports.
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

The 0.05 SOL commission is outside `funded`. It is its own revenue amount because the creator paid it on top of the pool.

The 0.40 SOL is one amount. It is both the `refundable` term in the identity and the retained-revenue classification. A report of platform assets uses the custody balance, or the reward-pool terms, once. A report of platform revenue may list 0.05 SOL commission and 0.40 SOL retained principal. Adding that 0.40 SOL again to `refundable`, to `funded`, or to the treasury balance counts the same principal twice.

This proposal does not remove the 0.40 SOL from `refundable`. [ADR-008](ADR-008-unused-reward-pool-retention.md) now requires that treatment: the retained lamports stay in `refundable`, are not a second custody balance, and are not added again when reporting holdings. Removing them would make `funded 1.00 = paid 0.60 + refundable 0.00` false. ADR-008 also forbids parking the remainder in `paid` or `refunded`. No fifth identity term is added.

The revenue record proposed here is a reference to that existing balance, not a second asset. The shape of the record remains an implementation-planning item. This proposal still approves no table, column, enum value, or transaction structure.

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
- ADR-008: Unused reward pool retention. Accepted. Retained lamports stay in `refundable`. This proposal does not change that rule. It remains a proposed recognition record only.

## Consequences

- Commission and retained principal can be reported without calling either one a solver payout.
- `refundable` remains a balance name, not a promise to pay the creator.
- Retained principal stays inside `refundable`. The revenue record does not create a second asset.
- Exceptional endings stay unspecified.

## Alternatives

| Alternative | Why it was not selected |
| --- | --- |
| Post retained principal as `paid` or `refunded` | Those terms already have accepted meanings. ADR-008 forbids both |
| Subtract the remainder from `refundable` | The identity would be short, and this proposal keeps those lamports in `refundable` |
| Treat the revenue record as a second holding of the same 0.40 SOL | That double-counts principal already in the reward pool and in the treasury |
