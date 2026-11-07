# User stories

Stories use the requirement IDs in [REQUIREMENTS.md](REQUIREMENTS.md). None of these flows are implemented. Priority follows the [PRD](PRD.md).

Actor notes:

- A creator is any authenticated wallet that owns the bounty.
- A solver is any authenticated wallet attempting a bounty.
- An administrator is an allowlisted wallet (PD-04, **proposed — pending confirmation**).

## Creator

### US-C-01 Sign in with a wallet

As a creator, I want to sign in with Phantom, so that I can manage bounties without creating a password.

Requirements: AUTH-001, AUTH-002, AUTH-003, AUTH-004, AUTH-005, AUTH-006, AUTH-010, AUTH-011, PRIV-001.

Acceptance criteria:

- Given Phantom is available, when I connect and sign the login message, then I reach the creator dashboard as that wallet.
- Given the signature is invalid or the nonce was already used, when I submit it, then I stay signed out.
- Given I am signed in, when I disconnect, then protected creator calls from that session fail.

### US-C-02 Publish a challenge definition

As a creator, I want to define a cognitive challenge and its reward terms, so that solvers later see a clear task.

Requirements: BOUNTY-001, BOUNTY-002, BOUNTY-003, BOUNTY-008, BOUNTY-009, BOUNTY-010, BOUNTY-011, BOUNTY-012, BOUNTY-013.

Acceptance criteria:

- Given I am signed in, when I submit title, description, category, question, expected answer, verification method, reward, max rewarded solvers, deadline, attempt limit, and instructions, then the bounty is saved and is not yet active.
- Given reward is 0.01 SOL and max rewarded solvers is 100, when the bounty is saved, then the displayed reward pool is 1 SOL and the stored principal is 1_000_000_000 lamports.
- Given that same bounty, the creator also owes a 0.05 SOL commission. That 50_000_000 lamports is not stored as principal.
- Given a required field is missing or the deadline is in the past, when I submit, then the bounty is not created.
- Given the MVP question rule PD-01, when I create a bounty, then it has one question.

### US-C-03 Keep the answer private

As a creator, I want the expected answer visible only to me, so that solvers cannot read it from the marketplace.

Requirements: BOUNTY-004, BOUNTY-005, BOUNTY-006, MARKET-007, PRIV-009.

Acceptance criteria:

- Given I own the bounty, when I open its private detail, then I can see the expected answer.
- Given another signed-in wallet, when they request that private detail, then they do not receive the answer.
- Given a public marketplace response, when it is inspected, then it contains neither the answer nor its ciphertext.

### US-C-04 Fund the pool and go live

As a creator, I want to deposit the principal and see the bounty become active only after the deposit is real, so that solvers are not promised unpaid rewards.

Requirements: BOUNTY-007, BOUNTY-016, PAY-008, PAY-013, PAY-015, PAY-017.

Acceptance criteria:

- Given a created bounty, when I open funding, then I see the treasury address, the required lamports, and a deposit reference.
- Given I transfer enough SOL to that treasury with the deposit memo, when the backend sees the signature at the proposed `confirmed` commitment, then the bounty becomes `active` and `funded` increases once.
- Given the transfer is short, sent elsewhere, or still unconfirmed, when a solver tries to start, then the bounty is not attemptable.
- Given the funding screen, when I read it, then it calls the treasury custodial and does not call it trustless escrow.

### US-C-05 Watch my bounties

As a creator, I want a list of my bounties and their funding state, so that I know what is live.

Requirements: BOUNTY-014, BOUNTY-016, PAY-007.

Acceptance criteria:

- Given I own two bounties, when I open the dashboard, then I see both statuses and I do not see another creator's private bounties.
- Given deposits and payouts have posted, when I view funding, then `funded = reserved + paid + refundable + refunded`.

### US-C-06 See who was paid

As a creator, I want payout statuses for my bounty, so that I can tell which rewards are pending, confirmed, or retrying.

Requirements: PAY-004, PAY-005, PAY-006, PAY-007.

Acceptance criteria:

- Given an eligible correct solver, when the payout is confirmed, then I see the amount and the Devnet signature.
- Given a send failed and is retrying, when I refresh, then I still see one payout for that solver, not two.
- Given I am not the owner, when I request the distribution view, then I do not receive it.

### US-C-07 Read research analytics

As a creator, I want participant count, correct and incorrect counts, accuracy, and average completion time, so that I can see basic problem-solving activity.

Requirements: ANALYTICS-001, ANALYTICS-002, ANALYTICS-003, ANALYTICS-005, ANALYTICS-006, ANALYTICS-009, ANALYTICS-010, ANALYTICS-013, ANALYTICS-014.

Acceptance criteria:

- Given two sessions, one of which becomes correct on the second attempt, when I open analytics, then participants, correct count, incorrect count, accuracy, average completion time, and attempt count match section 5.8.
- Given no sessions, when I open analytics, then I see an empty state rather than an error.
- Given I do not own the bounty, when I request analytics, then I receive no private counts.
- Given the analytics response, when I inspect it, then it has no solver wallet address and no individual answer history.
- Given a solver sends a client clock, when metrics are computed, then only server timestamps are used.
- Given a correct attempt that fails E1, when analytics are shown, then it counts as correct and creates no payout.

### US-C-08 Export aggregated results

As a creator, I might later want a research export. That export is not in the MVP ([ADR-009](../decisions/ADR-009-minimal-research-analytics.md)).

Priority: P1.

Requirements: ANALYTICS-012, PRIV-006.

Acceptance criteria:

- The MVP does not provide research export.
- If a later export is built, the default file has no wallet-address column and no expected answer.
- Given I do not own the bounty, when I request an export, then the download is refused.

### US-C-09 Close the bounty

As a creator, I want to close a bounty, so that new solvers stop joining while unused funds stay accounted for.

Requirements: BOUNTY-015, PAY-010, MARKET-006.

Acceptance criteria:

- Given an active bounty, when I close it, then status is `closed` with reason `creator` and new sessions fail.
- Given a refundable balance, when I close it, then that balance is not sent to me, and ADR-008 retention does not apply to a creator close.

### US-C-10 Unused funds after normal closure

As a creator, I fund a reward pool knowing that a bounty which reaches its deadline or participant cap does not return the unallocated remainder.

Requirements: PAY-011.

Acceptance criteria:

- Given a bounty closed for deadline or full allocation with unallocated principal, when I look for a refund, then no creator refund is sent.
- Given that remainder, when it is recognized as platform revenue, then it is not added to solver `paid`.
- Given I closed the bounty myself, or an admin closed it, or it never became active, when I ask what happens to the balance, then that outcome is not decided.
- Retention is not implemented.

## Solver

### US-S-01 Join without a password

As a solver, I want to authenticate with my wallet, so that I can participate without email or KYC.

Requirements: AUTH-001, AUTH-003, AUTH-007, AUTH-008, AUTH-009, AUTH-011, PRIV-007, PRIV-008.

Acceptance criteria:

- Given a valid signature, when I sign in, then I can open the marketplace.
- Given a reused nonce, when I submit it, then login fails.
- Given the landing and consent copy, when I read them, then they say pseudonymous and privacy-conscious, and they do not say anonymous or trustless escrow.

### US-S-02 Find a challenge

As a solver, I want to browse, search, and filter active challenges, so that I can pick one I can still attempt.

Requirements: MARKET-001, MARKET-002, MARKET-003, MARKET-004, MARKET-007, SOLVE-001.

Acceptance criteria:

- Given active and closed bounties exist, when I open the marketplace, then only joinable bounties appear.
- Given I search and choose a category, when the list loads, then both constraints apply and the answer is not in the payload.
- Given a card, when I read it, then I see the SOL reward, max rewarded solvers, deadline, category, and instructions.

### US-S-03 Consent and start the clock

As a solver, I want the attempt clock to start when I begin, after I agree to research recording, so that completion time is fair and expected.

Requirements: SOLVE-002, SOLVE-008, PRIV-003, PRIV-004, NFR-020.

Acceptance criteria:

- Given I have not accepted consent, when I start, then no solving session is created.
- Given I accept, when the session starts, then `startedAt` is the server time and a second start does not create another session.
- Given the consent step, when I read it, then it lists the ADR-009 metrics that are collected, and it does not say that a strategy survey or written explanation is required. Wallet sign-in is not consent.

### US-S-04 Submit within the attempt limit

As a solver, I want to submit answers and see how many attempts remain, so that I know when to stop.

Requirements: SOLVE-003, SOLVE-004, SOLVE-005, VERIFY-009.

Acceptance criteria:

- Given an open session, when I submit, then I see the attempt number and a correct or incorrect result.
- Given I have used the attempt limit, when I submit again, then the API stores nothing and creates no payout.
- Given I send `isCorrect: true` with a wrong answer, when the attempt is stored, then the result is incorrect.

### US-S-05 Get a deterministic decision

As a solver, I want the server to grade objective answers, so that spacing or case is handled only when the creator chose that rule.

Requirements: VERIFY-002, VERIFY-003, VERIFY-004, VERIFY-005, VERIFY-006, VERIFY-008.

Acceptance criteria:

- Given method `exact` and answer `42`, when I submit ` 42 `, then the result is incorrect.
- Given method `normalized_text` or `numeric_exact` and answer `42`, when I submit ` 42 `, then the result is correct.
- Given method `numeric_exact` and answer `42`, when I submit `42.0`, then the result is incorrect.
- Given any result, when I read the response, then it does not include the expected answer.

### US-S-06 Receive one micro-reward

As a solver, I want the configured SOL reward when my answer is the first eligible correct answer for my wallet, so that payment matches the bounty terms.

Requirements: SOLVE-006, SOLVE-007, PAY-001, PAY-002, PAY-005, PAY-012, PAY-016.

Acceptance criteria:

- Given E1 passes, when the submission returns, then I see a payout in `pending` and later a signature when it is `confirmed`.
- Given I was already allocated, when I try to submit again, then I do not receive a second payout.
- Given the pool is already at max rewarded solvers, when my new answer is correct, then the attempt is stored as correct and ineligible and no payout is created.
- Given a confirmed reward of 0.01 SOL, when it settles, then the principal accounting moves 0.01 SOL from reserved to paid.

### US-S-07 Review my history

As a solver, I want my attempts and rewards in one place, so that I can verify what I earned.

Requirements: USER-004, SOLVE-009.

Acceptance criteria:

- Given I attempted two bounties, when I open history, then I see only my sessions, results, and payout statuses.
- Given a confirmed payout, when I view it, then the Devnet signature is shown.

### US-S-08 Describe how I solved it

As a solver, a later version may let me report a strategy and a short explanation. Those fields are not in the MVP ([ADR-009](../decisions/ADR-009-minimal-research-analytics.md)).

Priority: P1.

Requirements: SOLVE-010, SOLVE-011, ANALYTICS-008.

Acceptance criteria:

- The MVP does not ask for a strategy or an explanation.
- Grading and E1 do not depend on either field.
- If a later version stores an explanation, another solver cannot read it from the public bounty.

## Administrator

### US-A-01 Act as an allowlisted wallet

As an administrator, I want admin authority to come from server configuration, so that users cannot grant it to themselves.

Priority: P1.

Requirements: USER-003, ADMIN-001, ADMIN-005.

Acceptance criteria:

- Given my wallet is on the server allowlist, when I sign in, then my role is `admin`.
- Given my wallet is not listed, when I change a client-side role claim, then admin calls still fail.
- Given I am a normal user, when I use the main navigation, then there is no admin console.

### US-A-02 Inspect stuck payouts

As an administrator, I want to see bounty funding and payout states, so that I can spot a transfer stuck in `submitted`.

Priority: P1.

Requirements: ADMIN-002, ADMIN-003.

Acceptance criteria:

- Given I am an admin, when I request the operational list, then I can see payout status across creators.
- Given I am only a creator, when I request that list, then I receive forbidden and an audit row records the admin calls I am allowed to make when I succeed.

### US-A-03 Take down a bounty

As an administrator, I want to close a bounty that should not stay active, so that new sessions stop. An admin close is not the ADR-008 retention case.

Priority: P1.

Requirements: ADMIN-004, MARKET-006.

Acceptance criteria:

- Given an active bounty, when I close it as admin, then the close reason is `admin` and new sessions fail.
- Given I am not an administrator, when I request that close, then the API refuses it. Hiding the control is not the check.
- Given a refundable balance, when I close it, then no refund transfer is sent by that action, and the balance is not retained under ADR-008 by that action.

### US-A-04 Read platform analytics

As an administrator, I want aggregated ADR-009 figures for the platform, for a bounty, and by creator, so that I can see participation without identifying a solver.

Priority: P1.

Requirements: ADMIN-002, ADMIN-006, ANALYTICS-009, ANALYTICS-013.

Acceptance criteria:

- Given I am an administrator, when I open platform analytics, then I see total bounties, participants, correct answers, incorrect answers, average completion time, and accuracy.
- Given the same response, when I inspect it, then it has no solver wallet address and no individual research record.
- Given I am only a creator, when I request platform analytics, then I receive forbidden.
- Given I moderate an account or a bounty, when I use those operational tools, then they do not return solver answer histories.

## Demo acceptance

The hackathon demo is accepted when the P0 creator stories US-C-01 through US-C-07 and US-C-09, and the P0 solver stories US-S-01 through US-S-07, have been exercised on Devnet with at least two solver wallets, one correct eligible payout, one incorrect attempt, and the P0 analytics visible. That demonstration has not been run.
