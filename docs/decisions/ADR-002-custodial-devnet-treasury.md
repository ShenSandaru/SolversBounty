# ADR-002 Custodial Devnet treasury

- Status: accepted
- Date: 2026-11-07

## Context

Creators fund a fixed SOL principal. Eligible solvers receive an equal micro-reward, once each, until the cap or the balance runs out. Unused principal should be identifiable so the creator can be refunded.

A non-custodial design would put principal in a bounty account controlled by a Solana program, with the program enforcing cap, amount, and refund destination. That matches the long-term product better. It is also a custom program, which the MVP scope lists as out of scope, and it does not fit the 40-hour critical path.

The hackathon still needs real Devnet transfers so the demo can show a signature. The chosen compromise is a backend-held wallet plus an internal ledger. The PRD calls this out as a custodial prototype. Reconciliation C1 forbids describing it as trustless escrow.

Devnet SOL has no market value. The risk pattern is still the same as a hot wallet: anyone with `TREASURY_SECRET_KEY` can move every bounty's funds. The database, not the chain, knows which bounty owns which lamports.

## Decision

The MVP uses one backend-managed custodial treasury on Solana Devnet (CD-11).

- Creators transfer native SOL to that treasury with a deposit memo that names the bounty.
- The API verifies destination, source, amount, memo, and commitment before a bounty becomes active.
- The API signs solver payouts and, in P1, creator refunds from the same key.
- PostgreSQL ledger entries are the bounty balance. Chain transactions are evidence used to post those entries once.
- There is no custom Solana program in this MVP (CD-05).
- Platform fee is 0% (CD-12). Network fees come from a fee buffer, not from principal (PD-07).
- The treasury secret stays in API environment configuration (PD-15). It is not a frontend key, a database column, or a committed file.
- UI and docs say custodial Devnet treasury. They do not say trustless, non-custodial, or smart-contract escrow.
- Mainnet, USDC, and program escrow require a new ADR. This decision does not authorize them.

Eligibility, idempotency, and refund timing are specified in [blockchain design](../architecture/BLOCKCHAIN_DESIGN.md). Payout timing is [ADR-004](ADR-004-immediate-individual-solver-payouts.md). Confirmation commitment is [ADR-005](ADR-005-solana-confirmed-commitment.md). This ADR does not by itself accept PD-08. That remains proposed.

## Consequences

- The demo can pay a solver with an ordinary system transfer.
- Users trust the operator for the life of the hackathon. That trust is acceptable only because the network is Devnet and balances stay small.
- A ledger bug can pay the wrong person or pay twice if the idempotency rules are skipped. Payment-safety tests are mandatory before PAY requirements can be marked implemented.
- On-chain observers can see treasury deposits and payouts, including wallet addresses. That supports the pseudonymous privacy copy and blocks any anonymity claim.
- Refunds are an application policy. The chain will not automatically return unused principal.
- Losing the treasury key or committing it ends the demo's custody story. Rotation means a new key and a new ADR note if funds move.

## Alternatives

| Alternative | Why it was not selected |
| --- | --- |
| Custom Solana escrow program | Explicitly out of MVP scope. Too much program, test, and audit work for the critical path. Revisit as P2 |
| Non-custodial direct creator-to-solver transfers without a pool | Creators would have to stay online and sign every reward. The product needs a funded pool and a cap |
| Custodial mainnet treasury | Real loss if the key leaks. Not justified for a hackathon |
| Custodial USDC token account | Extra mint and token-account handling. SOL is the MVP asset |
| Trust the client to pay and self-report | Breaks CD-08. The client cannot decide eligibility or be the only record of payment |
