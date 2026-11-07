# ADR-001 Modular monolith

- Status: accepted
- Date: 2026-11-07

## Context

SolversBounty is a 40-hour hackathon MVP. The backend must authenticate wallets, hide expected answers, verify submissions, keep a bounty ledger, and pay Solana Devnet rewards. Those steps share one database transaction at the moment a reward is reserved. The team is small. The product is not yet proven, and the load is a demo.

The original module list named auth, users, bounties, submissions, verification, rewards, analytics, Solana, anti-abuse, and notifications. Those are boundaries inside one product, not independent systems. Notifications has no MVP user story and is excluded by PRD reconciliation C4.

A microservice per module would split the reward reservation across a network call and a distributed transaction. That adds failure modes the hackathon cannot operate: service discovery, extra deploys, and partial payouts that the ledger cannot roll back.

## Decision

The API is one NestJS process organized as a modular monolith (CD-03).

- Modules and allowed dependencies are defined in [backend architecture](../architecture/BACKEND_ARCHITECTURE.md).
- Reward reservation, the payout row, and the ledger move commit in one PostgreSQL transaction.
- The Solana send happens after that commit. Recovery uses payout rows, not a second service.
- `packages/shared` holds contracts only. It is not a runtime service.
- Leaving this shape, or splitting out payouts or chain access, requires a new ADR.

## Consequences

- One deployable API is enough for the demo.
- Module boundaries are conventions plus Nest modules. A bad import can still couple them. The dependency graph in the backend architecture is the check.
- The confirmation worker runs in the same process (PD-16). A crash stops HTTP and confirmation together. Restart resumes from database rows.
- Horizontal scaling and independent scaling of payouts are out of scope.
- Tests can cover E1 with one database and a fake chain gateway.

## Alternatives

| Alternative | Why it was not selected |
| --- | --- |
| Microservices per module | Distributed transactions around money, more deploys, no demo need |
| Modular monolith plus a separate worker service | Safer process isolation later, extra moving part for 40 hours. The payout row already survives a restart |
| Serverless functions per route | Poor fit for a long-lived confirmation loop and a single ledger transaction |
| Put all logic in the Next.js server | Mixes the untrusted UI deploy with the treasury key. The key must stay in the API trust zone |
