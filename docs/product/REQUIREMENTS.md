# Requirements catalogue

Stable IDs for SolversBounty. Status values: `not_started`, `in_progress`, `implemented`, `deferred`.

Every row below starts as `not_started`. Status changes only when the matching work has evidence. Do not renumber an ID. Priority follows the [PRD](PRD.md) reconciliations.

Eligibility rule E1 is canonical in the [README](../../README.md). Metric definitions are in [PRD section 5.8](PRD.md).

Proposed behavior is marked **proposed** and points at a `PD-*` ID in the [implementation plan](../development/IMPLEMENTATION_PLAN.md).

## AUTH

### AUTH-001 Connect Phantom

- Priority: P0
- Status: `in_progress`
- Modules: web auth, auth
- Description: A visitor can connect a Phantom wallet in the browser.

Acceptance criteria:

- The connect action uses the wallet extension.
- The platform never asks the user to paste a secret key.
- A missing wallet shows a recoverable message.

### AUTH-002 Issue an authentication nonce

- Priority: P0
- Status: `implemented`
- Modules: auth
- Description: The API creates a single-use nonce bound to the wallet address.

Acceptance criteria:

- Two unconsumed nonces are not both valid for the same wallet. Issuing a new nonce retires the previous unconsumed nonce.
- The nonce expires. Proposed lifetime: 10 minutes.
- The nonce value is unguessable.

### AUTH-003 Sign an authentication message

- Priority: P0
- Status: `in_progress`
- Modules: web auth, auth
- Description: The wallet signs a login message that includes the domain, wallet, nonce, and expiry.

Acceptance criteria:

- The message states that it does not approve a SOL transfer.
- The signed bytes match the message the API verifies.

### AUTH-004 Verify the signature on the backend

- Priority: P0
- Status: `implemented`
- Modules: auth, solana
- Description: The API checks the Ed25519 signature locally. This check does not require RPC.

Acceptance criteria:

- A valid Phantom signature for the issued message authenticates that wallet.
- A signature for a different message, wallet, or nonce is rejected.

### AUTH-005 Create or load the user

- Priority: P0
- Status: `implemented`
- Modules: auth, users
- Description: The first successful login creates a user for the wallet. Later logins load the same user.

Acceptance criteria:

- Wallet address is unique.
- Login does not collect email, password, or KYC.

### AUTH-006 Issue a session

- Priority: P0
- Status: `in_progress`
- Modules: auth
- Description: A successful login creates a server-recognized session.

Acceptance criteria:

- Subsequent creator and solver calls accept that session and reject a missing, expired, or revoked session. Creator and solver routes are not built yet, so this criterion is not met.
- Session shape is [ADR-003](../decisions/ADR-003-postgresql-server-side-sessions.md): store a hash of the session token on `AuthSession`, and send the raw token only in an HttpOnly cookie. The working lifetime is 8 hours. That lifetime is not an accepted ADR decision. The working CSRF mechanism is an HttpOnly `sb_csrf` cookie plus the `X-CSRF-Token` header on logout. That mechanism is not an accepted ADR decision.
- Logout revokes that server session. Disconnecting the wallet does not.

### AUTH-007 Disconnect

- Priority: P0
- Status: `in_progress`
- Modules: web auth, auth
- Description: The user can disconnect the wallet. Logging out ends the server session. Those are separate actions.

Acceptance criteria:

- Logout revokes the server session. Disconnecting the wallet does not.
- After logout, a later call with that session cookie is rejected.
- Neither action sends a transaction.

### AUTH-008 Reject invalid signatures

- Priority: P0
- Status: `implemented`
- Modules: auth
- Description: Bad signatures do not create users or sessions.

Acceptance criteria:

- Tampered message, wrong public key, or truncated signature returns an authentication error.
- The error body does not echo secret material.

### AUTH-009 Reject nonce reuse

- Priority: P0
- Status: `implemented`
- Modules: auth
- Description: A nonce works once.

Acceptance criteria:

- Replaying a consumed or expired nonce fails.
- The failed replay does not issue a session.

### AUTH-010 Keep private keys in the wallet

- Priority: P0
- Status: `in_progress`
- Modules: web auth
- Description: The platform never receives a wallet secret.

Acceptance criteria:

- No API field accepts a secret key or seed phrase.
- Logs do not contain signed-in key material.

### AUTH-011 No email or password

- Priority: P0
- Status: `in_progress`
- Modules: auth, web auth
- Description: MVP authentication is wallet-only.

Acceptance criteria:

- No registration form asks for email or password.
- No password hash exists in the schema.

## USER

### USER-001 Wallet-keyed profile

- Priority: P0
- Status: `not_started`
- Modules: users
- Description: A user is the wallet address plus role and timestamps.

Acceptance criteria:

- The authenticated user can see their wallet address.
- Another user cannot update that profile.

### USER-002 Create and solve with one wallet

- Priority: P0
- Status: `not_started`
- Modules: users, bounties, submissions
- Description: The same user may own bounties and attempt other bounties.

Acceptance criteria:

- Creating a bounty does not remove the ability to solve a different bounty.
- A creator attempting their own bounty is allowed in the MVP and is still subject to E1. This is not Sybil defense.

### USER-003 Administrator role

- Priority: P1
- Status: `not_started`
- Modules: users, auth
- Description: **Proposed** PD-04. Wallets on the server allowlist receive role `admin` at login.

Acceptance criteria:

- A wallet not on the allowlist has role `user`.
- Role is assigned by the server, never by the client payload.

### USER-004 Participation and reward history

- Priority: P0
- Status: `not_started`
- Modules: submissions, rewards, web history
- Description: A solver can list their sessions, results, and payout statuses.

Acceptance criteria:

- The list includes only that wallet's activity.
- A confirmed payout shows its Devnet signature.
- Pending and failed payouts show their status.

## BOUNTY

### BOUNTY-001 Create a bounty

- Priority: P0
- Status: `implemented`
- Modules: bounties
- Description: An authenticated user can create a bounty with the required fields in the PRD.

Acceptance criteria:

- Missing title, description, category, question, expected answer, verification method, reward, max rewarded solvers, deadline, or attempt limit is rejected.
- The created bounty is `draft` or `funding_pending` and is not publicly attemptable.

### BOUNTY-002 Validate field bounds

- Priority: P0
- Status: `implemented`
- Modules: bounties
- Description: Reward, cap, deadline, and attempt limit are sane.

Acceptance criteria:

- Reward and max rewarded solvers are positive integers in their units. Reward is lamports on the server.
- Deadline is in the future at creation time.
- Attempt limit is a positive integer. Proposed default maximum: 10.
- Category and verification method are members of the allowed enums.

### BOUNTY-003 Compute principal

- Priority: P0
- Status: `implemented`
- Modules: bounties
- Description: Principal lamports equal reward per solver times max rewarded solvers.

Acceptance criteria:

- 0.01 SOL and 100 solvers display as a 1 SOL reward pool and store as 1_000_000_000 lamports.
- The computation uses integer lamports, not floating point.
- [ADR-007](../decisions/ADR-007-company-platform-commission.md) commission is not part of principal. That example commission is 50_000_000 lamports (PAY-018).

### BOUNTY-004 Hide the expected answer

- Priority: P0
- Status: `in_progress`
- Modules: bounties, verification
- Description: Public and solver payloads omit the expected answer. **Proposed** PD-02 stores it encrypted.

Acceptance criteria:

- Marketplace, solver detail, submission result, and analytics public DTOs have no expected-answer field.
- A wrong guess does not return the answer.
- Logs and errors omit it.

### BOUNTY-005 Creator private view

- Priority: P0
- Status: `implemented`
- Modules: bounties
- Description: The owning creator can read the full configuration, including the expected answer.

Acceptance criteria:

- The owner receives the decrypted answer on the private endpoint.
- A non-owner authenticated user receives not found or forbidden, without the answer.

### BOUNTY-006 Creator isolation

- Priority: P0
- Status: `in_progress`
- Modules: bounties, analytics
- Description: Private configuration, submissions, and analytics are scoped to the owner.

Acceptance criteria:

- Creator A cannot fetch Creator B's private bounty, ledger detail, or analytics.
- Guessing a UUID does not bypass the owner check.

### BOUNTY-007 Fund before active

- Priority: P0
- Status: `in_progress`
- Modules: bounties, solana
- Description: Status becomes `active` only after the full solver reward pool and the separate 5% commission are verified ([ADR-007](../decisions/ADR-007-company-platform-commission.md), [ADR-012](../decisions/ADR-012-two-devnet-funding-transfers.md), PAY-018). Mocked RPC tests cover activation. A live Devnet transfer has not been verified.

Acceptance criteria:

- A draft or funding-pending bounty cannot start a solving session.
- A missing reward-pool payment or a missing commission does not activate the bounty.
- An underfunded reward-pool transfer does not activate the bounty (PD-21).

### BOUNTY-008 Category

- Priority: P0
- Status: `in_progress`
- Modules: bounties, marketplace
- Description: Category is one of `logic`, `mathematics`, `numerical_patterns`, `ciphers`.

Acceptance criteria:

- The marketplace can filter on these values.
- Unknown categories are rejected at creation.

### BOUNTY-009 Attempt limit

- Priority: P0
- Status: `in_progress`
- Modules: bounties, submissions
- Description: Each solver has a maximum number of stored attempts on that bounty.

Acceptance criteria:

- The limit is stored on the bounty and shown to the solver.
- Enforcement is specified in SOLVE-004.

### BOUNTY-010 Deadline

- Priority: P0
- Status: `in_progress`
- Modules: bounties, submissions
- Description: After the deadline, the bounty no longer accepts new sessions or submissions.

Acceptance criteria:

- Comparison uses server time.
- The close reason for a deadline is `deadline`, displayed as Expired.

### BOUNTY-011 Instructions

- Priority: P0
- Status: `in_progress`
- Modules: bounties, marketplace
- Description: Optional instruction text is public on the challenge.

Acceptance criteria:

- Instructions are visible without authentication.
- They cannot be used as a side channel for returning the expected answer from a private field. The creator is responsible for the text they publish.

### BOUNTY-012 SOL on Devnet

- Priority: P0
- Status: `implemented`
- Modules: bounties, solana
- Description: The only MVP reward asset is native SOL on Devnet.

Acceptance criteria:

- Creation does not offer USDC or mainnet.
- Display amounts are SOL. Stored amounts are lamports.

### BOUNTY-013 One question

- Priority: P0
- Status: `implemented`
- Modules: bounties
- Description: **Proposed** PD-01. A bounty has one question row.

Acceptance criteria:

- The create API accepts one prompt and one expected answer.
- The schema still uses `BountyQuestion` so a later bounty can add questions without replacing `Bounty`.

### BOUNTY-014 List own bounties

- Priority: P0
- Status: `implemented`
- Modules: bounties, web creator
- Description: The creator dashboard lists that creator's bounties and statuses.

Acceptance criteria:

- Status and close reason match the database.
- Another creator's bounties are absent from the list.

### BOUNTY-015 Close a bounty

- Priority: P0
- Status: `not_started`
- Modules: bounties
- Description: The owner can close an active bounty. New sessions stop. A creator close is not ADR-008 retention. Unused-principal treatment for that close is not decided.

Acceptance criteria:

- Close sets status `closed` and close reason `creator`.
- Existing refundable lamports remain refundable.
- Unconfirmed reserved payouts stay reserved until they confirm or are explicitly released.

### BOUNTY-016 Show funding

- Priority: P0
- Status: `in_progress`
- Modules: bounties, web creator
- Description: The owner sees required principal, confirmed deposits, and the ledger buckets. The funding screen reads those figures from the API. A live Devnet deposit has not been verified.

Acceptance criteria:

- Figures satisfy `funded = reserved + paid + refundable + refunded`.
- A pending deposit is not counted as funded.

## MARKET

### MARKET-001 Browse active bounties

- Priority: P0
- Status: `implemented`
- Modules: bounties, web marketplace
- Description: The marketplace lists bounties a solver may still join.

Acceptance criteria:

- `active` bounties before the deadline and under the allocation cap are listed.
- `draft`, `funding_pending`, and `closed` bounties are not listed as attemptable.

### MARKET-002 Search

- Priority: P0
- Status: `implemented`
- Modules: bounties, web marketplace
- Description: Search matches public title and description.

Acceptance criteria:

- Search does not query the expected answer.
- Empty search returns the normal active list.

### MARKET-003 Filter by category

- Priority: P0
- Status: `implemented`
- Modules: bounties, web marketplace
- Description: A category control filters the list.

Acceptance criteria:

- Selecting `ciphers` returns only that category.
- Combining search and filter applies both.

### MARKET-004 Public bounty facts

- Priority: P0
- Status: `in_progress`
- Modules: bounties, web marketplace
- Description: Each card or detail shows reward, max rewarded solvers, deadline, instructions, category, and status.

Acceptance criteria:

- Reward is shown in SOL.
- Participant progress may show rewarded count versus max, without wallet addresses.

### MARKET-005 Attempt gate

- Priority: P0
- Status: `implemented`
- Modules: submissions
- Description: Starting a session requires an active, in-date bounty that is under the allocation cap.

Acceptance criteria:

- The API, not the UI, enforces the gate.
- A direct POST for a closed bounty fails.

### MARKET-006 Terminal bounties

- Priority: P0
- Status: `implemented`
- Modules: submissions, bounties
- Description: Closed, expired, and fully allocated bounties reject new eligible participants.

Acceptance criteria:

- Close reasons `creator`, `deadline`, `fully_allocated`, and `admin` all reject new sessions.
- A bounty that just reached the cap cannot open another session.

### MARKET-007 Public secrecy

- Priority: P0
- Status: `implemented`
- Modules: bounties
- Description: Marketplace JSON does not reveal protected answers.

Acceptance criteria:

- Response snapshots used in tests fail if `expectedAnswer` or ciphertext appears.

## SOLVE

### SOLVE-001 Read a challenge

- Priority: P0
- Status: `in_progress`
- Modules: web solver, bounties
- Description: An authenticated solver can open public challenge detail.

Acceptance criteria:

- The prompt, instructions, reward, attempt limit, and deadline are visible.
- The expected answer is not.

### SOLVE-002 Start a solving session

- Priority: P0
- Status: `implemented`
- Modules: submissions
- Description: The solver starts one session per bounty. The server stores `startedAt`.

Acceptance criteria:

- `startedAt` is the server clock.
- A client-supplied start time is ignored.
- A second start by the same wallet returns the existing session rather than a second one.

### SOLVE-003 Submit an answer

- Priority: P0
- Status: `implemented`
- Modules: submissions, verification
- Description: The solver submits text for the open session. The API stores the attempt and the server receipt time.

Acceptance criteria:

- The stored attempt links to the session and bounty.
- Client `submittedAt` and client `isCorrect` are ignored.

### SOLVE-004 Enforce the attempt limit

- Priority: P0
- Status: `implemented`
- Modules: submissions
- Description: The backend rejects attempts beyond the bounty limit.

Acceptance criteria:

- The over-limit request stores nothing and creates no payout.
- The check cannot be skipped by calling the API directly.

### SOLVE-005 Submission status

- Priority: P0
- Status: `implemented`
- Modules: submissions, web solver
- Description: The solver sees attempt number, correct or incorrect, and eligibility.

Acceptance criteria:

- An incorrect attempt says incorrect and shows remaining attempts.
- A correct ineligible attempt says correct and names the ineligibility reason without leaking the answer.

### SOLVE-006 One reward per wallet

- Priority: P0
- Status: `implemented`
- Modules: rewards, submissions
- Description: The same wallet cannot receive two rewards for one bounty.

Acceptance criteria:

- A unique `(bounty, solver)` allocation is enforced in the database.
- After a reserved or paid allocation, further submits on that bounty do not create another payout.

### SOLVE-007 Show eligibility

- Priority: P0
- Status: `in_progress`
- Modules: web solver, rewards
- Description: The workspace states whether this solver was allocated a reward and the payout status.

Acceptance criteria:

- Status follows the payout row: `pending`, `submitted`, `confirmed`, `failed`, or `retryable`.
- A confirmed row includes the signature.

### SOLVE-008 Consent before the session

- Priority: P0
- Status: `implemented`
- Modules: submissions
- Description: **Proposed** PD-09. Research recording starts only after stored consent.

Acceptance criteria:

- Session start without consent fails.
- The consent record stores user, bounty, policy version, and server time.
- The UI states which fields in the PRD privacy table are collected.

### SOLVE-009 Solver history

- Priority: P0
- Status: `not_started`
- Modules: web history, submissions, rewards
- Description: The solver has a history view of attempts and rewards.

Acceptance criteria:

- Covered together with USER-004. This ID tracks the workspace entry point.
- History omits other wallets.

### SOLVE-010 Self-reported strategy

- Priority: P1
- Status: `not_started`
- Modules: submissions
- Description: **Proposed** PD-10. Excluded from the MVP by [ADR-009](../decisions/ADR-009-minimal-research-analytics.md). A later version may let the solver pick one strategy from a fixed list. Status stays `not_started`.

Acceptance criteria:

- The value is optional.
- Unknown strategy values are rejected.
- The field is absent from public bounty payloads.

### SOLVE-011 Written explanation

- Priority: P1
- Status: `not_started`
- Modules: submissions
- Description: **Proposed** PD-10. Excluded from the MVP by [ADR-009](../decisions/ADR-009-minimal-research-analytics.md). A later version may accept a short explanation. Status stays `not_started`.

Acceptance criteria:

- The explanation is optional and length-limited. Proposed cap: 2_000 characters.
- Analytics do not return it. Another solver cannot read it from the public bounty.

## VERIFY

### VERIFY-001 Verify on the server

- Priority: P0
- Status: `in_progress`
- Modules: verification
- Description: Comparison runs in the API process.

Acceptance criteria:

- The web bundle contains no expected answer and no copy of the answer table.
- Disabling client script still yields a server decision when the API is called.

### VERIFY-002 Exact match

- Priority: P0
- Status: `implemented`
- Modules: verification
- Description: Method `exact` requires identical strings.

Acceptance criteria:

- `42` matches `42`.
- ` 42 ` and `42 ` do not match under `exact`.

### VERIFY-003 Case-insensitive match

- Priority: P0
- Status: `implemented`
- Modules: verification
- Description: Method `case_insensitive` ignores letter case and does not otherwise normalize.

Acceptance criteria:

- `Paris` matches `paris`.
- Leading spaces still fail.

### VERIFY-004 Normalized text

- Priority: P0
- Status: `implemented`
- Modules: verification
- Description: Method `normalized_text` trims and collapses whitespace, then compares case-sensitively.

Acceptance criteria:

- ` 42 ` matches `42`.
- `Hello  world` matches `Hello world`.
- Case differences still fail.

### VERIFY-005 Exact numeric

- Priority: P0
- Status: `implemented`
- Modules: verification
- Description: Method `numeric_exact` trims and compares decimal numeric strings without a tolerance.

Acceptance criteria:

- `42` and ` 42 ` match.
- `42.0` does not match `42`.
- Non-numeric input is incorrect, not a 500 error.

### VERIFY-006 Store both outcomes

- Priority: P0
- Status: `implemented`
- Modules: submissions
- Description: Correct and incorrect attempts are persisted.

Acceptance criteria:

- Each stored attempt has a boolean result and the verification method used.
- A later analytics query can count both.

### VERIFY-007 Link the result to the attempt

- Priority: P0
- Status: `implemented`
- Modules: submissions
- Description: The decision is a column on the attempt, not a detached record that can be mismatched.

Acceptance criteria:

- Reading the attempt returns its own result.
- Re-verifying does not create a second attempt.

### VERIFY-008 No public answer oracle

- Priority: P0
- Status: `in_progress`
- Modules: bounties, verification, submissions
- Description: APIs do not provide a way to dump or confirm the expected answer except by an authenticated solver consuming an attempt.

Acceptance criteria:

- There is no preview or hint endpoint in the MVP.
- Rate limits still apply to guesses (PD-20).

### VERIFY-009 Ignore client correctness

- Priority: P0
- Status: `implemented`
- Modules: submissions
- Description: The client cannot set the stored result.

Acceptance criteria:

- A body of `{ "answer": "wrong", "isCorrect": true }` stores incorrect when the answer does not verify.

## PAY

### PAY-001 Pay only eligible correct solvers

- Priority: P0
- Status: `not_started`
- Modules: rewards
- Description: A payout exists only for an allocation created under E1.

Acceptance criteria:

- E1 from the README is implemented without extra exceptions.
- Incorrect attempts create no allocation.
- A correct attempt that fails only the capacity checks is stored with reason `pool_exhausted` or `insufficient_refundable` and creates no payout.
- Requests that fail consent, ownership, attempt limit, bounty activity, or deadline are rejected and store no attempt.

### PAY-002 Cap at one reward

- Priority: P0
- Status: `not_started`
- Modules: rewards
- Description: One allocation per bounty and solver.

Acceptance criteria:

- The database unique key rejects a second insert.
- Concurrent correct submits for the same wallet still yield one allocation.

### PAY-003 Stay within principal

- Priority: P0
- Status: `not_started`
- Modules: rewards
- Description: Reserved plus paid solver rewards cannot exceed funded principal.

Acceptance criteria:

- The ledger identity holds after every funding confirmation, reservation, settlement, release, and refund.
- A reservation that would make refundable negative does not commit.

### PAY-004 Record payouts

- Priority: P0
- Status: `not_started`
- Modules: rewards
- Description: Every send attempt is a payout row plus chain-transaction evidence when a signature exists.

Acceptance criteria:

- The row stores idempotency key, status, allocation, and signatures tried.
- Creators and the paid solver can read the status. Other users cannot.

### PAY-005 Confirm on-chain

- Priority: P0
- Status: `in_progress`
- Modules: solana, rewards
- Description: `paid` increases only after the transaction reaches `confirmed` and the execution and detail checks pass.

Acceptance criteria:

- [ADR-005](../decisions/ADR-005-solana-confirmed-commitment.md) commitment is `confirmed`. `processed` is not sufficient. `finalized` is not required.
- Commitment alone is not proof. Execution must succeed, and the sender, recipient, amount, and payout reference must match.
- A signature that never confirms does not move reserved funds to paid.
- A timeout or lost RPC response is not treated as a failed transfer.

### PAY-006 Retry safely

- Priority: P0
- Status: `in_progress`
- Modules: rewards, solana
- Description: Failures retry the same payout row.

Acceptance criteria:

- Status `submitted` with an unresolved signature does not trigger a second send.
- A missing transaction stays `submitted`. Age alone does not move it to `retryable`.
- A confirmed execution failure for that signature may move the row to `retryable` and then send once more, keeping the failed signature in history.
- Status `confirmed` is never resent, and a later failure observation does not replace a settled row.

### PAY-007 Creator distribution view

- Priority: P0
- Status: `not_started`
- Modules: rewards, web creator
- Description: The owner sees counts and lamports for reserved, paid, and refundable amounts, plus payout statuses.

Acceptance criteria:

- Totals match the ledger.
- The view is owner-only.

### PAY-008 Verify deposits

- Priority: P0
- Status: `in_progress`
- Modules: solana, bounties
- Description: A bounty activates only when a confirmed transfer to the treasury covers the principal and carries that bounty's deposit reference ([ADR-012](../decisions/ADR-012-two-devnet-funding-transfers.md)). Mocked RPC tests cover the checks. A live Devnet transfer has not been verified.

Acceptance criteria:

- Destination, amount, mint (system SOL), and memo reference are checked.
- A transfer to some other address is rejected.
- **Proposed** PD-18 memo format is `sb:deposit:<bountyId>:<reference>`.
- **Proposed** PD-21: extra lamports on the reward-pool deposit are funded and refundable. Shortfalls do not activate.
- The separate commission in PAY-018 must also be verified. It is not extra reward-pool principal.

### PAY-009 Idempotent payout send

- Priority: P0
- Status: `in_progress`
- Modules: rewards, solana
- Description: The send operation keys off the payout idempotency key.

Acceptance criteria:

- **Proposed** key is `payout:<bountyId>:<walletAddress>`.
- Repeating the worker tick does not create two in-flight signatures.

### PAY-010 Track refundable balance

- Priority: P0
- Status: `not_started`
- Modules: rewards, bounties
- Description: The unallocated reward-pool balance stays in the ledger through close, expiry, and full allocation. `refundable` is that balance. It does not by itself entitle the creator to a refund. [ADR-008](../decisions/ADR-008-unused-reward-pool-retention.md) retains the remainder as platform revenue after the deadline or the participant cap and keeps those lamports in `refundable`. A revenue classification of that balance is not a second asset. Retention is not implemented. No creator refund is sent for that balance. Status stays `not_started`.

Acceptance criteria:

- Closing a bounty does not by itself transfer unused principal to the creator.
- Releasing a permanently failed reservation returns lamports to the unallocated balance.
- The creator can see the unallocated figure.
- After deadline or full allocation, that unallocated remainder is platform revenue under [ADR-008](../decisions/ADR-008-unused-reward-pool-retention.md) and is not `paid`.

### PAY-011 Retain unused reward principal

- Priority: P0
- Status: `not_started`
- Modules: rewards
- Description: [ADR-008](../decisions/ADR-008-unused-reward-pool-retention.md). After the deadline or the maximum rewarded participant limit, unallocated reward-pool principal is platform revenue. Creators are not refunded that balance. Retention is not implemented.

Acceptance criteria:

- Deadline or `fully_allocated` closure does not transfer unused principal to the creator.
- The retained amount is not posted as `paid` or as `refunded`, and [ADR-008](../decisions/ADR-008-unused-reward-pool-retention.md) does not deduct it from `refundable`.
- The reward-pool identity remains `funded = reserved + paid + refundable + refunded`.
- Reports must not add retained revenue on top of `refundable` as a second holding. [ADR-011](../decisions/ADR-011-separate-platform-revenue-ledger.md) is accepted and approves no schema.
- Cancelled, never-activated, failed or incomplete funding, creator close, and admin close do not use this rule.
- Solvers pay no participation fee.

### PAY-012 Fee buffer

- Priority: P0
- Status: `not_started`
- Modules: solana
- Description: **Proposed** PD-07. Network fees are not deducted from bounty principal.

Acceptance criteria:

- A confirmed 0.01 SOL reward credits the solver 0.01 SOL of principal accounting. The fee is paid by the treasury fee buffer.
- If the buffer cannot cover the fee, the payout stays retryable and principal stays reserved.

### PAY-013 Disclose custody

- Priority: P0
- Status: `not_started`
- Modules: web, docs
- Description: UI and docs call the treasury custodial.

Acceptance criteria:

- Funding copy does not say trustless, non-custodial, or smart-contract escrow.
- ADR-002 remains the decision record.

### PAY-014 Isolate treasury keys

- Priority: P0
- Status: `not_started`
- Modules: solana
- Description: [ADR-006](../decisions/ADR-006-devnet-treasury-private-key-storage.md). The Devnet treasury secret is a backend-only environment variable. Signing is not implemented.

Acceptance criteria:

- The key is absent from the client bundle, database, logs, error messages, API responses, and git.
- Environment files that contain secrets stay gitignored.
- A missing or invalid key does not sign. Public reads stay available.
- Clients cannot submit an arbitrary transaction for the treasury to sign.
- The answer-encryption key is a different secret.
- This storage decision does not authorize Mainnet custody.

### PAY-015 Reconcile ledger and chain

- Priority: P0
- Status: `not_started`
- Modules: solana, rewards, bounties
- Description: Confirmed chain amounts for known signatures match ledger postings.

Acceptance criteria:

- A deposit confirmation posts `funded` once for that signature.
- A payout confirmation posts `paid` once for that signature.
- Reprocessing the same signature is a no-op.

### PAY-016 Immediate equal rewards

- Priority: P0
- Status: `not_started`
- Modules: rewards
- Description: [ADR-004](../decisions/ADR-004-immediate-individual-solver-payouts.md). The first E1 success reserves and sends that solver's configured reward. There is no ranking batch. Payouts are not implemented.

Acceptance criteria:

- Two eligible solvers receive the same lamport amount.
- No creator action is required between a correct answer and the payout send.
- The submission HTTP request returns without waiting for chain confirmation.
- The reward is marked paid only after `confirmed` and the ADR-005 detail checks. Chain integration is not implemented.

### PAY-017 No custom program

- Priority: P0
- Status: `not_started`
- Modules: solana
- Description: Transfers use the Solana system program from the custodial keypair.

Acceptance criteria:

- The repository contains no Solana program crate in the MVP.
- Payouts are ordinary SOL transfers.

### PAY-018 Record platform commission

- Priority: P0
- Status: `in_progress`
- Modules: bounties, solana
- Description: [ADR-007](../decisions/ADR-007-company-platform-commission.md) and [ADR-012](../decisions/ADR-012-two-devnet-funding-transfers.md). The creator pays 5% of the solver reward pool in addition to the pool. Mocked tests cover the separate obligation. A live Devnet commission transfer has not been verified.

Acceptance criteria:

- For a 1_000_000_000 lamport pool, the commission is 50_000_000 lamports and the total payment is 1_050_000_000 lamports.
- When the pool is 1_000_000_001 lamports, `floor(pool * 5 / 100)` is 50_000_000. The commission is never rounded up. The calculation uses integer lamports, not floating-point arithmetic.
- Solver reward amounts are unchanged.
- Commission is not posted into `funded`, `reserved`, `paid`, `refundable`, or `refunded`.
- The bounty does not become active until both the reward pool and the commission are verified under ADR-005, including network, parties, amounts, and references.
- [ADR-012](../decisions/ADR-012-two-devnet-funding-transfers.md) uses a second creator-signed transfer to the same custodial treasury. The memo is `sb:deposit:<bountyId>:commission`.
- What happens to a paid commission if the bounty is cancelled, never becomes active, or funding fails is not specified. After the deadline or the participant cap, unused reward-pool principal is [ADR-008](../decisions/ADR-008-unused-reward-pool-retention.md), not a creator refund.

## ANALYTICS

### ANALYTICS-001 Participant count

- Priority: P0
- Status: `implemented`
- Modules: analytics
- Description: Count solving sessions for the bounty. Definition in PRD section 5.8.

Acceptance criteria:

- Wallets that only viewed the challenge are not counted.
- The owner endpoint returns the count.

### ANALYTICS-002 Correct and incorrect submissions

- Priority: P0
- Status: `implemented`
- Modules: analytics
- Description: Return correct-attempt and incorrect-attempt counts.

Acceptance criteria:

- Counts match stored attempts.
- Ineligible correct attempts still count as correct attempts.

### ANALYTICS-003 Overall accuracy

- Priority: P0
- Status: `implemented`
- Modules: analytics
- Description: Correct attempts divided by all attempts.

Acceptance criteria:

- Zero attempts yields a defined empty state, not a divide-by-zero error.
- The ratio uses the PRD definition, not correct solvers over participants. That ratio is completion rate.

### ANALYTICS-004 Completion rate

- Priority: P2
- Status: `not_started`
- Modules: analytics
- Description: Correct solvers divided by participants. Excluded from the MVP by [ADR-009](../decisions/ADR-009-minimal-research-analytics.md). Status stays `not_started`.

Acceptance criteria:

- A solver with two correct attempts counts once.
- Zero participants yields the empty state.

### ANALYTICS-005 Completion time

- Priority: P0
- Status: `implemented`
- Modules: analytics
- Description: Average time from server session start to the first correct attempt, over solvers with a correct attempt. Median completion time is not an MVP requirement ([ADR-009](../decisions/ADR-009-minimal-research-analytics.md)).

Acceptance criteria:

- Client timestamps do not affect the figure.
- Solvers who are never correct are excluded from the average.
- The MVP does not require a median.

### ANALYTICS-006 Attempt summaries

- Priority: P0
- Status: `not_started`
- Modules: analytics
- Description: Attempt count is the number of stored submission attempts ([ADR-009](../decisions/ADR-009-minimal-research-analytics.md)). Average attempts and attempts before success are not MVP requirements.

Acceptance criteria:

- The count matches stored attempts for the bounty.
- Average attempts and attempts before success are not required for the MVP.
- This ID does not require answer-change history.

### ANALYTICS-007 Answer changes

- Priority: P1
- Status: `not_started`
- Modules: analytics
- Description: Excluded from the MVP by [ADR-009](../decisions/ADR-009-minimal-research-analytics.md). A later version may count attempts whose submitted text differs from that solver's previous attempt. Status stays `not_started`.

Acceptance criteria:

- The first attempt is not an answer change.
- Identical resubmits are not answer changes.

### ANALYTICS-008 Strategy summaries

- Priority: P1
- Status: `not_started`
- Modules: analytics
- Description: Excluded from the MVP by [ADR-009](../decisions/ADR-009-minimal-research-analytics.md). A later version may summarize PD-10 strategies. Status stays `not_started`.

Acceptance criteria:

- Solvers who skip the strategy are grouped as unspecified.
- The panel is owner-only.

### ANALYTICS-009 Owner scope

- Priority: P0
- Status: `not_started`
- Modules: analytics
- Description: Analytics endpoints require the bounty owner for that bounty. An administrator may read aggregated analytics for any bounty and for the platform ([ADR-010](../decisions/ADR-010-role-based-analytics-visibility.md)). The check is server-side. Status stays `not_started`.

Acceptance criteria:

- A different creator receives a forbidden or not-found response with no counts that depend on private rows.
- A solver cannot fetch creator analytics.
- Hiding the analytics link does not authorize the request.
- The response has the ADR-009 aggregate figures only. It has no solver wallet address, no submitted answer, and no per-solver research row.
- An administrator can read those aggregates for a bounty they do not own, and a platform aggregate, without receiving individual research records.

### ANALYTICS-010 Present statistics

- Priority: P0
- Status: `not_started`
- Modules: web analytics
- Description: The creator UI shows the ADR-009 figures: participants, correct count, incorrect count, average completion time, and accuracy. Simple cards, numbers, or a basic chart are enough.

Acceptance criteria:

- Labels match section 5.8.
- Empty bounties explain that no sessions have started.
- The view does not require a complex dashboard.

### ANALYTICS-011 Charts

- Priority: P1
- Status: `not_started`
- Modules: web analytics
- Description: Excluded from the MVP by [ADR-009](../decisions/ADR-009-minimal-research-analytics.md). Complex charts are not required. Status stays `not_started`.

Acceptance criteria:

- P0 summaries remain available if charts are not built.
- Charts use the same definitions as the summaries.

### ANALYTICS-012 CSV export

- Priority: P1
- Status: `not_started`
- Modules: analytics
- Description: Excluded from the MVP by [ADR-009](../decisions/ADR-009-minimal-research-analytics.md). A later export, if built, still omits wallet addresses and the expected answer. Status stays `not_started`.

Acceptance criteria:

- Default CSV has no wallet address column.
- Default CSV has no expected answer.
- The file is generated from stored sessions and attempts.

### ANALYTICS-013 Aggregate by default

- Priority: P0
- Status: `not_started`
- Modules: analytics
- Description: Summary endpoints return aggregates.

Acceptance criteria:

- The MVP summary payload has participant, correctness, attempt, and completion-time figures, not a dump of every answer.
- [ADR-010](../decisions/ADR-010-role-based-analytics-visibility.md) denies individual solver research records and solver wallet addresses in analytics for creators and administrators. Research export is not in the MVP.

### ANALYTICS-014 Server-side events only

- Priority: P0
- Status: `not_started`
- Modules: analytics, submissions
- Description: Metrics read database timestamps and results written by the API.

Acceptance criteria:

- No metric uses a client-provided duration.
- Recomputing metrics is deterministic for a fixed set of rows.

### ANALYTICS-015 Private submission review

- Priority: P1
- Status: `not_started`
- Modules: analytics, submissions
- Description: Denied by [ADR-010](../decisions/ADR-010-role-based-analytics-visibility.md). Creators and administrators do not receive a private list of attempts with wallet, answer, result, and times. Status stays `not_started`.

Acceptance criteria:

- Analytics responses for a creator and for an administrator contain no per-solver research row.
- A solver can still read their own participation history.
- Public routes do not return individual research records.

## PRIV

### PRIV-001 No password store

- Priority: P0
- Status: `not_started`
- Modules: auth, users
- Description: The platform stores no email or password.

Acceptance criteria: Same evidence as AUTH-011. This ID is the privacy requirement.

### PRIV-002 No user private keys

- Priority: P0
- Status: `not_started`
- Modules: auth, solana
- Description: User wallet secrets are never stored. The treasury key is a platform secret, not a user secret.

Acceptance criteria:

- The user table has no secret-key column.
- The treasury secret is not stored in PostgreSQL (PAY-014).

### PRIV-003 Data minimization

- Priority: P0
- Status: `not_started`
- Modules: users, submissions
- Description: The schema collects the PRD privacy table and not a general profile.

Acceptance criteria:

- No columns for name, email, phone, government ID, or precise geolocation are required for the MVP.
- IP address is not required for consent.

### PRIV-004 Explicit consent

- Priority: P0
- Status: `implemented`
- Modules: submissions, web solver
- Description: Consent is an explicit accept action stored before the session.

Acceptance criteria: Same behavior as SOLVE-008.

### PRIV-005 Aggregated default reports

- Priority: P0
- Status: `not_started`
- Modules: analytics
- Description: Default creator analytics are aggregates.

Acceptance criteria: Same behavior as ANALYTICS-013.

### PRIV-006 Wallets omitted from exports

- Priority: P1
- Status: `not_started`
- Modules: analytics
- Description: Research export is not in the MVP ([ADR-009](../decisions/ADR-009-minimal-research-analytics.md)). If a later export is built, the default file omits wallet addresses. Status stays `not_started`.

Acceptance criteria: Same behavior as ANALYTICS-012.

### PRIV-007 Collection notice

- Priority: P0
- Status: `not_started`
- Modules: web solver
- Description: The consent step describes the collected fields and the custodial, pseudonymous nature of payments.

Acceptance criteria:

- The notice mentions wallet address, attempts, times, submitted answers, correctness, and public Solana transfers.
- It does not claim anonymity or that thoughts are observed directly.
- It does not say that a strategy survey or a written explanation is collected in the MVP.

### PRIV-008 Pseudonymous copy

- Priority: P0
- Status: `not_started`
- Modules: web
- Description: Product copy says privacy-conscious and pseudonymous.

Acceptance criteria:

- Landing and consent copy avoid "fully anonymous."
- They avoid "trustless escrow."

### PRIV-009 Protect the expected answer at rest

- Priority: P0
- Status: `in_progress`
- Modules: bounties
- Description: **Proposed** PD-02. Encrypt the expected answer with an application key distinct from the treasury key.

Acceptance criteria:

- The database column is ciphertext.
- Decryption happens in the verification path and the owner private view only.

## ADMIN

### ADMIN-001 Allowlisted administrators

- Priority: P1
- Status: `not_started`
- Modules: auth, users
- Description: **Proposed** PD-04. Admin authority comes from server configuration.

Acceptance criteria:

- Changing the client role claim does not grant admin.
- An empty allowlist means there are no admins.

### ADMIN-002 Protect admin operations

- Priority: P1
- Status: `not_started`
- Modules: bounties, rewards
- Description: Operational endpoints require role `admin`.

Acceptance criteria:

- A normal creator receives forbidden.
- Admin access is recorded in the audit log.

### ADMIN-003 Operational monitoring

- Priority: P1
- Status: `not_started`
- Modules: rewards, bounties
- Description: An admin can list bounty funding and payout states across creators. That operational list is not research analytics and does not include solver answer histories ([ADR-010](../decisions/ADR-010-role-based-analytics-visibility.md)).

Acceptance criteria:

- The payload is sufficient to see stuck `submitted` payouts.
- It is not a separate frontend application. A minimal page or documented API is enough.

### ADMIN-004 Moderate a bounty

- Priority: P1
- Status: `not_started`
- Modules: bounties
- Description: An admin can close a bounty with reason `admin`.

Acceptance criteria:

- New sessions stop.
- The close does not by itself send a refund.

### ADMIN-005 No full admin product

- Priority: P0
- Status: `not_started`
- Modules: web
- Description: The MVP does not build a standalone administration dashboard.

Acceptance criteria:

- Navigation for ordinary users has no admin console.
- P1 admin capability stays within allowlisted API operations and, at most, a minimal screen.

### ADMIN-006 Platform analytics

- Priority: P1
- Status: `not_started`
- Modules: analytics
- Description: An administrator can read ADR-009 aggregates for the platform, for one bounty, and grouped by creator ([ADR-010](../decisions/ADR-010-role-based-analytics-visibility.md)). This is not a separate admin product and not an individual research view.

Acceptance criteria:

- The figures are total bounties, participants, correct answers, incorrect answers, average completion time, and accuracy, plus the same bounty and creator groupings.
- The payload has no solver wallet address and no individual research record.
- A creator who is not an administrator receives forbidden for the platform view.
- The check is server-side.

## NFR

### NFR-001 Validate requests

- Priority: P0
- Status: `not_started`
- Modules: api
- Description: Every write body is validated before domain logic.

Acceptance criteria:

- Invalid types and unknown enums return a client error.
- Validation errors do not include secrets or expected answers.

### NFR-002 Backend signature checks

- Priority: P0
- Status: `not_started`
- Modules: auth
- Description: Signature checks happen on the server. Covered with AUTH-004.

Acceptance criteria: AUTH-004 tests pass.

### NFR-003 Authorize private operations

- Priority: P0
- Status: `not_started`
- Modules: api
- Description: Owner and admin checks are server-side.

Acceptance criteria: BOUNTY-006 and ANALYTICS-009 tests pass.

### NFR-004 Answer secrecy

- Priority: P0
- Status: `not_started`
- Modules: api, web
- Description: Expected answers stay off public surfaces.

Acceptance criteria: BOUNTY-004 and MARKET-007 tests pass.

### NFR-005 Protect signing credentials

- Priority: P0
- Status: `not_started`
- Modules: solana
- Description: Treasury and encryption keys stay in server secrets.

Acceptance criteria: PAY-014 and PRIV-009.

### NFR-006 Idempotent money movement

- Priority: P0
- Status: `not_started`
- Modules: rewards, solana
- Description: Deposits and payouts post once per signature.

Acceptance criteria: PAY-009 and PAY-015 tests pass.

### NFR-007 Duplicate protection

- Priority: P0
- Status: `not_started`
- Modules: submissions, rewards
- Description: Duplicate sessions, over-limit attempts, and duplicate rewards are rejected.

Acceptance criteria: SOLVE-002, SOLVE-004, and SOLVE-006 tests pass.

### NFR-008 Rate limiting

- Priority: P0
- Status: `not_started`
- Modules: anti-abuse
- Description: **Proposed** PD-20. Limit nonce issuance and submissions.

Acceptance criteria:

- Proposed starting points: 10 nonce requests per minute per wallet and 30 submissions per minute per wallet.
- Limits are enforced in the API.

### NFR-009 Check chain facts

- Priority: P0
- Status: `not_started`
- Modules: solana
- Description: Deposit and payout confirmation re-reads amount, destination, and source.

Acceptance criteria:

- A confirmed signature with the wrong destination does not post to the bounty ledger.

### NFR-010 Marketplace bound

- Priority: P0
- Status: `not_started`
- Modules: bounties
- Description: The public list is paginated or otherwise capped.

Acceptance criteria:

- A request cannot ask for an unbounded row set. Proposed page size cap: 50.

### NFR-011 Fast deterministic verification

- Priority: P0
- Status: `not_started`
- Modules: verification
- Description: P0 verification is an in-memory compare.

Acceptance criteria:

- No network call is required to decide correctness.

### NFR-012 Bounded analytics

- Priority: P0
- Status: `not_started`
- Modules: analytics
- Description: P0 aggregates are SQL aggregates for one bounty.

Acceptance criteria:

- The summary endpoint does not load every answer into Node solely to count them when the database can aggregate.

### NFR-013 Non-blocking confirmation

- Priority: P0
- Status: `not_started`
- Modules: solana
- Description: **Proposed** PD-16. Reads and answer checks do not wait on cluster confirmation.

Acceptance criteria:

- The submission response may return payout `pending`.
- A status read returns the latest stored payout state without submitting a transfer.

### NFR-014 Persist money events

- Priority: P0
- Status: `not_started`
- Modules: rewards, bounties, audit
- Description: Funding, reservation, payout, and refund transitions are stored.

Acceptance criteria:

- Each transition has a ledger entry and an audit row.
- Audit metadata omits answers and secrets.

### NFR-015 Failed transaction handling

- Priority: P0
- Status: `not_started`
- Modules: rewards
- Description: Failed sends have an explicit status and a safe retry.

Acceptance criteria: PAY-006 tests pass.

### NFR-016 Consistent balances

- Priority: P0
- Status: `not_started`
- Modules: rewards
- Description: The ledger identity is an invariant.

Acceptance criteria:

- Tests assert the identity after each money transition, including a rolled-back failed reservation.

### NFR-017 Audit state changes

- Priority: P0
- Status: `not_started`
- Modules: audit
- Description: Login success is not required. Bounty create, activate, close, reserve, pay, and refund are required.

Acceptance criteria:

- Each of those actions writes an audit row with actor, action, entity, and time.
- Metadata excludes expected answers and secrets.

### NFR-018 Responsive UI

- Priority: P0
- Status: `not_started`
- Modules: web
- Description: Landing, marketplace, solver workspace, and creator dashboard are usable on a narrow viewport and a desktop viewport.

Acceptance criteria:

- Primary actions remain reachable at a 375px-wide layout and at a desktop width.
- No horizontal page scroll on the main flows.

### NFR-019 Clear status copy

- Priority: P0
- Status: `not_started`
- Modules: web
- Description: Reward, attempts remaining, deadline, submission result, and payout status are visible in plain language.

Acceptance criteria:

- Payout labels map 1:1 to payout statuses.
- Custody wording matches PAY-013.

### NFR-020 Server timestamps

- Priority: P0
- Status: `not_started`
- Modules: submissions, analytics
- Description: Start and submit times are server-generated.

Acceptance criteria: SOLVE-002, SOLVE-003, and ANALYTICS-014.
