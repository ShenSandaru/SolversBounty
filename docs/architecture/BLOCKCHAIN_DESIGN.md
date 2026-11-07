# Blockchain design

Status: design intent for Solana Devnet. No client, key, or transaction exists in this repository. The treasury is custodial. It is not trustless escrow. See [ADR-002](../decisions/ADR-002-custodial-devnet-treasury.md).

Related: [system architecture](SYSTEM_ARCHITECTURE.md), [database design](DATABASE_DESIGN.md), [PRD](../product/PRD.md).

## Scope

MVP chain work uses `@solana/web3.js` and the native SOL system program (CD-05, PAY-017).

In scope:

- Wallet signature checks for login.
- Creator deposits to a backend treasury.
- Deposit verification.
- Solver payouts.
- Confirmation and idempotent retry.
- P1 creator refund of the refundable balance.

Out of scope: custom programs, program-derived escrow, USDC, mainnet, and multisig. Those need a new ADR.

## Wallets

| Wallet | Held by | Role |
| --- | --- | --- |
| Creator | User, in Phantom | Signs login and the deposit |
| Solver | User, in Phantom | Signs login. Receives SOL. Does not sign the payout |
| Treasury | API process | Receives deposits and signs payouts and refunds |

PD-15 (**proposed — pending confirmation**): `TREASURY_SECRET_KEY` is an environment variable on the API host, never committed, logged, or sent to the browser. PD-02's `ANSWER_ENCRYPTION_KEY` is a different variable. Neither key is stored in PostgreSQL.

The login message is not a transaction. Proposed message fields: domain, wallet address, nonce, issued-at, expiration, chain `solana:devnet`, and a sentence that the signature does not approve a transfer. Verification is local Ed25519 and must not require RPC.

## Custodial treasury

One Devnet keypair receives every bounty principal for the hackathon. Internal `BountyLedgerEntry` rows say which bounty owns which lamports. The chain does not enforce that split.

Consequences:

- The operator can move treasury SOL. The product must not pretend otherwise.
- A bug in ledger code can pay the wrong wallet. Unique allocations and idempotent sends are the controls.
- Demo balances stay small. Devnet SOL is not valuable, and the design is still unsafe for mainnet.

Network fees are paid from a fee buffer that is treasury SOL outside bounty principal (PD-07, **proposed — pending confirmation**). A suggested demo buffer is 0.1 SOL, which is an operational top-up, not a product parameter. If the buffer cannot pay a fee, the payout stays `retryable` and the bounty principal stays `reserved`.

## Amounts

1 SOL = 1_000_000_000 lamports. The example bounty is 0.01 SOL per solver and 100 solvers, so the principal is 1 SOL = 1_000_000_000 lamports. All comparisons use integers.

Platform fee is 0% (CD-12). The full confirmed deposit is bounty principal.

## Deposits

1. The API creates the bounty and a unique `depositReference`.
2. The creator UI shows the treasury address, the principal in lamports, and the memo.
3. The creator signs a system transfer in Phantom.
4. The client reports the signature. The API stores `BountyFunding` as `pending` and returns.
5. The worker loads the transaction. It activates the bounty only when all checks pass:
   - Commitment is at least the PD-13 level. **Proposed — pending confirmation:** `confirmed`.
   - Destination is the treasury.
   - Source is the creator wallet that owns the bounty.
   - The transfer is native SOL, not a token.
   - Memo is `sb:deposit:<bountyId>:<reference>` (PD-18).
   - Amount is at least the principal.

PD-21 (**proposed — pending confirmation**): lamports above the principal are accepted. They increase `funded` and `refundable`. A shortfall, wrong destination, wrong memo, or wrong source rejects the funding row and leaves the bounty inactive. The same signature is never posted twice (PAY-015).

```mermaid
sequenceDiagram
  participant Creator
  participant Web as NextjsWeb
  participant Api as NestApi
  participant Chain as SolanaDevnet
  Creator->>Web: Approve deposit
  Web->>Chain: System transfer plus memo
  Web->>Api: Signature
  Api->>Api: Store pending funding
  Api->>Chain: Fetch transaction on a later tick
  Chain-->>Api: Amount, destination, memo, commitment
  Api->>Api: Post ledger or reject
```

## Bounty balance

Ledger identity:

```text
funded = reserved + paid + refundable + refunded
```

| Bucket | Meaning |
| --- | --- |
| `funded` | Cumulative confirmed deposits. Does not decrease |
| `reserved` | Allocated to a solver whose payout is not confirmed |
| `paid` | Confirmed solver payouts |
| `refundable` | Still available to reserve or, after close, to refund |
| `refunded` | Confirmed transfers back to the creator |

`refunded` is included so the identity survives PAY-011. Product UI still leads with funded, reserved, paid, and refundable (PD-06).

Reservation and settlement rules are in the database design. The chain send never happens inside the database transaction that moves funds to `reserved`.

## Solver payouts

PD-05 (**proposed — pending confirmation**): the first eligible correct attempt pays immediately. There is no ranking and no creator batch.

Eligibility rule E1, verbatim:

A reward allocation is created only inside one database transaction when the submission attempt is verified correct, the attempt belongs to the authenticated solver's solving session, a consent record exists, the attempt number is within the bounty attempt limit, the bounty is active, the server time is at or before the deadline, that solver has no allocation on that bounty, the number of allocations is below max rewarded solvers, and refundable lamports are at least the reward. The same transaction moves the reward from refundable to reserved and inserts one payout in `pending`. The chain transfer happens after the transaction commits. A correct attempt that fails only the capacity checks (allocation cap or refundable balance) is stored with an ineligibility reason and creates no payout. Requests that fail consent, ownership, attempt limit, bounty activity, or deadline are rejected and store no attempt.

After commit:

1. Load the `pending` payout by its idempotency key `payout:<bountyId>:<walletAddress>` (PAY-009).
2. If status is `submitted` or `confirmed`, do not sign another transfer.
3. If status is `pending` or `retryable`, build a system transfer from the treasury to the solver for `amountLamports`, with memo `sb:payout:<payoutId>` (PD-18).
4. Persist the signature and status `submitted` before considering the send complete.
5. On a later tick, require PD-13 commitment, the treasury as source, the solver as destination, and the reserved amount.
6. Then post `settle` once and set the payout to `confirmed`.

Every eligible solver gets the same `rewardLamports`. The payer of the network fee is the treasury fee buffer, so the solver's transferred principal matches the configured reward (PD-07).

## Idempotency

Three layers:

| Layer | Mechanism |
| --- | --- |
| Allocation | Unique `(bountyId, solverId)` |
| Payout row | Unique `allocationId` and unique idempotency key. Retries update the same row |
| Chain evidence | Unique signature. A confirmation handler returns if that signature was already settled |

The worker may run twice. The second run must see `submitted` or `confirmed` and stop.

## Confirmation

PD-13 (**proposed — pending confirmation**) treats `confirmed` as the demo success bar. `processed` is too weak for the demo because the API would mark `paid` before a fork could drop the transfer. `finalized` is safer and slower. The open question is whether the demo should wait for `finalized` instead.

Until the worker records that commitment:

- Deposits do not activate a bounty.
- Payouts stay `submitted`.
- `paid` does not increase.

Ordinary marketplace and submission reads do not wait on this poll (PD-16).

## Refund policy

PD-08 (**proposed — pending confirmation**):

- Creator close, admin close, deadline, or reaching max rewarded solvers stops new solving sessions.
- P0 keeps the unused principal in `refundable` and shows it to the owner.
- P0 does not send a refund and does not run an automatic refund worker.
- P1 PAY-011 lets the owner of a `closed` bounty refund the current `refundable` balance to the creator wallet.
- The amount is the balance inside the refund transaction, not a client amount.
- The refund uses the same confirmation and idempotency rules, with memo `sb:refund:<bountyId>`.
- Unconfirmed solver payouts stay `reserved` and are not included in the refund.
- A reservation is released back to `refundable` only when its signature is known failed and the operator or worker marks that payout permanently failed. Ordinary retries keep the funds reserved.

## Failure handling

| State | Meaning | Next step |
| --- | --- | --- |
| `pending` | Reserved in the database, no signature | Sign once |
| `submitted` | Signature stored, not confirmed | Poll. Do not sign again |
| `confirmed` | Chain checks passed and ledger settled | Stop |
| `failed` | Signature known dead, or preflight rejected | Record the signature, then mark `retryable` |
| `retryable` | Safe to sign a new transfer for the same payout row | Sign once, store the new signature, return to `submitted` |

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> submitted: Signature stored
  submitted --> confirmed: Commitment and amount checks
  submitted --> failed: Expired or failed signature
  pending --> failed: Preflight rejected
  failed --> retryable: Same payout row
  retryable --> submitted: New signature stored
  confirmed --> [*]
```

A process crash in any non-terminal state is recovered by reading the payout row. There is no in-memory payment queue.

Preflight rejection includes an empty fee buffer and an RPC outage during send. Neither case may post `settle`.

## Reconciliation

For each confirmed signature the worker recognizes:

- Deposit: one `deposit` ledger entry, then the bounty may become `active` if the sum of confirmed deposits covers principal.
- Payout: one `settle` entry and allocation `paid`.
- Refund: one `refund` entry.

Reprocessing a signature is a no-op. A confirmed signature whose destination or amount does not match the row is an audit exception and does not move the ledger (NFR-009).

The treasury's on-chain balance is not the bounty ledger. It should be at least the sum of all bounties' `reserved + refundable`, plus the fee buffer. A demo admin check can compare those figures. Automating that comparison beyond a logged warning is unnecessary for the hackathon.

## Demo operation

These are operator steps, not product features:

1. Create a Devnet treasury keypair outside git and put it in `TREASURY_SECRET_KEY`.
2. Airdrop a small fee buffer to the treasury.
3. Airdrop the creator wallet so it can deposit principal.
4. Use a small cap for the live demo if the faucet is tight. The product example of 100 solvers remains valid.
5. Never reuse this key on mainnet.

No airdrop, key, or signature is part of Phase 1.
