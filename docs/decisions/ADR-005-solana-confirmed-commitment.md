# ADR-005 Solana confirmed commitment

- Status: accepted
- Date: 2026-11-07

## Context

SolversBounty uses Solana Devnet for bounty funding and solver reward payouts.

The application needs a consistent transaction confirmation policy to determine when blockchain operations can be treated as confirmed by the backend.

Solana provides three commonly used commitment levels:

- `processed`
- `confirmed`
- `finalized`

The project needs to balance transaction confirmation confidence with a responsive solver and creator experience.

## Decision

SolversBounty will use Solana's `confirmed` commitment level for relevant transaction confirmation operations.

A transaction must reach `confirmed` and pass the required execution and transaction-detail checks before the application treats the corresponding funding or payout operation as confirmed.

The application will not require `finalized` commitment for MVP funding and payout completion.

### Application to bounty funding

A creator's bounty funding must not be treated as confirmed until:

1. The transaction is found on the expected Solana network.
2. The transaction reaches `confirmed`.
3. The transaction execution is successful.
4. The sender, recipient, amount, and bounty payment reference match the expected funding details.

The bounty must not become active before funding verification succeeds.

### Application to solver payouts

A solver payout must not be marked as paid until:

1. The transaction is found and reaches `confirmed`.
2. The transaction execution is successful.
3. The sender is the expected treasury wallet.
4. The recipient is the eligible solver wallet.
5. The transferred amount matches the reserved reward.
6. The transaction is associated with the intended payout.

The database reward allocation remains reserved until the payout is successfully confirmed and reconciled.

### Transaction failure and uncertainty

The system must distinguish between:

- Confirmed successful transactions.
- Confirmed transactions with execution errors.
- Transactions still awaiting confirmation.
- Transactions whose outcome is uncertain.
- Transactions that are definitively failed or expired.

A timeout or lost RPC response must not automatically be treated as a failed transfer.

Before another transfer is signed for an existing payout, the worker must reconcile the previous transaction using its signature and payout memo/reference.

The implementation must preserve the idempotency and recovery requirements defined in ADR-004.

### Network consistency

The implementation must ensure that transaction queries and confirmation checks use the intended Solana network.

The MVP uses Solana Devnet as defined by ADR-002.

The configured commitment policy must be applied consistently across relevant transaction confirmation and status-checking operations.

## Consequences

### Positive

- Provides a consistent confirmation policy.
- Avoids treating merely processed transactions as completed payments.
- Offers a balance between confirmation confidence and response time.
- Aligns with immediate individual solver payouts.
- Provides a clear rule for bounty activation and payout completion.

### Trade-offs

- `confirmed` does not provide the same finality guarantee as `finalized`.
- Transaction confirmation may take longer than initial processing.
- RPC failures and uncertain outcomes require reconciliation.
- The application must not treat commitment level alone as proof that the correct transfer occurred.

## Scope

This decision establishes the Solana commitment policy only.

It does not implement blockchain connections, transaction submission, funding verification, payout workers, treasury signing, or database migrations.

The custodial Devnet treasury remains governed by ADR-002.

Immediate individual payouts remain governed by ADR-004.

No custom Solana program is introduced by this decision.

PD-13 is superseded. Eligibility rule E1 and the ledger identity are unchanged. `ChainTransaction.commitment` stays text until a later schema change. PD-08 remains the proposed refund policy.

## Alternatives

| Alternative | Why it was not selected |
| --- | --- |
| `processed` | A fork can still drop the transaction. The API would mark funding or a payout complete too early |
| `finalized` | Stronger finality, slower completion. The MVP does not require it for funding activation or payout completion |
