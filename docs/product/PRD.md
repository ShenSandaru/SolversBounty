# SolversBounty Product Requirements

| | |
| --- | --- |
| Product | SolversBounty |
| Category | Cognitive micro-task marketplace and human reasoning analytics platform |
| Version | 1.0 hackathon MVP |
| Chain | Solana Devnet |
| Duration | 40 hours elapsed team time |
| Status | Documentation only. No feature is implemented. |

Related: [requirements](REQUIREMENTS.md), [user stories](USER_STORIES.md), [implementation plan](../development/IMPLEMENTATION_PLAN.md), [system architecture](../architecture/SYSTEM_ARCHITECTURE.md), [ADR-002](../decisions/ADR-002-custodial-devnet-treasury.md).

Confirmed decisions use `CD-*`. Proposed decisions use `PD-*` and the label **proposed — pending confirmation**. The register is in the [implementation plan](../development/IMPLEMENTATION_PLAN.md).

## 1. Product overview

### 1.1 Vision

SolversBounty connects organizations, researchers, and creators with people who solve intellectual challenges. Creators publish predefined challenges and fund reward pools. Solvers answer those challenges and receive micro-payments for eligible correct solutions. With consent, creators also receive structured data about how people attempted the work.

Solana Devnet is the payment rail for deposits and rewards. The MVP holds those funds in a backend-managed custodial treasury (CD-11). The product is wallet-authenticated. It is not a trustless escrow protocol.

### 1.2 Value proposition

**Human intelligence marketplace.** An organization can distribute small cognitive tasks and pay a fixed reward for each eligible correct solver.

**Human reasoning analytics.** A creator can see completion time, accuracy, attempts, and, when the P1 items exist, answer changes and self-reported strategies.

### 1.3 Tagline

Solve Problems. Earn Rewards. Unlock Human Insights.

### 1.4 What the platform measures

The platform records observable activity and self-reported reasoning. It does not claim to observe private thoughts (CD-15).

## 2. Problem statement

### 2.1 Researchers and organizations

- Human problem-solving data is expensive and slow to collect.
- Recruiting people for small cognitive tasks is hard.
- Ordinary payment rails make tiny rewards uneconomical.
- Many survey tools store final answers and miss the solving process.
- Researchers need comparable data for the same challenge across participants.

### 2.2 Participants

- Few places pay people for short reasoning tasks.
- Traditional platforms often require a long registration.
- Simple cognitive tasks should not require a personal profile.
- Payment status should be visible and tied to a chain transaction.

### 2.3 Product response

- Creators publish and fund cognitive challenges.
- Participants authenticate with a Solana wallet.
- A shared marketplace lists challenges.
- The backend evaluates answers when the validation rule is objective.
- Eligible correct solvers receive micro-rewards.
- Creators receive research analytics for their own bounties.

## 3. Users and stakeholders

### 3.1 Creators

University researchers, AI and machine-learning researchers, companies, independent developers, educational institutions, and content creators.

They need to publish challenges, recruit solvers, collect responses, see solving patterns, distribute rewards, and export research results.

Any authenticated wallet may create a bounty. There is no separate creator application (CD-06).

### 3.2 Solvers

Students, developers, puzzle enthusiasts, researchers, and other internet users.

They need to discover challenges, participate without email or password, solve them, earn rewards, and review earnings and history.

### 3.3 Administrator

The administrator handles platform configuration, challenge moderation, suspicious activity, bounty and payout monitoring, and operational issues.

For the hackathon, administration is an allowlisted wallet and protected API operations (PD-04). A separate admin product is out of scope. See reconciliation C5.

## 4. Confirmed product decisions

| ID | Decision |
| --- | --- |
| CD-01 | pnpm workspaces and Turborepo. Intended apps are `apps/web`, `apps/api`, and `packages/shared`. |
| CD-02 | Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Zustand, TanStack Query, React Hook Form, Zod. |
| CD-03 | NestJS modular monolith. [ADR-001](../decisions/ADR-001-modular-monolith.md). |
| CD-04 | PostgreSQL and Prisma. Local Postgres for development, Neon for the shared hackathon database (PD-12 names the hosting split). |
| CD-05 | Solana Devnet and `@solana/web3.js`. No custom program in the MVP. |
| CD-06 | Sign-In with Solana using wallet signatures. Phantom is the required wallet. No email, password, or KYC. |
| CD-07 | Identity is pseudonymous. The product is privacy-conscious and does not promise anonymity. |
| CD-08 | Only the backend decides correctness, timestamps, eligibility, and payouts. |
| CD-09 | Public APIs never return the expected answer. |
| CD-10 | One reward per wallet per bounty. Equal amount for every eligible correct solver, capped by funds and max rewarded solvers. |
| CD-11 | Custodial Devnet treasury. [ADR-002](../decisions/ADR-002-custodial-devnet-treasury.md). |
| CD-12 | Platform fee is 0% in the MVP. |
| CD-13 | HTTP API is documented with Swagger / OpenAPI. |
| CD-14 | Priority split in section 11 is binding for the hackathon. |
| CD-15 | Analytics describe observed activity and self-report only. |

## 5. Feature requirements

Acceptance detail and IDs: [REQUIREMENTS.md](REQUIREMENTS.md). Stories: [USER_STORIES.md](USER_STORIES.md).

### 5.1 Wallet authentication

Users sign in with a Solana wallet.

- Connect Phantom.
- Issue a unique authentication nonce.
- Sign an authentication message. The message is not a transaction approval.
- Verify the signature on the backend.
- Create or load the user for that wallet.
- Issue a session.
- Allow disconnect.
- Reject invalid signatures.
- Reject reused nonces.
- Keep private keys inside the wallet.
- Do not ask for email or password.

Session shape is [ADR-003](../decisions/ADR-003-postgresql-server-side-sessions.md): a PostgreSQL `AuthSession`, a hash of the session token, and the raw token only in an HttpOnly cookie. Exact lifetime, cookie deployment domain, and the CSRF mechanism are not set. This does not implement login.

Wallet authentication does not prove that one human controls only one wallet.

### 5.2 Creator dashboard

An authenticated creator can:

- See the connected wallet.
- Create a bounty.
- List only their bounties and each bounty status.
- See funding, participant count, and reward distribution.
- Open research analytics.
- Export research data when the P1 export exists.

A creator cannot read another creator's private configuration or expected answer.

### 5.3 Bounty creation

Required fields:

| Field | Requirement |
| --- | --- |
| Title | Challenge name |
| Description | What the challenge is about |
| Category | `logic`, `mathematics`, `numerical_patterns`, or `ciphers` |
| Question | The challenge prompt |
| Expected answer | Protected answer |
| Verification method | One of the P0 methods in section 5.6 |
| Reward per solver | SOL amount paid to each eligible solver |
| Max rewarded solvers | Maximum wallets that can be paid |
| Deadline | Server-enforced close time |
| Attempt limit | Maximum stored attempts for that wallet |
| Instructions | Extra solver guidance |
| Reward asset | SOL on Devnet |

Budget is `rewardPerSolver * maxRewardedSolvers`, computed in lamports. Example: 0.01 SOL times 100 solvers is a 1 SOL principal.

The bounty becomes `active` only after the backend verifies a sufficient deposit. The creator can read their own expected answer. Public responses cannot.

PD-01 (**proposed — pending confirmation**): one question per bounty, stored on `BountyQuestion`.

### 5.4 Challenge marketplace

Solvers can browse active bounties, search, filter by category, and see reward, max rewarded solvers, deadline, instructions, and status.

Only an `active` bounty that is still before the deadline and under the allocation cap can start a new solving session. `closed` bounties cannot. The UI labels close reasons as Closed (creator or admin), Expired (deadline), or Fully allocated.

Public challenge payloads omit the expected answer.

### 5.5 Solver workspace

A solver can connect, read the challenge, accept research consent, start a solving session, submit answers, see attempt usage, see submission status, and see whether a reward was reserved.

The server sets the session start time. Attempt limits are enforced by the API. The same wallet cannot be paid twice for one bounty.

P1, if time allows:

- Optional written explanation (PD-10).
- Self-reported strategy from a fixed list (PD-10).

Initial categories are logic puzzles, mathematical reasoning, numerical patterns, and ciphers. Code-documentation hunts and AI reasoning benchmarks are future work.

### 5.6 Answer verification

The backend compares the submission with the expected answer.

P0 methods (PD-11, **proposed — pending confirmation** as the complete P0 set):

- Exact string match.
- Case-insensitive match.
- Normalized text match: trim ends and collapse internal whitespace.
- Exact numeric match after trimming. `42` and ` 42 ` match. `42.0` does not match `42` in the MVP.

Example: expected answer `42` accepts `42` and ` 42 ` under normalized or numeric rules, as configured by the creator.

Verification results are stored on the attempt. The browser cannot learn the expected answer from success or failure beyond the correct/incorrect result for that submission.

### 5.7 Reward distribution

Eligible correct solvers receive the configured reward. There is no ranking and no winner-take-all mode.

Example:

| Parameter | Value |
| --- | ---: |
| Principal | 1 SOL |
| Reward per solver | 0.01 SOL |
| Max rewarded solvers | 100 |
| Correct eligible solvers | 70 |
| Paid | 0.70 SOL |
| Refundable | 0.30 SOL |

Rules:

- Only E1 allocations are paid. E1 is defined in the [README](../../README.md) and repeated in [blockchain design](../architecture/BLOCKCHAIN_DESIGN.md).
- At most one reward per solver per bounty.
- Payouts cannot exceed confirmed principal.
- Each payout and its signature are stored.
- Confirmed chain status updates the ledger.
- A failed send is retried on the same payout record.
- Creators can see distribution status.
- Unallocated principal stays on the bounty until close. The refund transfer is P1 (reconciliation C3, PD-08).

PD-05 (**proposed — pending confirmation**): pay immediately after the first eligible correct attempt, not in a creator-triggered batch.

PD-07 (**proposed — pending confirmation**): network fees are paid from a treasury fee buffer, not from principal.

### 5.8 Research analytics

P0 summaries, calculated from server-side sessions and attempts:

| Metric | Definition |
| --- | --- |
| Participants | Solving sessions started |
| Correct solvers | Participants with at least one correct attempt |
| Correct attempts | Attempts stored as correct |
| Incorrect attempts | Attempts stored as incorrect |
| Overall accuracy | Correct attempts / all attempts |
| Completion rate | Correct solvers / participants |
| Average completion time | Mean, over correct solvers, of first-correct time minus session start |
| Median completion time | Median of that same duration |
| Average attempts | All attempts / participants |
| Average attempts before success | Mean attempt number of the first correct attempt, over correct solvers |

P1:

- Answer-change count: attempts whose text differs from the previous attempt by that solver.
- Strategy frequency and strategy compared with correctness and completion time.
- Optional explanation text in the creator's private view.
- CSV export of aggregated research data.
- Richer charts. P0 still needs readable summary statistics.

Creators can read analytics only for bounties they own. Default reports aggregate participants. PD-14 (**proposed — pending confirmation**): the private creator dashboard may show wallet-linked rows; exports and every public view omit wallet addresses.

## 6. Workflows

### 6.1 Creator

1. Open SolversBounty.
2. Connect Phantom.
3. Sign the authentication message.
4. Open the creator dashboard.
5. Create a challenge and set the answer and verification method.
6. Set the reward and max rewarded solvers.
7. Fund the treasury deposit the API specifies.
8. Wait until the backend confirms the deposit and marks the bounty active.
9. Watch participation, payouts, and analytics.
10. Export results when CSV export exists.
11. Close the bounty. Refund of the refundable balance is P1.

### 6.2 Solver

1. Open SolversBounty.
2. Connect Phantom and sign in.
3. Browse active challenges.
4. Read instructions.
5. Accept research consent.
6. Start a solving session.
7. Submit an answer.
8. Optionally add a strategy and explanation when those P1 fields exist.
9. See correct or incorrect, and see eligibility.
10. If eligible, see payout status and, once confirmed, the transaction signature.
11. Review participation and reward history.

### 6.3 System

1. Validate the bounty.
2. Verify funding against Devnet.
3. Publish by marking the bounty active.
4. Record consent and the solving session with server time.
5. Validate the submission and eligibility preconditions.
6. Verify the answer.
7. If E1 passes, reserve the reward and create a pending payout.
8. Submit the transfer after the database transaction commits.
9. Confirm the signature and mark the payout paid.
10. Recompute analytics from stored events.

## 7. Data collection and privacy

Collected for the MVP:

| Data | Purpose |
| --- | --- |
| Wallet address | Authentication and payment |
| Bounty ID | Tie activity to a challenge |
| Session start | Completion time |
| Submission time | Response time |
| Submitted answer | Verification and creator research |
| Attempt count | Behavior |
| Answer changes | Revision behavior (P1 metric) |
| Self-reported strategy | Reported approach (P1) |
| Optional explanation | Qualitative note (P1) |
| Transaction signature | Payment evidence |
| Consent acceptance | Lawful research recording for the demo |

Privacy rules:

- No email, password, or KYC.
- No private keys stored or requested by the platform.
- No extra personal profile.
- Explicit consent before a solving session (PD-09).
- Default research views are aggregated.
- Wallet addresses are omitted from public research exports (PD-14 covers the private dashboard exception).
- The consent step states what is collected and why.
- Copy says privacy-conscious, not anonymous.

PD-02 (**proposed — pending confirmation**): encrypt the expected answer at rest. PD-19: store submitted answers for the owning creator's private research view, and omit them from public APIs.

## 8. Blockchain product requirements

- Network: Solana Devnet.
- Wallet connection and signature login.
- Creator deposits to the custodial treasury.
- Backend verification of deposit amount, destination, and bounty reference.
- Solver payouts from that treasury.
- Confirmation before a payout counts as paid.
- Stored transaction history.
- Controlled refund of refundable principal when the P1 refund action exists.
- No custom program (CD-05).

The backend keeps internal allocations and reconciles them to confirmed transactions. Signing keys stay off the frontend.

## 9. Non-functional requirements

### Security

Validate API input. Verify signatures on the server. Protect creator-only and admin-only actions. Hide expected answers. Protect signing keys. Use idempotent payouts. Block duplicate reward claims. Rate-limit auth and submissions. Check transaction signatures, destinations, and amounts.

### Performance

The marketplace should page or otherwise bound its list. P0 verification is a string or numeric compare. P0 analytics aggregate one bounty's rows. Chain confirmation must not hold ordinary read requests open.

### Reliability

Persist every funding and payout attempt. Recover failed transactions without double payment. Keep the ledger identity true. Audit important state changes.

### Usability

Responsive layout. A short wallet connection. Visible instructions, reward, attempt limit, deadline, submission result, and payout status. Analytics labels match the metric definitions in section 5.8.

## 10. MVP demonstration

The live demo tells one story:

A researcher creates a cognitive challenge, funds a reward pool, and publishes it. At least two other wallets connect and attempt it. The system stores attempts and solving time. A correct eligible participant receives Devnet SOL. The researcher sees participation and accuracy statistics, plus completion time and attempt summaries.

Success targets, which are demo goals rather than production SLAs:

| Metric | Demo target |
| --- | --- |
| Creator authentication | One successful wallet login |
| Bounty creation | One funded active challenge |
| Solver participation | Two independent solver wallets |
| Verification | One correct and one incorrect outcome |
| Reward distribution | One confirmed on-chain payout |
| Duplicate protection | The paid wallet is not paid again |
| Analytics | Participation and accuracy visible |
| Research insights | Completion time and attempt summaries visible |
| End-to-end | The story above, on Devnet |

## 11. Priority

If time runs out, keep the critical path and cut from the top of the P1 list downward. The path is authentication, bounty creation, funding, marketplace, submission, verification, payout, and P0 analytics.

### P0

- Wallet authentication and user upsert.
- Creator dashboard: create, list own bounties, private detail, funding state.
- Bounty validation, protected answer, budget in lamports.
- Deposit verification and activation.
- Marketplace browse, search, and category filter.
- Consent, solving session, submission, server attempt limits.
- Backend verification methods in section 5.6.
- E1 eligibility and duplicate-reward protection.
- Devnet payout, confirmation, and safe retry.
- Ledger identity and creator distribution status.
- P0 analytics in section 5.8.
- Rate limits, audit records, and answer secrecy.

### P1

- Self-reported strategies and written explanations.
- Answer-change metric and richer attempt charts.
- CSV export without wallet addresses.
- Creator refund transfer.
- Richer analytics visuals.
- Minimal admin read and close operations.
- Playwright coverage of the demo path if API payment tests already exist.

### P2

- AI reasoning benchmarks and code-documentation hunts.
- Experiment design tools and AI qualitative analysis.
- Reputation and stronger Sybil resistance.
- Non-custodial escrow program.
- USDC and other assets.
- More verification plugins.
- Public research APIs.
- Creator subscriptions and a platform fee.
- Production-grade custody.

## 12. Out of scope

Unless the critical path is done and the user expands scope:

- Custom Solana programs.
- AI answer grading and fuzzy matching.
- Identity proof beyond a wallet signature.
- Email and password.
- KYC.
- Native mobile apps.
- Multi-chain support.
- Advanced bot defense.
- Microservices.
- Production custody, insurance, or mainnet funds.
- A notifications product. In-app status comes from bounty, submission, and payout records (reconciliation C4).
- A standalone administrator dashboard (reconciliation C5).

## 13. Risks

| Risk | Mitigation |
| --- | --- |
| Wrong verification | Deterministic methods only |
| Double pay | Unique allocation, one payout row, idempotent send |
| Underfunded bounty | Full principal must confirm before `active` |
| Failed transactions | Persist state and retry the same payout |
| Many wallets | Rate limits, attempt limits, unique rewards. This is not Sybil proof |
| Answer leakage | Server-only expected answer, encrypted at rest under PD-02 |
| Privacy confusion | Consent copy and pseudonymous wording |
| Bad analytics | Server timestamps and the section 5.8 definitions |
| Schedule | Protect the critical path over P1 polish |
| Custodial loss | Devnet only, small balances, key off the client |

## 14. Future business

Not MVP scope (CD-12 keeps the fee at 0%):

1. A fee on funded principal.
2. Paid advanced research reports.
3. Enterprise campaigns and higher caps.
4. An external API for creating challenges.
5. Additional statistical tools.

## 15. Reconciliations

These resolutions keep the original requirements and remove contradictions. They are not silent scope cuts.

### C1. Decentralized wording and custodial funds

The vision asks for Solana payments. The approved MVP holds funds in a custodial treasury. Public and internal language is: wallet-authenticated Solana payments with a custodial Devnet treasury. Trustless escrow is a P2 alternative, not the current design.

### C2. Attempt data is both a success metric and a P1 item

Basic attempt counts, failed attempts, and completion time are P0 because the demo success metrics require them. Answer-change detail, strategy breakdowns, and richer charts stay P1.

### C3. Refunds

The creator journey includes recovering unused funds. P0 maintains `refundable` and stops new sessions on close, deadline, or full allocation. The transfer back to the creator is P1. There is no automatic refund worker in the MVP.

### C4. Notifications module

The original module list named notifications. No MVP story requires email, push, or an inbox. That module is not part of the P0 monolith. Status is queried from product records.

### C5. Administrator dashboard

The stakeholder description remains valid. The hackathon UI does not include a full admin application. PD-04 uses an allowlisted wallet on the same API. Richer admin screens are P1 and still not a separate product.

## 16. Implementation status

Every requirement in [REQUIREMENTS.md](REQUIREMENTS.md) is `not_started`. This PRD does not describe a running system.
