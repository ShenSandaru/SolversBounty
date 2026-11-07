# ADR-012 Two Devnet funding transfers

- Status: accepted
- Date: 2026-11-07

## Context

[ADR-007](ADR-007-company-platform-commission.md) requires the creator to fund the full solver reward pool and to pay an additional 5% commission. It left the on-chain arrangement and the commission receiving address for implementation planning. [ADR-002](ADR-002-custodial-devnet-treasury.md) keeps SOL in one custodial Devnet treasury. [ADR-005](ADR-005-solana-confirmed-commitment.md) requires `confirmed` before a funding obligation is complete. [ADR-011](ADR-011-separate-platform-revenue-ledger.md) keeps commission outside `funded` and approves no new ledger bucket.

The database already has one `BountyFunding` row per purpose. That model does not decide whether the creator signs one Solana transaction or two.

## Decision

The creator signs two separate System Program transfers on Solana Devnet. Both transfers go to the same custodial treasury public key, `TREASURY_PUBLIC_KEY`. There is no second commission wallet and no custom program.

Each transfer includes one memo, `sb:deposit:<bountyId>:reward_pool` or `sb:deposit:<bountyId>:commission`. One signature can confirm only one obligation. The amount must equal that obligation. Extra lamports are not accepted. PD-21 remains proposed and is not applied.

The API verifies the signature against Devnet RPC at `confirmed` or `finalized`. `processed` is not enough. An RPC timeout is not a failed transfer. A signature that is already stored is reconciled before a different signature is accepted. A timeout before any observation is stored is not marked failed; the same signature is submitted again.

Confirming the reward pool posts one `deposit` ledger entry. Confirming the commission posts none. The bounty stays out of the public active list until the owner activates it and both rows are `confirmed`.

The treasury secret stays in the API environment and is not required to verify these creator-signed transfers.

## Consequences

- Creators approve two Phantom SOL transfers, each distinct from the login message.
- The commission and the reward pool can be verified independently.
- One on-chain transaction cannot be applied to both obligations.
- Exceptional endings for a paid commission, including a bounty that never activates, remain unspecified.

## Alternatives

| Alternative | Why it was not selected |
| --- | --- |
| One transaction with two transfers | A single signature would have to be bound to both obligations, which makes a partial failure and a replay harder to reconcile |
| A separate commission address | ADR-002 already keeps custody in one Devnet treasury. A second wallet is more key material for the same MVP |
| Count extra lamports as refundable principal | PD-21 is still proposed. This stage requires the exact obligation |
