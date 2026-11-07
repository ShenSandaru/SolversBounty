# Security review

Status: Phase 5 review of the repository as of 2026-11-07. No product workflow was added. No `PD-*` item was accepted. Requirement statuses stay `not_started`.

Related: [threat model](THREAT_MODEL.md), [checklist](SECURITY_CHECKLIST.md), [requirements](../product/REQUIREMENTS.md).

Findings use three kinds:

| Kind | Meaning |
| --- | --- |
| Verified | Observed in the current code or schema |
| Future risk | The dangerous behavior is specified and not built. The gap matters when that milestone is implemented |
| Accepted architecture | Chosen in an ADR. Not a defect to patch inside the MVP |

Nothing below is a live exploit against a bounty, a wallet, or a payout. Those routes do not exist.

## Verified controls

These are in the tree and were checked against the running design, not only the docs.

- `GET /health` returns `{ status, service }` and does not claim the database, auth, or chain is healthy.
- `GET /health/ready` returns `not_configured` or `up` with 200, and `down` with 503. A failed connection is logged without the URL. Phase 4 recorded a 503 body of `{ "status": "not_ready", "checks": { "database": "down" } }`.
- Unexpected exceptions become `INTERNAL` / `Internal server error` with no stack. Validation issue objects keep `path` and `message`.
- Request logs contain the request id, method, path without the query string, and status. They do not contain bodies.
- CORS is an origin list. The default is `http://localhost:3000`.
- JSON parsing is capped, default `64kb`.
- Response headers set `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `X-Frame-Options: DENY`.
- Lamport columns are `BigInt`. The response interceptor stringifies `bigint`. Shared helpers use `bigint`.
- `publicBountySchema` is strict and has no expected-answer field. Marketplace fixtures are typed as public bounties. The preview receipt says the expected answer was not sent.
- The Prisma schema has no password, email, treasury key, or user secret column. Consent has no IP column. Wallet addresses are unique. One solving session, one consent, one allocation, and one payout row are unique as specified. Deletes are `Restrict`. There is no balance cache.
- Domain modules do not import each other. `verification` and `solana` have no domain imports.
- `.env` is gitignored. Env examples leave secret fields empty. `apps/api/src/generated/` is gitignored.

## Findings

### SEC-C1 Custodial treasury is a hot wallet

- Severity: Critical
- Kind: Accepted architecture
- Component: ADR-002, future `solana` signer
- Blocks MVP: No on Devnet. Yes for any mainnet or real-value use

Description: One API-held key receives every bounty principal and later signs every payout. The chain does not enforce the per-bounty split.

Impact: Host compromise, a logged key, or a committed key empties the wallet, including `refundable` principal that P0 does not return to creators.

Attack scenario: The operator's shell history, a crash dump, or a debug log of the config object captures `TREASURY_SECRET_KEY`. The attacker submits system transfers to their own address.

Mitigation: Keep the key only in API secret storage, out of git, Postgres, the browser, and logs. Keep the Devnet balance small. Do not point this design at mainnet without a new ADR. Before the first send exists, the signer must live in the `solana` module and must not be returned from a health or debug route.

### SEC-H1 Two solvers can take the last slot

- Severity: High
- Kind: Future risk
- Component: `rewards`, `bounties`, E1
- Blocks MVP: Blocks calling payout and submission done. Does not block starting that work

Description: `@@unique([bountyId, solverId])` stops a second reward for the same wallet. It does not stop two different wallets both observing "one slot left".

Impact: `reserved + paid` can exceed `maxRewardedSolvers * rewardLamports`, and can exceed `funded` if the refundable check is also racy.

Attack scenario: Two correct submits run at the same time. Each counts allocations, each sees a free slot, each inserts.

Mitigation: One interactive transaction locks the bounty row, computes refundable from ledger rows, counts allocations, and inserts the attempt, allocation, `reserve` entry, and `pending` payout together. The unique key remains the backstop for the same wallet. Tests must run two concurrent winners and one loser. Do not add a balance cache to make the read look cheaper.

### SEC-H2 A lost send response can pay twice

- Severity: High
- Kind: Future risk
- Component: `rewards`, `solana`, `Payout`, `ChainTransaction`
- Blocks MVP: Blocks calling PAY-006 and PAY-009 done

Description: The design says to store the signature and move to `submitted` before treating the send as finished, and not to sign when status is `submitted` or `confirmed`. The hole is the crash after the cluster accepts the transfer and before that row update.

Impact: The retry signs a second transfer for the same allocation. The ledger can still post `settle` only once per signature, so the books show one payment while the wallet lost two.

Attack scenario: The worker calls `send`, the RPC times out, the process dies, and the next tick sees `pending` with no signature.

Mitigation: Before every signature, look up recent treasury transactions for memo `sb:payout:<payoutId>`. If one exists, store that signature and poll it. Sign only when that lookup is empty and status is `pending` or `retryable`. Keep every failed signature on `ChainTransaction`. The same rule applies to deposits and to the P1 refund memo.

### SEC-H3 Chain fields must be read again before a posting

- Severity: High
- Kind: Future risk
- Component: confirmation worker, `BountyFunding`, `BountyLedgerEntry`
- Blocks MVP: Blocks calling PAY-008 and PAY-015 done

Description: The client will report a signature. That report is a hint. Activation and `paid` depend on a later read of commitment, destination, source, system-program SOL, memo, and amount.

Impact: A copied signature, a transfer to some other account, a token transfer, or an underpayment can mark a bounty active or settle a payout.

Attack scenario: The creator submits a signature that paid a different address, or pays less than principal, and the API trusts the body.

Mitigation: Pending funding stores the signature and does not change bounty status. The worker posts one `deposit` for that signature only after every check passes. PD-21, if later accepted, credits extra lamports to `funded` and `refundable`. A shortfall rejects the funding row. Unique `ChainTransaction.signature` and unique `(chainTransactionId, entryType)` make the successful retry a no-op. Mismatched amount or destination is an audit exception and does not move the ledger.

### SEC-H4 One active nonce is not enforced by an applied migration

- Severity: High
- Kind: Verified schema gap, no live auth route
- Component: `AuthNonce`, `apps/api/prisma/manual/partial-indexes.sql`
- Blocks MVP: Blocks AUTH-002 and AUTH-009 until the first migration includes this SQL

Description: The partial unique index "one row per wallet with `used_at` and `retired_at` both null" is a comment and a SQL file. Prisma cannot express it. No migration has been created, and local Postgres was not accepting connections.

Impact: Two unconsumed nonces can both verify if the application inserts them.

Attack scenario: A client requests two nonces and replays either signature before expiry.

Mitigation: Put the SQL in the initial migration. Issue and retire nonces in one transaction. Consume the nonce in the same transaction that writes the session. Use a CSPRNG of at least 128 bits. The proposed nonce lifetime remains 10 minutes. ADR-003 does not set it.

### SEC-H5 The ciphertext column will store whatever the writer puts in it

- Severity: High
- Kind: Future risk
- Component: `BountyQuestion.expectedAnswerCiphertext`, public DTO
- Blocks MVP: Blocks bounty creation until encryption and the public projection exist

Description: The column is text plus `encryptionKeyId`. Nothing in the database checks that the value is ciphertext. Prisma returns every column on `findMany`. The shared public schema rejects `expectedAnswer`, and no API uses it yet.

Impact: A bounty create path that stores the plaintext, or a public handler that returns the question row, publishes the answer.

Attack scenario: The marketplace query includes the question relation. Solvers read the answer from JSON. Logs and error strings are a second path if a handler interpolates the plaintext.

Mitigation: Encrypt before insert. Public and list queries use an explicit DTO, not the Prisma model. Owner decrypt and verification decrypt are the only reads. Errors use stable codes. The preview form already avoids putting the answer in the receipt; the real POST must not keep it in `localStorage`.

### SEC-H6 Client money, time, and correctness flags are untrusted

- Severity: High
- Kind: Future risk
- Component: submissions, rewards
- Blocks MVP: Blocks calling E1, SOLVE, and PAY done

Description: The schema can store a client-supplied `amountLamports`, `isCorrect`, or timestamp if a handler copies the body. There is no check that an allocation amount equals `Bounty.rewardLamports`, and no check that `amount_lamports > 0`.

Impact: A negative ledger row breaks the identity. A client `isCorrect: true` pays a wrong answer. A client timestamp beats the deadline or forges a research duration.

Attack scenario: `POST` body `{ "answer": "no", "isCorrect": true, "amountLamports": "999", "submittedAt": "2000-01-01T00:00:00.000Z" }`.

Mitigation: Ignore those fields. Set clocks with the server. Copy `rewardLamports` inside the locked transaction. Reject non-positive amounts in that transaction. Add `CHECK (amount_lamports > 0)` on ledger and allocation amounts in the initial migration.

### SEC-H7 Principal and network fees share one on-chain balance

- Severity: High
- Kind: Future risk
- Component: treasury wallet, PD-07
- Blocks MVP: Blocks calling PAY-012 done

Description: The fee buffer is "treasury SOL that is not principal". It is not a second account and not a ledger bucket. The identity does not mention fees, which is correct. The send path can still spend lamports that the ledger calls `refundable` or `reserved`.

Impact: Fees drain creator principal. Later payouts sit in `retryable` while the books still show funds, or a payout succeeds by consuming another bounty's principal.

Attack scenario: The wallet holds exactly the sum of `reserved + refundable`. The worker pays a network fee from that balance and then cannot honor the ledger.

Mitigation: Before signing, require on-chain balance at least the sum of every bounty's `reserved + refundable`, plus the fee about to be paid. If not, leave the payout `retryable` and do not post `settle`. Do not insert a fee row into bounty principal. PD-07 stays proposed.

### SEC-M1 The rate limiter is not on any route

- Severity: Medium
- Kind: Verified
- Component: `InMemoryRateLimit`, `AntiAbuseModule`
- Blocks MVP: Blocks NFR-008. No current route issues nonces or accepts submissions

Description: The class counts hits in a process-local map. `AppModule` does not apply it. The map is also unbounded for distinct keys.

Impact: Once login and submit exist, a client can request nonces or submit as fast as the database allows. A large key set can grow memory.

Attack scenario: A loop calls the future nonce route from one wallet, or from many wallets.

Mitigation: Apply the proposed PD-20 limits, 10 nonce requests per minute per wallet and 30 submissions per minute per wallet, inside the API process. Return 429 `RATE_LIMITED`. Cap or expire map entries. Redis is not required. Horizontal scaling is out of scope, so one process is enough for the demo.

### SEC-M2 Request validation is a pipe, not a global rule

- Severity: Medium
- Kind: Verified
- Component: `ZodValidationPipe`, `AppModule`
- Blocks MVP: Blocks NFR-001 when the first write route is added

Description: The pipe is tested on a throwaway controller. `AppModule` registers the exception filter and interceptors. It does not register a global pipe. Current routes have no bodies, so nothing is bypassing validation today.

Impact: The first product controller that forgets the pipe accepts an untyped body.

Attack scenario: A submit handler reads `req.body.answer` without a schema and also copies unknown fields.

Mitigation: Each write contract is a Zod schema at the edge, preferably the shared one. Unknown enums fail. The error body keeps path and message and omits the raw value when Zod would echo it.

### SEC-M3 A chain row can be both a deposit and a payout

- Severity: Medium
- Kind: Verified schema gap
- Component: `ChainTransaction`, `BountyFunding`
- Blocks MVP: Should be fixed in the initial migration before money writers exist. Does not block auth

Description: `BountyFunding.chainTransactionId` points at a chain row, and that same row has an optional `payoutId`. Nothing says those cannot both be set. `kind` is an enum the application can contradict.

Impact: One signature could be posted as a deposit and as a settlement.

Attack scenario: A buggy confirmation handler sets `payoutId` on the funding transaction and both ledgers move.

Mitigation: In the funding confirmation transaction, require `kind = deposit` and `payoutId` null. In the payout confirmation transaction, require `kind = payout` and no funding row. A SQL check is awkward across the two foreign keys. The practical backstop is those two transactions plus a test that reprocessing is a no-op.

### SEC-M4 Null chain ids and missing amount checks weaken uniqueness

- Severity: Medium
- Kind: Verified schema behavior
- Component: `BountyLedgerEntry`
- Blocks MVP: Same migration window as SEC-H6. Not a live accounting bug

Description: `@@unique([chainTransactionId, entryType])` is the right key for a confirmed signature. PostgreSQL treats nulls as distinct, so many rows may have a null `chainTransactionId` and the same `entryType`. Reserves need that, because a reserve has a payout id and often no chain row yet. Deposits, settlements, and refunds do not.

Impact: Two `deposit` rows with a null chain id double-count `funded`.

Attack scenario: The worker inserts the ledger row, then fails before linking the chain row, and a retry inserts another deposit.

Mitigation: Insert the chain row and the `deposit`, `settle`, or `refund` entry in one transaction, with `chainTransactionId` set. Reserves and releases key off `payoutId` and must be idempotent on payout status. Do not rely on the unique pair alone while the chain id is null.

### SEC-M5 Submitted answers are planned as plaintext

- Severity: Medium
- Kind: Future risk
- Component: `SubmissionAttempt.submittedAnswer`, PD-19
- Blocks MVP: Blocks the submission write and any creator review API

Description: PD-19, still proposed, stores the submitted answer in plaintext for the owner and the solver. The expected answer is a different column and a different rule. There is no row-level policy. Explanation text, if PD-10 is later built, has the same audience.

Impact: Any handler or export that selects the column publishes research text. A database backup is readable without the answer-encryption key.

Attack scenario: The public bounty DTO is built from the attempt include. Another solver, or a public analytics route, receives the text.

Mitigation: Select the column only on the owner route and the solver's own history. Aggregates must count in SQL and must not load the text. Audit `metadata` stays `{}` or ids. CSV, when it exists, omits the text and the wallet. Do not log the column.

### SEC-M6 Liveness does not include the database

- Severity: Medium
- Kind: Verified
- Component: `HealthController`
- Blocks MVP: No. Operators should probe `/health/ready` before treating the API as usable

Description: `/health` stays 200 when the database is not configured or is down. `/health/ready` is the dependency signal. That split is intentional.

Impact: A process manager that only polls `/health` will send traffic to an API that cannot read or write product state.

Attack scenario: This is an availability mistake, not an attacker path. A configured URL that refuses connections still leaves the process up, which is what lets `/health` answer.

Mitigation: Use `/health` for "the process is up" and `/health/ready` for "configured Postgres is reachable". Do not add auth, bounty, or RPC success to either payload.

### SEC-M7 Both secrets sit in the global config object

- Severity: Medium
- Kind: Verified
- Component: `secretsConfig`
- Blocks MVP: No, until a module logs the config object. Becomes High on the first signer or decryptor

Description: When the environment variables are set, the raw treasury key, answer key, and auth secret are on the global `ConfigService`. Empty values stay unset, and startup does not require them. No current module reads them. Logs today do not print the object.

Impact: One `Logger.log(config)` in any module prints the treasury key and the answer key together.

Attack scenario: A developer logs `config.get("secrets")` while debugging a payout.

Mitigation: Keep the booleans for health-style checks. Pass the treasury key only into the future signer, and the answer key only into encrypt and decrypt. Never log the `secrets` namespace. Production should refuse to start a signer when the treasury key is missing, and refuse to create a bounty when the answer key is missing. It should keep starting `/health` when those features are off.

### SEC-M8 OpenAPI is anonymous

- Severity: Medium
- Kind: Verified, low impact today
- Component: `/docs`, `/docs-json`
- Blocks MVP: No at the current surface. Revisit before private routes are documented

Description: Swagger is mounted for every environment. The document describes the infrastructure shell and the two health routes. It does not describe a bounty body.

Impact: Later schema generation can advertise owner fields, including anything mistakenly added to a public DTO.

Attack scenario: A client reads `/docs-json` and finds a response property that contains the expected answer or a submitted answer.

Mitigation: Generate OpenAPI from the public and owner schemas separately. Do not register the ciphertext or the submitted answer on a public operation. Leaving `/docs` open for the hackathon is acceptable while the document stays this small.

### SEC-L1 Browser hardening headers are partial

- Severity: Low
- Kind: Verified
- Component: `SecurityHeadersInterceptor`, Express
- Blocks MVP: No

Description: The interceptor sets nosniff, no-referrer, and frame denial. Phase 4 responses also included `X-Powered-By: Express`. There is no content-security policy. HSTS is not set, and the local demo is HTTP, so HSTS would be wrong there.

Impact: The framework header is fingerprinting. Clickjacking of the API response is already discouraged by `X-Frame-Options`.

Attack scenario: A browser is framed or fingerprinted. The API currently returns JSON only.

Mitigation: Disable `x-powered-by` when touching bootstrap next. Add a CSP when the API starts serving HTML. It does not serve HTML now.

### SEC-L2 Origin and body-limit values are lightly checked

- Severity: Low
- Kind: Verified
- Component: `env.schema.ts`
- Blocks MVP: No

Description: `CORS_ORIGIN` is split on commas and not checked as an URL. The value `*` would be passed through. `JSON_BODY_LIMIT` is any non-empty string, so a huge limit is configuration, not a bug in the default.

Impact: A deployed API with `CORS_ORIGIN=*` trusts every browser origin. A huge body limit weakens the 64kb default.

Attack scenario: Misconfiguration, not an unauthenticated bypass of the default.

Mitigation: Keep the localhost default for development. In production, reject `*` and require an explicit origin list. Cap the body limit in the schema before product posts exist.

### SEC-L3 The redaction helper is shallow

- Severity: Low
- Kind: Verified
- Component: `common/logging/redact.ts`
- Blocks MVP: No. The live request logger does not use it and does not log bodies

Description: `redactSecrets` strips postgres URLs. `redactRecord` redacts top-level keys whose names match a secret pattern. Nested objects are copied through. The key pattern does not include `seed`, `mnemonic`, or a bare `answer`.

Impact: A later log of a nested body would keep `body.expectedAnswer`.

Attack scenario: A handler logs `{ body: createBountyInput }`.

Mitigation: Do not log request bodies. If a structured log needs a record, redact recursively and add the key names `seed` and `mnemonic`. Never log the answer fields by policy even if the helper misses them.

### SEC-L4 Wallet text and session hashes are loosely constrained

- Severity: Low
- Kind: Verified schema gap
- Component: `User.walletAddress`, `AuthSession.refreshTokenHash`
- Blocks MVP: No, if the auth writer validates a Solana public key and stores one hash per session

Description: Wallet columns are `VarChar(44)`, not a base58 check. `refreshTokenHash` is not unique. One user row per wallet is unique, which matches AUTH-005.

Impact: Garbage wallet strings could become users. Two session rows could share a hash if the writer reused it.

Attack scenario: A login body submits a 44-character string that is not a public key, or a session insert copies an existing hash.

Mitigation: Parse the address with a Solana public-key check before insert. Generate a new secret per session and store only its hash, with a unique index on that hash when sessions are implemented. Do not add a second wallet onto an existing user in the MVP.

### SEC-L5 Client-visible error text is the thrown message

- Severity: Low
- Kind: Verified
- Component: `ApiExceptionFilter`
- Blocks MVP: No, while thrown messages stay fixed strings

Description: `HttpException` messages are returned after postgres URLs are stripped. Unexpected errors are replaced. The filter does not know which messages contain an answer.

Impact: `throw new BadRequestException(plaintextAnswer)` would send the answer to the client.

Attack scenario: A future verifier puts the expected answer in the exception message to make the test easier to read.

Mitigation: Throw stable codes and fixed sentences. Keep the expected answer out of `Error` objects that might be logged or serialized.

### SEC-I1 The live surface is the infrastructure shell

- Severity: Informational
- Kind: Verified
- Component: `HealthController`, Swagger
- Blocks MVP: No

No authentication guard is registered. That is correct. A guard that always succeeded would be worse. Module folders are boundaries, not features.

### SEC-I2 A wallet is not a unique human

- Severity: Informational
- Kind: Accepted product rule
- Component: PRD, `User`
- Blocks MVP: No. Do not add KYC to "fix" it

One person may use many wallets and receive many rewards, up to the cap and the balance. Copy must keep saying pseudonymous. It must not say anonymous or Sybil-proof.

### SEC-I3 One account is one wallet

- Severity: Informational
- Kind: Verified schema
- Component: `User.walletAddress`
- Blocks MVP: No

There is no account that owns several wallets. A new wallet is a new user. Historical allocations stay on the wallet that earned them. Disconnect revokes the session and does not move funds. Lost wallet access is lost access to that user. Do not invent a merge flow in the MVP.

### SEC-I4 Balances stay derived

- Severity: Informational
- Kind: Verified
- Component: `Bounty`, `BountyLedgerEntry`
- Blocks MVP: No

The schema has no cached balance column. The design prefers a bounty row lock and sums inside the transaction. This review does not add a cache. A cache would be another write that can drift from the entries.

### SEC-I5 The preview form holds an answer and does not send it

- Severity: Informational
- Kind: Verified
- Component: `CreateBountyForm`
- Blocks MVP: No

The value stays in React state. The receipt omits it. `method="post"` is cancelled in the submit handler. There is no `localStorage` write. Mock bounties do not carry `expectedAnswer`. This is not the production create API.

### SEC-I6 The Prisma CLI has a local fallback URL

- Severity: Informational
- Kind: Verified
- Component: `apps/api/prisma.config.ts`
- Blocks MVP: No

`prisma generate` can run without `DATABASE_URL` because the CLI config falls back to `postgresql://postgres:postgres@localhost:5432/solversbounty`. The API does not use that fallback. `DatabaseService` stays `not_configured` when the variable is absent. The password is the local placeholder from the env example, not a deployed secret. Do not copy it into Neon.

## Authentication requirements

These requirements apply to a native signature check and to any later provider. This review does not select Privy, Reown, or native SIWS.

Wallet ownership:

- The API verifies an Ed25519 signature over a known message. The check is local and does not call RPC.
- The public key in the message is the wallet being authenticated.
- A valid signature for a different message, key, or nonce creates no user and no session.
- The platform never accepts a seed, secret key, or keystore. AUTH-010 stays a schema and API rule.
- Login failure bodies contain no secret and no nonce value that would help an offline guess. The issued nonce is public to the wallet that requested it.

Message binding:

- The signed bytes include the domain, the URI, the wallet address, the nonce, issued-at, expiration, the chain `solana:devnet`, and a statement that the signature does not approve a transfer.
- The API rebuilds that message from the stored nonce. It does not trust a client copy that disagrees.
- Domain and URI must match the configured app origin.
- A mainnet chain id, a missing chain id, or a different cluster is rejected.
- Clock skew for issued-at and expiration should be small, on the order of a minute, and the server clock wins.

Nonce:

- The server generates the nonce with a CSPRNG, at least 128 bits.
- The client does not choose the nonce.
- At most one nonce per wallet is active. Issuing another retires the previous active row.
- Lifetime remains the proposed 10 minutes. ADR-003 does not set the nonce lifetime.
- Expired, used, and retired nonces fail closed.
- Consumption and session insert commit together. A failed signature does not consume a nonce that the user still needs unless the attempt is clearly finished. A successful login must consume it.
- SEC-H4 is the database half of this rule.

Session, under [ADR-003](../decisions/ADR-003-postgresql-server-side-sessions.md):

- A missing, unknown, expired, or revoked cookie is 401 `UNAUTHENTICATED`.
- Access is bound to the user id and the wallet address.
- Logout or disconnect revokes the server record. Later calls with the old cookie fail. Disconnect sends no transaction.
- The server can revoke one session, or every session for a user, without waiting for expiry.
- The stored credential is a hash of the session token. The raw token is not a column.
- After authentication, the session identifier rotates. The new hash replaces the previous hash, and the previous token must not authorize requests.
- The cookie is `HttpOnly`, `Secure` on HTTPS, `SameSite=Lax` where that fits the deployment, and `Path=/`, with no unnecessary `Domain`. State-changing requests need CSRF protection. Exact lifetime, cookie domain, and the CSRF mechanism are not set.
- Session rows do not contain answers, treasury material, or the encryption key.
- Session validity comes from the stored hash. `AUTH_TOKEN_SECRET` is not the session token, the treasury key, or the answer key.

Wallet changes and multiple wallets:

- SEC-I3. Do not retarget `User.walletAddress` in place.
- Do not link two wallets into one reward identity.
- Admin authority is the server allowlist plus a server-side role write at login. A client role field is ignored. An empty allowlist means no admins.

## Expected-answer encryption

Not implemented. Requirements for the first bounty writer:

| Topic | Requirement |
| --- | --- |
| Algorithm | AES-256-GCM through Node `crypto`. No unauthenticated mode |
| Nonce | 12 random bytes per encryption, from a CSPRNG. Never reused under the same key |
| Payload | Version, nonce, ciphertext, and tag packed into `expectedAnswerCiphertext`. `encryptionKeyId` stays the separate column. A new nonce column is not required if the payload is self-contained |
| Key | 32 bytes, `ANSWER_ENCRYPTION_KEY`, distinct from `TREASURY_SECRET_KEY` and from `AUTH_TOKEN_SECRET` |
| Storage | Environment or the host secret store. Not a column, not a seed in git, not a log |
| Rotation | New encryptions use the new key id. The old key stays available until every row is rewritten. A row that names an unknown key id fails closed |
| Call sites | Encrypt on bounty create and on an owner edit of the answer. Decrypt in verification and in the owner private read |
| Access | Other creators receive the same not-found behavior the private route already specifies. Solvers receive correct or incorrect only |
| Errors | Decrypt failure is an operator error, HTTP 500 `INTERNAL`, not "incorrect". The body contains neither plaintext nor ciphertext |
| Backup | Losing the key loses every expected answer. Back it up in the operator's secret store. A demo may recreate bounties. Postgres backups do not replace the key |
| Tests | Public JSON and error snapshots fail if the plaintext or a recognizable ciphertext field appears |

PD-02 stays proposed. Packing the nonce into the existing column follows the entity list already in the database design. It is an implementation note, not a new product rule.

## Ledger integrity

The identity to preserve is:

```text
funded = reserved + paid + refundable + refunded
```

`funded` only increases, by confirmed deposits. `reserved` is an unconfirmed solver payout. `paid` is a confirmed solver payout. `refundable` is what E1 may still reserve and what P0 shows the creator after close. `refunded` moves only when the P1 refund transfer is confirmed. P0 must not send that transfer.

The schema can support the identity. It does not enforce it. Enforcement is the E1 transaction, the confirmation transactions, and NFR-016 tests.

| Posting | Same transaction | Uniqueness already in the schema |
| --- | --- | --- |
| Deposit confirmed | Funding row, chain row, one `deposit` entry, bounty `active` when principal is covered, audit | Signature unique. `(chainTransactionId, entryType)` unique once the chain id is non-null |
| E1 success | Lock bounty, attempt, allocation, `reserve`, `pending` payout, session `completed`, maybe close `fully_allocated`, audit | `(bountyId, solverId)`, `attemptId`, `allocationId`, idempotency key |
| E1 capacity miss | Attempt with `pool_exhausted` or `insufficient_refundable`, no allocation, no payout | Attempt number unique inside the session |
| Incorrect attempt | Attempt with `isCorrect` false, no allocation | Same |
| Payout confirmed | Chain row, one `settle`, allocation `paid`, payout `confirmed`, audit | Signature and entry type |
| Payout permanently failed | One `release`, allocation `released`, audit. Only after the signature is known dead | Payout status, not a second payout row |
| P1 refund confirmed | Chain row, one `refund`, audit. Amount is the locked `refundable` total, not a client number | Signature and entry type |

Idempotency key shape `payout:<bountyId>:<walletAddress>` is still PD-06's proposal. The unique column is already there.

Reconciliation: the treasury balance is not the ledger. It should be at least the sum of `reserved + refundable` across bounties, plus unpaid fees. A mismatch is an operator warning, not an automatic ledger rewrite.

Lost RPC responses are SEC-H2. Pending and submitted rows are the recovery queue. There is no in-memory payment queue to restore.

## Database review

UUID primary keys are present on every model. That choice is still open. This review recommends keeping UUID and does not close the choice.

Foreign keys match the design. `AuthNonce` correctly has no user foreign key, because the wallet may not have a user yet. `onDelete: Restrict` avoids a cascade that deletes ledger history. The product has no user-delete feature. Restrict will reject a later delete of a user who owns rows, which is the safer default.

Enums use the values from the database design and `@@map` to snake_case names. Coding standards already ask for those values. The "exact enum names" question should be closed on purpose when the first migration is created, not by this review.

`StrategyResponse` is absent. That matches the Phase 4 note and should stay absent until PD-10 is accepted.

`ChainTransaction.commitment` is text. PD-13 is open, so an enum would freeze `confirmed` or `finalized` too early.

The partial nonce index is the one constraint the schema cannot apply by itself. See SEC-H4.

Migration readiness: `prisma generate` works. `prisma/migrations` does not exist. Do not run `migrate reset`. Do not generate a migration against Neon or any shared database. When local Postgres accepts connections, create one initial migration and append `partial-indexes.sql`. Include positive amount checks from SEC-H6 in that same migration if the SQL stays a single reviewed file.

Indexes already present cover the marketplace `(status, deadline)`, the creator list `(creatorId, createdAt)`, payout status, and audit lookup. The solving-session unique key leads with `bountyId`, and the attempt unique key is `(sessionId, attemptNumber)`, so the extra indexes named in the design for those leading columns are unnecessary.

`BigInt` serialization is an API concern and is implemented for JSON responses. Database values remain integers.

## API review

| Control | Current state | Priority when product routes arrive |
| --- | --- | --- |
| CORS | Origin list, localhost default | Keep. Reject `*` in production |
| Headers | Three safe headers. `X-Powered-By` still present | Low |
| Validation | Pipe exists, not global | High for the first write |
| Body size | 64kb default, schema does not cap an override | Low |
| Rate limit | Implemented in memory, not attached | High for auth and submit |
| Errors | Stable codes for unexpected failures | High as a coding rule |
| Logs | Path, method, status, request id | Keep bodies out |
| Swagger | Public, health only | Watch the schemas |
| Env | Production requires `DATABASE_URL`. Secrets may be empty | Require a secret only in the process that uses it |
| Health | Liveness and readiness are split | Probe readiness for traffic |

## Unresolved decisions

PD-03 and PD-05 are no longer unresolved. The items below are not accepted here.

### PD-03 Session shape

Superseded by [ADR-003](../decisions/ADR-003-postgresql-server-side-sessions.md). The session is a PostgreSQL `AuthSession` row. The browser receives the raw token in an HttpOnly cookie, and PostgreSQL stores only a hash. JWT access and refresh tokens are not used. The earlier bearer-token recommendation is not the decision. Exact lifetime, cookie domain, CSRF mechanism, and the wallet authentication provider remain unset. ADR-003 does not implement authentication.

### PD-05 When a reward is sent

Superseded by [ADR-004](../decisions/ADR-004-immediate-individual-solver-payouts.md). Each eligible solver is paid individually after the reward is reserved. There is no batch and no creator release. The submission response does not wait for chain confirmation. E1 is unchanged. PD-13 still governs the confirmation commitment. ADR-004 does not implement transfers or the payout worker.

### PD-08 Refunds

Options: P0 only tracks `refundable` and stops new sessions. P1 sends the refund. Or P0 sends it automatically.

Implications: Automatic refund spends principal while payouts can still be in flight. The design already keeps in-flight payouts in `reserved`.

Recommendation, not a decision: leave the transfer as P1. Do not build it in the next implementation phase.

### PD-10 Strategies

Options: ship `StrategyResponse` with the listed enum, or wait.

Implications: The enum is an open research choice. The parent `SolvingSession` already exists, so a later table does not reshape P0.

Recommendation, not a decision: keep the model out of the first migration.

### PD-13 Commitment

Options: `processed`, `confirmed`, or `finalized`.

Implications: `processed` can mark `paid` for a transaction a fork drops. `confirmed` matches the usual Devnet demo. `finalized` waits longer and reduces that risk further.

Recommendation, not a decision: do not use `processed`. Prefer `confirmed` for the demo unless the operator explicitly wants to wait for `finalized`.

### PD-14 Wallet-linked research

Options: owner-only rows that include the wallet, or aggregates only.

Implications: Owner rows are still personal data. Public pages and CSV stay aggregated and wallet-free either way.

Recommendation, not a decision: default reports stay aggregated. A private owner view may show wallet-linked attempts. Exports omit wallets.

### PD-15 Treasury key location

Options: API environment variable, or a hosted signer / KMS.

Implications: An environment variable is enough for a small Devnet demo and is still a hot wallet, SEC-C1. A KMS reduces theft from a disk copy and does not fit the 40-hour path.

Recommendation, not a decision: environment variable on the API host only, for Devnet, with the isolation rules in PAY-014. Mainnet still needs a new ADR.

### Identifier type

Options: UUID, or a different primary key.

Implications: The schema, foreign keys, and memos already assume UUID. Changing it rewrites every table before the first migration.

Recommendation, not a decision: keep UUID.

### Enum names

Options: the snake_case values already written, or a rename.

Implications: The first migration freezes the Postgres labels.

Recommendation, not a decision: keep the values in `schema.prisma`. Close the question in the migration review rather than in application code.

### Balance cache

Options: derive sums under a bounty row lock, or also store buckets on `Bounty`.

Implications: A cache can serve faster owner totals and can drift. SEC-I4.

Recommendation, not a decision: do not add a cache. There is no measured read that needs one.

### Nonce index and migration strategy

Options: ship the partial index inside the initial migration, or enforce the single active nonce only in application code.

Implications: Application code races. The index does not.

Recommendation, not a decision: one initial migration against local Postgres, including `partial-indexes.sql` and the positive amount checks. No reset. No shared or production database. Neon waits until that migration file has been reviewed.

## Recommended implementation order

1. Leave the open decisions open until the user accepts or replaces them. Auth code can be written against the requirements in this file without choosing a vendor.
2. When local Postgres is up, create the initial migration described above. Do not start it on a refused port, and do not reset.
3. Authentication: nonce, local signature check, session hash, revoke. Wire the rate limit. Include the partial index.
4. Bounty create: encrypt, owner read, public DTO. Still no chain send.
5. Deposit verification on a fake gateway, then one Devnet deposit in a demo. Activation stays in the worker.
6. Consent, server clock, submit, E1 transaction, concurrent last-slot test.
7. Payout worker with memo lookup before sign, confirmation, and the fee-buffer check.
8. Owner analytics aggregates. P1 items, including refund transfer and strategies, stay out.

Phase 6 is not started by this review.
