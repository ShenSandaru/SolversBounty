# ADR-004 Immediate individual solver payouts

- Status: accepted
- Date: 2026-11-07

## Context

SolversBounty rewards eligible participants who correctly solve cognitive challenges.

The platform uses a custodial Solana Devnet treasury. Each bounty defines a fixed reward per eligible solver and a maximum number of rewarded participants.

Two payout approaches were considered:

1. Immediate individual payouts.
2. Periodic batch payouts.

The project prioritizes providing eligible solvers with their rewards without waiting for a scheduled payout period.

## Decision

SolversBounty will use immediate individual payouts.

After successful answer verification and reward reservation, the system will initiate an individual SOL transfer from the platform treasury to the eligible solver's wallet.

Each eligible solver receives the predefined reward amount, subject to the bounty's funding and participant limits.

The payout process must be initiated promptly after reservation. Blockchain confirmation may take additional time.

### Payout workflow

1. The backend verifies the submitted answer.
2. The backend checks solver eligibility and bounty availability.
3. The reward amount is reserved in an atomic database transaction.
4. A payout record is persisted.
5. The payout worker processes the individual transfer.
6. The treasury signs and broadcasts the transaction.
7. The backend tracks and reconciles the transaction.
8. The reward is marked as paid only after the required on-chain confirmation.

The HTTP submission request does not need to remain open until blockchain confirmation.

### Reward reservation and concurrency

The reward reservation process must prevent multiple concurrent submissions from claiming the same remaining reward slot.

The eligibility check, participant limit check, and reward reservation must be protected by an appropriate database transaction and concurrency-control mechanism.

A solver must not receive multiple rewards for the same bounty.

The database must enforce the documented uniqueness rule for one reward per wallet per bounty.

### Payout idempotency and recovery

Each payout must have a stable idempotency identity.

Before creating another blockchain transfer for an existing payout, the worker must reconcile the previous transaction using its known signature and payout memo/reference.

If an RPC response is lost, the payout must not be treated as definitively failed without reconciliation.

The system must distinguish:

- Pending payout.
- Reserved reward.
- Processing transfer.
- Confirmed payout.
- Definitively failed payout.
- Unknown transaction outcome requiring reconciliation.

Retries must not create duplicate on-chain payments.

### Treasury fees

Bounty reward principal and network fees must be accounted for separately.

The treasury must maintain sufficient SOL for network fees without spending funds reserved for solver rewards or other protected bounty balances.

Network fees must not reduce the solver's predefined reward amount.

### Accounting

The existing ledger accounting identity remains unchanged:

`funded = reserved + paid + refundable + refunded`

A reserved reward remains reserved until the corresponding payout is confirmed or the system has established a definitive failure and handled the reservation according to the documented recovery rules.

Unused bounty principal remains subject to the separately documented MVP refund policy.

## Consequences

### Positive

- Eligible solvers do not wait for a scheduled batch payout.
- Each payout has an individual transaction record.
- Reward status can be tracked independently.
- The system can recover from transaction-processing failures.
- The payout process fits the existing NestJS modular monolith.

### Trade-offs

- More individual Solana transactions.
- Increased RPC activity.
- More transaction reconciliation work.
- Requires robust idempotency and concurrency control.
- Requires sufficient treasury funds for network fees.

## Implementation requirements

The implementation must include:

- Atomic reward reservation.
- Durable payout records.
- Idempotent payout processing.
- Transaction signature and memo tracking.
- On-chain transaction reconciliation.
- Retry and recovery handling.
- Separate network-fee accounting.
- Tests for concurrent final-slot allocation.
- Tests for lost RPC responses and duplicate-payment prevention.

The Solana confirmation commitment is [ADR-005](ADR-005-solana-confirmed-commitment.md): `confirmed`, plus the execution and detail checks in that decision.

## Scope

This decision establishes payout timing and workflow only.

It does not implement transfers, payout workers, treasury signing, database migrations, or blockchain integration.

The existing custodial Devnet treasury architecture remains governed by ADR-002.

No custom Solana program is introduced by this decision.

Eligibility rule E1 is unchanged. PD-05 is superseded. PD-08 remains the proposed refund policy. Confirmation commitment is [ADR-005](ADR-005-solana-confirmed-commitment.md).

## Alternatives

| Alternative | Why it was not selected |
| --- | --- |
| Periodic batch payouts | Eligible solvers would wait for a schedule. The product pays each eligible solver the configured amount as soon as the reward is reserved |
| Creator-triggered release | Adds a creator action between a correct answer and the send. PAY-016 requires no such action |
