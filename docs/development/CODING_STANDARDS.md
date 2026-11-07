# Coding standards

These standards apply once application code exists. Phase 1 has no application code. They also apply to documentation: use the glossary in the [README](../../README.md), and do not describe unimplemented behavior as shipped.

Related: [AGENTS.md](../../AGENTS.md), [backend architecture](../architecture/BACKEND_ARCHITECTURE.md), [testing strategy](TESTING_STRATEGY.md).

## TypeScript

- `strict` is on in every package. No implicit any.
- Do not use `any`. Use `unknown` and narrow it.
- Do not silence the compiler with `@ts-ignore`. A justified `@ts-expect-error` includes the reason.
- Prefer `const` and plain functions. Use classes where Nest or React already requires them.
- Module boundaries follow the backend architecture. `packages/shared` does not import Nest, React, Prisma, or `@solana/web3.js`.
- Solana lamports and money math use `bigint`. Do not use `number` for lamports. Convert to a decimal string only at the UI edge.
- Dates are `Date` in UTC at the API boundary. Do not trust a client timestamp.

## Naming

| Thing | Convention |
| --- | --- |
| TypeScript types and classes | PascalCase |
| Functions and variables | camelCase |
| React components | PascalCase |
| Nest files | `bounties.module.ts`, `bounties.service.ts`, `bounties.controller.ts` |
| React feature files | `features/marketplace/marketplace-list.tsx` for route-level pieces. Component file name matches the component |
| Database columns in Prisma | camelCase in the client, mapped to snake_case column names |
| Enums stored in Postgres | snake_case values as written in the database design, such as `funding_pending` and `numeric_exact` |
| Requirement mentions in tests | The ID, such as `PAY-006`, in the test name |
| Environment variables | UPPER_SNAKE as listed in the backend architecture |

Use the glossary. Say max rewarded solvers, not an undefined "max participants," unless the sentence is explicitly defining that older phrase as the same cap.

## Frontend

Intended layout:

```text
apps/web/src/app/                routes only, thin
apps/web/src/features/auth/
apps/web/src/features/bounties/
apps/web/src/features/marketplace/
apps/web/src/features/solver/
apps/web/src/features/analytics/
apps/web/src/features/history/
apps/web/src/components/ui/      shadcn/ui
apps/web/src/lib/                api client, formatting
```

- Routes compose features. They do not call Solana transfer builders for payouts.
- Server state uses TanStack Query. Zustand holds session UI state and wallet connection state, not a second copy of bounty truth.
- Forms use React Hook Form and Zod. Schemas come from `packages/shared` (PD-17).
- SOL display trims trailing zeros and shows up to 9 decimal places. The request path still sends or receives lamports as strings so precision survives JSON.
- Public components must not receive the expected answer as a prop except the authenticated creator editor.

## Backend

Intended layout:

```text
apps/api/src/modules/auth/
apps/api/src/modules/users/
apps/api/src/modules/bounties/
apps/api/src/modules/submissions/
apps/api/src/modules/verification/
apps/api/src/modules/rewards/
apps/api/src/modules/analytics/
apps/api/src/modules/solana/
apps/api/src/modules/anti-abuse/
apps/api/src/modules/audit/
apps/api/src/common/             filters, guards, config
```

- One module owns one boundary from the backend architecture.
- Controllers parse input, call a service, and return a DTO. Business rules do not live in controllers.
- `verification` stays pure. Pass in strings and the method. Do not pass an HTTP request.
- Cross-module calls follow the dependency graph. The worker emits events instead of importing product modules from `solana`.

## Validation and errors

- Validate every write body with Zod before domain work.
- Reject unknown enums. Do not coerce a verification method by guessing.
- Return the stable codes in the backend architecture. Include a field-level list for `VALIDATION_ERROR`.
- Never put the expected answer, ciphertext, treasury key, or refresh token in an error body.

## Logging

- Structured JSON logs.
- Include `requestId` and, when present, `userId`, `bountyId`, `payoutId`, and `action`.
- Log public chain signatures.
- Do not log expected answers, submitted answers, explanations, `Authorization` headers, cookies, refresh tokens, or either secret key.
- Log a payout state change as a single info event per transition.

## Data access

- Money writes go through the transaction boundaries in the backend architecture.
- Public Prisma queries use an explicit `select` that cannot include `expectedAnswerCiphertext`.
- Ledger rows are append-only.
- Do not add a cache of balances unless it is written in the same transaction as the ledger entry.

## Testing

- Put unit tests next to the pure code they cover, or under `apps/api/test` for HTTP tests. Follow the testing strategy.
- Test names state the requirement and the behavior: `PAY-006 does not sign a second transfer while submitted`.
- Do not hit Devnet in the default test command.

## Documentation in code

- Comments capture an invariant a reader could miss, such as why the send is outside the database transaction.
- Do not comment a requirement as done inside code while the catalogue still says `not_started`.
- When behavior changes, update the requirement status, the owning doc, and progress in the same change.

## Dependencies

- Add a dependency only when the milestone needs it.
- Prefer Node `crypto` for AES-256-GCM and hashing.
- The web app may use the Solana wallet adapter libraries required to talk to Phantom. The API uses `@solana/web3.js` for transactions and a local ed25519 verify path that does not require RPC.
- Do not add a queue, ORM besides Prisma, or a second validation library beside Zod.
