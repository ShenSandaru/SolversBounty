# ADR-006 Devnet treasury private-key storage

- Status: accepted
- Date: 2026-11-07

PD-15 is superseded by this record.

## Context

SolversBounty uses a custodial treasury for the Devnet MVP, as established by ADR-002. The backend must eventually sign authorized Solana transactions for funding and individual solver payouts.

The treasury private key is highly sensitive. Exposing it through frontend code, database records, source control, logs, or API responses could allow unauthorized access to treasury funds.

The MVP also has a strict 40-hour hackathon timeline. Introducing a dedicated managed signing service would add infrastructure and integration complexity.

## Decision

For the Devnet MVP, the Solana treasury private key will be stored as a backend-only environment secret.

Only the backend treasury-signing service may access the key for authorized transaction signing.

The following security requirements apply:

1. The private key must never be exposed to frontend code or browser environments.
2. The private key must never be stored in the application database.
3. The private key must never be committed to source control.
4. Environment files containing secrets must remain excluded from Git.
5. The private key and secret values must never appear in application logs, error messages, or API responses.
6. Access to the secret must be restricted to the backend runtime.
7. The backend must validate the configured key and fail safely if the required secret is missing or invalid.
8. The backend must construct and validate authorized funding and payout transactions. Clients must not be able to submit arbitrary transactions for treasury signing.
9. Treasury signing must be restricted to approved backend workflows.

The configured name remains `TREASURY_SECRET_KEY`. It stays separate from `ANSWER_ENCRYPTION_KEY` (PD-02).

## Mainnet considerations

This decision applies exclusively to the Solana Devnet MVP.

Before handling real funds on Mainnet, the treasury custody approach must undergo a separate security review. A managed signing service or dedicated key-management solution should be evaluated.

This ADR does not approve environment-secret storage as the permanent Mainnet custody strategy.

## Consequences

### Positive

- Simple implementation for the hackathon MVP.
- No additional signing infrastructure is required.
- Private-key access remains on the backend.
- Clear separation between frontend application logic and treasury signing.

### Trade-offs and risks

- A compromised backend environment may expose the treasury private key.
- Deployment administrators with sufficient privileges may access the secret.
- Incorrect secret handling could cause accidental exposure.

These risks are accepted for the limited Devnet MVP and must be addressed before Mainnet deployment.

## Scope

This ADR records a security and architecture decision only.

It does not authorize or implement:

- Treasury key generation or configuration.
- Solana wallet or RPC connections.
- Transaction construction or submission.
- Funding verification.
- Payout workers or treasury signing.
- Database schema changes or migrations.

Existing decisions remain unchanged:

- ADR-002: Custodial Devnet treasury.
- ADR-004: Immediate individual solver payouts.
- ADR-005: Solana `confirmed` commitment requirement.

Eligibility rule E1 and the ledger identity are unchanged. PD-08 and PD-14 remain proposed.

## Alternatives

| Alternative | Why it was not selected |
| --- | --- |
| Managed signing service or KMS | Better isolation, and the right thing to evaluate before Mainnet. It adds infrastructure the 40-hour Devnet MVP does not take on |
| Frontend, database, or committed key | Exposes the treasury secret outside the backend runtime |
