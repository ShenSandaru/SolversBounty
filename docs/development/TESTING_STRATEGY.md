# Testing strategy

Status: the strategy is accepted as the plan for later milestones. Vitest and Jest are installed. API infrastructure tests cover configuration, database lifecycle, health, validation, errors, and module startup. They do not use a database. The product test names below are specifications, not results. Auth and bounty PostgreSQL specs stay gated and are not part of the default command. The payout concurrency spec runs against the disposable local database when `PAYOUT_INTEGRATION_DATABASE_URL` is set.

Related: [requirements](../product/REQUIREMENTS.md), [coding standards](CODING_STANDARDS.md), [blockchain design](../architecture/BLOCKCHAIN_DESIGN.md).

Payout concurrency tests live in `apps/api/src/modules/rewards/payout.postgres.spec.ts`. They start only when `PAYOUT_INTEGRATION_DATABASE_URL` names the disposable database from `apps/api/docker-compose.payout-test.yml`: host `127.0.0.1`, port `55432`, database `sbpayout`. The spec rejects a Neon host, any other host, and any other database name. Apply the existing Prisma migrations to that container only. The Solana gateway in that spec is mocked. Do not point the variable at Neon.

## Tools

| Layer | Tool | When it runs |
| --- | --- | --- |
| Web unit and component | Vitest | Default `web` test script, once the app exists |
| API unit | Jest | Default `api` test script |
| API integration | Jest plus a Prisma test database | Same API test command. Auth and bounty specs stay gated by their own URLs. Payout concurrency uses `PAYOUT_INTEGRATION_DATABASE_URL` and refuses Neon |
| Chain | Fake `SolanaGateway` in default tests | Always in CI |
| Devnet | Opt-in test or the manual demo | Only when `SOLANA_INTEGRATION=1` and the operator expects to spend Devnet SOL |
| Browser demo path | Playwright | P1, and only after the API payment tests exist |

Do not require an airdrop for the default test command.

## Layers

### Unit

Cover pure rules with no database and no RPC:

- Each verification method in VERIFY-002 through VERIFY-005, including `42.0` versus `42`.
- Lamport multiplication for BOUNTY-003, including a value that would lose precision in a float.
- Ledger identity after a sequence of deposit, reserve, settle, release, and refund entries.
- E1 decision table: each failing precondition and the one passing case.
- Payout state machine: which states may sign.

### API integration

Use Postgres. Truncate product tables between tests. Seed through factories, not through production UI.

Cover at least:

- AUTH-004, AUTH-008, and AUTH-009 with a real ed25519 keypair generated in the test.
- BOUNTY-004 and MARKET-007 by snapshotting public JSON and failing if ciphertext or the answer appears.
- BOUNTY-006 with two creators.
- SOLVE-002, SOLVE-004, and VERIFY-009.
- ANALYTICS-003, ANALYTICS-005, and ANALYTICS-009 using fixed server timestamps.
- PAY-008 with the fake gateway accepting or rejecting a deposit.

### Payment safety

These are P0 API tests. They use the fake gateway, which records `send` calls and lets the test decide whether a signature confirms.

| Case | Requirement | Expected result |
| --- | --- | --- |
| Wrong answer | PAY-001 | No allocation and no send |
| Two correct submits, one wallet | PAY-002, SOLVE-006 | One allocation and one send |
| Two wallets take the last slot together | PAY-003 | One allocation, the other attempt stored as `pool_exhausted` |
| Refundable balance below the reward | PAY-001 | Attempt stored as `insufficient_refundable`, no send |
| Repeat worker tick while `submitted` | PAY-006, PAY-009 | Still one send |
| Signature then reported failed | PAY-006 | Same payout id, one additional send, both signatures retained |
| Confirmed payout tick | PAY-005, PAY-015 | One settle. A second confirm is a no-op |
| Deposit signature reused | PAY-015 | One `deposit` ledger entry |
| Deposit to the wrong address | NFR-009 | Bounty stays inactive |
| Public DTO | NFR-004 | No expected answer |

### Critical demo path

Manual until Playwright is justified. Record the run in [PROGRESS.md](PROGRESS.md). Do not record it before it happens.

1. Creator wallet signs in.
2. Creator saves a numeric bounty whose answer is `42`, reward 0.01 SOL, max rewarded solvers 2.
3. Creator deposits principal on Devnet. Bounty becomes active only after confirmation.
4. Solver A signs in, consents, submits a wrong answer, then submits `42`, and receives one confirmed payout.
5. Solver A cannot be paid again.
6. Solver B submits a wrong answer and is not paid.
7. Creator sees participants, accuracy, completion time, and attempt summaries that match the PRD definitions.

The product example of 100 solvers remains the requirements example. The demo may use a cap of 2 so the faucet stays small.

## Fakes and fixtures

`SolanaGateway` in tests implements:

- `getTreasuryAddress()`
- `verifyLoginSignature(message, signature, wallet)`
- `observeTransfer(signature)`
- `sendTransfer(idempotencyKey, destination, lamports, memo)`
- `getTransaction(signature)`

The fake stores sends by idempotency key. A second `sendTransfer` with the same key and an unresolved signature throws. Tests that need a new signature after failure must mark the previous one failed first, matching PAY-006.

Factories:

- `userFactory` with a generated keypair.
- `bountyFactory` that inserts ciphertext through the same encryption helper the app will use, once PD-02 is implemented. Until that helper exists, do not invent a parallel plaintext column in tests.
- Answers in fixtures may be `42`. Do not use a real treasury secret. The test treasury is an in-memory keypair.

## Data conventions

- Database tests use a dedicated database. They do not run against the Neon hackathon database.
- Time is injected. Analytics tests do not call `Date.now()` inside assertions.
- Wallet addresses in tests are valid base58 public keys from the generated keypairs.
- Cleanup deletes rows. Do not depend on test order.

## What not to test on Devnet

- Duplicate-reward races. Those belong on the fake gateway and Postgres.
- Answer secrecy. That is a DTO test.
- Every verification string. That is a unit test.

Devnet is for one deposit and one payout in the demo, plus an opt-in smoke test if the team wants a repeatable check of memo parsing against a cluster.

## Exit bar by milestone

| Milestone | Bar |
| --- | --- |
| M2 | Auth unit and API tests for invalid signature and nonce reuse |
| M6 | Verification unit tests and attempt-limit API test |
| M7 | The full payment-safety table |
| M8 | Analytics definition tests |
| M10 | The manual demo path recorded in progress |

A requirement moves to `implemented` only when its acceptance criteria and the tests named for it are actually passing.
