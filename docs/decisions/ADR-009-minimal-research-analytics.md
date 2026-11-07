# ADR-009 Minimal research analytics for MVP

- Status: accepted
- Date: 2026-11-07

This decision does not implement analytics, consent, or exports. Analytics requirement statuses stay `not_started`.

## Context

SolversBounty has two equally important goals:

1. A human intelligence marketplace where creators publish and fund cognitive challenges and solvers earn rewards.
2. A human reasoning research platform that collects basic information about human problem-solving activity.

The MVP has a limited development timeline. Advanced research analytics would increase implementation complexity and delay the core marketplace.

## Decision

For the MVP, SolversBounty will collect only four essential analytics metrics:

1. **Correctness:** Whether a solver's submitted answer is correct or incorrect. The backend verification result is the source. A client flag is not.
2. **Attempt count:** The number of answer attempts stored for the solver.
3. **Completion time:** The time the solver takes to complete the challenge, measured from server timestamps.
4. **Participant count:** The number of participants who engage with a bounty. A view of the challenge without a solving session is not participation.

These metrics provide basic insights into participation and problem-solving performance without a complex research analytics system.

The creator's bounty analytics view may display:

- Total participants.
- Correct answer count.
- Incorrect answer count.
- Average completion time.
- Accuracy percentage.

Simple cards, numbers, or basic charts are enough. The MVP does not require complex dashboards or advanced visualizations.

Analytics do not decide reward eligibility. Eligibility rule E1 is unchanged. The backend remains authoritative for answer verification and reward allocation. A correct attempt that fails E1 can still count as a correct attempt in these metrics and still creates no payout.

Completion time for the MVP average is the existing server interval from session start to the first correct attempt, over solvers who have a correct attempt. Median completion time, completion rate, average attempts, and attempts before success are not MVP display requirements.

## Explicitly excluded from the MVP

The initial MVP does not include:

- Mandatory written reasoning explanations.
- Self-reported problem-solving strategy surveys.
- Detailed answer-change history.
- Advanced statistical analysis.
- Complex research visualizations.
- Research data export functionality.

These features may be reconsidered in future versions based on actual user and researcher needs. PD-10 is not required for MVP analytics.

## Privacy and consent

Existing consent and privacy rules stay in force.

- Participants must be informed about the basic analytics data collected.
- Explicit research consent is required before a solving session begins (PD-09).
- Wallet authentication does not grant that consent.
- The product does not collect unnecessary personal information.
- Default aggregate analytics do not expose solver wallet addresses. Who may read those aggregates is [ADR-010](ADR-010-role-based-analytics-visibility.md). This decision does not change the four metrics.

## Related decisions

- ADR-003: PostgreSQL server-side sessions. Analytics reads do not replace session checks.
- ADR-004: Immediate individual solver payouts. Metrics do not choose who is paid.
- ADR-008: Unused reward pool retention. Analytics do not change that policy.

Eligibility rule E1 is unchanged. The canonical text is in the [README](../../README.md).

## Consequences

- Creators can see participation and basic performance without a research warehouse.
- Strategy, explanation, answer-change, and export work can wait.
- Consent copy must name the four metrics and must not imply that self-reports are collected in the MVP.
- The `StrategyResponse` model stays out of the MVP schema.

## Scope

This ADR sets the MVP analytics boundary only. It does not implement endpoints, dashboards, collection services, CSV export, or schema changes.

## Alternatives

| Alternative | Why it was not selected |
| --- | --- |
| Ship strategy surveys, explanations, answer-change history, and CSV in the MVP | More research detail, and more surface area than the hackathon timeline allows |
| Skip research recording entirely | The product's second goal is basic evidence of how people attempt the challenges |
