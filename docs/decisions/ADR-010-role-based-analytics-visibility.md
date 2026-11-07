# ADR-010 Role-based analytics visibility and administrative access

- Status: accepted
- Date: 2026-11-07

This decision does not implement analytics, roles, guards, dashboards, or audit logging. Requirement statuses stay `not_started`.

## Context

SolversBounty has two primary goals:

1. A human intelligence marketplace where creators publish and fund cognitive challenges and solvers earn rewards.
2. A human reasoning research platform that collects basic problem-solving analytics.

[ADR-009](ADR-009-minimal-research-analytics.md) established the four essential MVP analytics metrics:

- Correctness.
- Attempt count.
- Completion time.
- Participant count.

PD-14 asked who can access the resulting analytics and what each role can see. The earlier proposal, a private wallet-linked submission list for the bounty owner, is not the rule.

Creator is not a new account type. A creator is the authenticated user who owns the bounty. Administrator is the existing `admin` role from the server allowlist (PD-04). The same wallet may create bounties and solve other bounties. There is no company account type.

## Decision

The backend enforces analytics visibility and administrative permissions. Hiding a control in the interface is not authorization.

[ADR-009](ADR-009-minimal-research-analytics.md) still defines which metrics exist. This decision defines who may read them. The metrics stay correctness, attempt count, completion time, and participant count. No further research metric is added. Analytics do not decide reward eligibility. Eligibility rule E1 is unchanged.

### Creator

A creator may read aggregated analytics for bounties they own:

- Total participant count.
- Correct answer count.
- Incorrect answer count.
- Average completion time.
- Accuracy percentage.

A creator may not read another creator's analytics, individual solver research records, individual solver answer histories, or solver wallet addresses through analytics.

### Administrator

An administrator may read platform-wide aggregates of the same ADR-009 metrics:

- Total number of bounties.
- Total participants across the platform.
- Total correct answers.
- Total incorrect answers.
- Overall average completion time.
- Overall accuracy percentage.
- Aggregated analytics for an individual bounty.
- Aggregated analytics grouped by creator.

An administrator may also perform operational administration: manage creator and solver accounts, moderate bounties across the platform, handle operational issues, manage administrative permissions, and read authorized operational audit records. Those operations are not analytics. They do not grant individual solver research records, solver answer histories, or solver wallet addresses through analytics. Account management may use the wallet as the account key. That operational view is not an analytics response and does not include research records.

Permission management is limited to wallets that already have the server-assigned `admin` role. This decision adds no new role.

Administrative actions are recorded in the audit log. The log is not implemented here.

### Access-control matrix

| Capability | Creator | Administrator |
| --- | --- | --- |
| Own bounty analytics | Allowed | Allowed |
| Other creators' bounty analytics | Denied | Allowed, aggregated |
| Platform-wide analytics | Denied | Allowed |
| Aggregated creator-level analytics | Own data only | All creators |
| Aggregated individual bounty analytics | Own bounties only | All bounties |
| Individual solver research records | Denied | Denied |
| Solver wallet addresses in analytics | Denied | Denied |
| Creator account management | Denied | Allowed |
| Solver account management | Denied | Allowed |
| Bounty moderation | Own bounties only | Platform-wide |
| Administrative permission management | Denied | Authorized administrators only |
| Operational audit records | Denied | Authorized access |

## Security and privacy

1. Analytics access is enforced by the backend.
2. Hiding interface elements is not sufficient authorization.
3. Creators access analytics only for bounties they own.
4. Administrators may access aggregated analytics across the platform.
5. Analytics responses do not expose solver wallet addresses.
6. Normal analytics endpoints do not expose individual solver research records.
7. Administrative operations follow role-based authorization.
8. Administrative actions are recorded in audit logs.
9. Research consent from earlier decisions is unchanged. Explicit consent is still required before a solving session (PD-09).
10. Wallet authentication does not grant research consent.

Research analytics and operational administration stay separate. Operational access for accounts, bounties, and platform security does not include individual research records.

A solver may still read their own participation and reward history. That history is not a creator or administrator analytics view.

Submitted answers may still be stored for verification (PD-19). Storing them does not authorize a creator or administrator analytics response that contains the text, the answer history, or the solver wallet. PD-14's private wallet-linked list is not allowed.

## Related decisions

- ADR-003: PostgreSQL server-side sessions. Authorization uses the server session and the server-assigned role.
- ADR-009: Minimal research analytics. Metrics and the creator display figures are unchanged.

Eligibility rule E1 is unchanged. The canonical text is in the [README](../../README.md).

## Consequences

- Creator analytics stay the five ADR-009 figures for owned bounties.
- Administrator analytics reuse those figures at platform, bounty, and creator scope.
- A separate administration product is still out of scope. These permissions are protected API operations.
- Consent copy still describes the four collected metrics. It does not say that creators or administrators can identify a solver from analytics.

## Scope

This ADR sets access rules only. It does not implement guards, analytics endpoints, dashboards, authentication, or audit logging.

## Alternatives

| Alternative | Why it was not selected |
| --- | --- |
| Let the owning creator open wallet-linked submission rows (PD-14) | Identifies solvers from research data. The MVP analytics decision is aggregates only |
| Give administrators the same individual research rows for moderation | Operational administration does not require reading answer histories or identifying solvers from the analytics view |
| Add a company account type for platform analytics | The glossary creator remains the funding party. Administrator is the existing allowlisted role |
