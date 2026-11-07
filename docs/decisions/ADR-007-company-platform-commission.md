# ADR-007 Company platform commission

- Status: accepted
- Date: 2026-11-07

CD-12 is superseded. The 0% platform fee is not the MVP rule.

In the product glossary, the funding party is the creator.

## Context

SolversBounty originally planned to operate with a 0% platform fee.

The platform now requires a revenue model in which companies and creators pay a commission when funding cognitive challenges.

The commission must not reduce the rewards available to eligible solvers.

## Decision

SolversBounty will charge companies a 5% platform commission calculated on the solver reward pool.

The commission is collected separately from the solver reward pool.

Therefore:

- The company funds the full solver reward pool.
- The company pays an additional 5% commission.
- The full reward pool remains dedicated to eligible solver rewards.
- The commission is recorded as platform revenue, separately from solver reward accounting.

### Calculation

The commission is 5% of the original solver reward pool. It is not 5% of the creator's total payment.

Amounts are integer lamports. The obligation is:

```text
commissionLamports = floor(rewardPoolLamports * 5 / 100)
```

Use integer arithmetic, or an equivalent exact calculation. Do not use floating-point arithmetic. If the exact 5% is a fractional lamport, round down to the nearest whole lamport. Never round the commission up.

Total payment = reward pool + that integer commission.

Example where 5% is already a whole lamport:

| Component | Amount | Lamports |
| --- | ---: | ---: |
| Solver reward pool | 1.00 SOL | 1_000_000_000 |
| Platform commission (5%) | 0.05 SOL | 50_000_000 |
| Total company payment | 1.05 SOL | 1_050_000_000 |

`floor(1_000_000_000 * 5 / 100)` is 50_000_000.

Example where 5% is not a whole lamport:

`floor(1_000_000_001 * 5 / 100) = 50_000_000`

The fractional 0.05 lamport is dropped. The commission obligation is 50_000_000 lamports, not 50_000_001.

## Funding and activation requirements

Before a bounty becomes active and available to solvers:

1. The company must fund the full advertised solver reward pool.
2. The required 5% platform commission must also be paid.
3. The backend must verify both payment components.
4. Both payments must match the expected network, parties, amounts, and payment references.
5. The bounty must not become active until the required payment verification succeeds.

The exact on-chain transaction arrangement and platform commission receiving address will be determined during implementation planning.

Confirmation of each component still follows ADR-005.

## Accounting requirements

The platform commission must be accounted for separately from solver reward funds.

The existing reward-pool ledger identity remains unchanged:

```text
funded = reserved + paid + refundable + refunded
```

Commission revenue must not be included in the reward-pool `funded` amount.

The commission must not be deducted from solver allocations or payouts.

Network fees remain separate from this commission. PD-07 is still the proposed fee-buffer rule.

## Consequences

### Positive

- Establishes a revenue model for SolversBounty.
- Keeps the advertised solver reward pool intact.
- Makes company payment requirements transparent.
- Separates platform revenue from solver reward accounting.

### Trade-offs

- Companies must pay more than the advertised solver reward pool.
- The backend must verify and account for both payment components.
- Additional accounting and transaction verification logic will be required.

## Scope and limitations

This ADR establishes the commission rate and its relationship to the reward pool.

It does not implement:

- Commission payment processing.
- Commission wallet configuration.
- Solana RPC connections.
- Transaction construction or submission.
- Funding verification.
- Payout workers or treasury signing.
- Database schema changes or migrations.

The treatment of commission payments if a bounty is cancelled, expires, or otherwise becomes ineligible for activation remains to be specified. The broader unused reward-pool refund policy remains subject to PD-08.

Eligibility rule E1 is unchanged.

## Related decisions

- ADR-002: Custodial Devnet treasury.
- ADR-004: Immediate individual solver payouts.
- ADR-005: Solana `confirmed` commitment requirement.
- ADR-006: Devnet treasury private-key storage.

This ADR supersedes the original 0% platform-fee assumption.

## Alternatives

| Alternative | Why it was not selected |
| --- | --- |
| 0% platform fee (CD-12) | The platform now needs revenue when a challenge is funded |
| Deduct 5% from the solver reward pool | Eligible solvers would receive less than the advertised reward |
