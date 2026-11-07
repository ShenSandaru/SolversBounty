# ADR-003 PostgreSQL server-side sessions

- Status: accepted
- Date: 2026-11-07

## Context

SolversBounty requires wallet-based authentication. Users prove ownership of their Solana wallets, and the backend must maintain authenticated application sessions.

The project needs reliable session expiration, revocation, and account access management.

Two approaches were considered:

1. PostgreSQL-backed server-side sessions.
2. JWT access tokens with refresh-token rotation.

The existing database design already includes an `AuthSession` model, making server-side session management compatible with the current architecture.

## Decision

SolversBounty will use PostgreSQL-backed server-side sessions.

After successful wallet authentication, the backend will:

1. Generate a cryptographically secure, unpredictable session token.
2. Store the associated session record in PostgreSQL.
3. Store a cryptographic hash of the session token rather than the raw token.
4. Send the raw session token to the browser through a secure HttpOnly cookie.
5. Validate the session against the server-side record when processing protected API requests.

The browser will not manage JWT access or refresh tokens.

### Cookie security requirements

The session cookie must use:

- `HttpOnly`
- `Secure` in HTTPS environments
- `SameSite=Lax` where compatible with the deployment architecture
- `Path=/`
- No unnecessary `Domain` attribute

CSRF protection must be implemented for state-changing requests.

If the frontend and API require cross-site cookie configuration, the cookie policy and CSRF controls must be reviewed accordingly.

### Session lifecycle

The authentication implementation must support:

- Session creation after successful wallet ownership verification.
- Session identifier rotation after authentication.
- Server-side session validation.
- Session expiration.
- Logout and session revocation.
- Revocation of all sessions belonging to a user when required.

The backend remains authoritative for session validity.

### Security considerations

- Session tokens must be generated using a cryptographically secure random generator.
- Raw session tokens must not be stored in PostgreSQL.
- Session credentials must never be logged.
- Session identifiers must not be exposed through URLs.
- Expired and revoked sessions must not authorize API requests.
- Authentication and session management must remain independent of the selected wallet authentication provider.

## Consequences

### Positive

- Sessions can be revoked immediately.
- Session management remains centralized.
- Account-wide logout is straightforward.
- No JWT refresh-token rotation workflow is required.
- The approach fits the existing PostgreSQL `AuthSession` model.

### Trade-offs

- Authenticated requests require server-side session validation.
- PostgreSQL availability affects authenticated operations.
- Session expiration and cleanup must be implemented.
- Cookie security and CSRF protection require careful configuration.

## Scope

This decision establishes the session architecture only.

It does not select an authentication provider. Privy, Reown, and native SIWS remain open for separate consideration.

It does not define exact session lifetimes, cookie deployment domains, or a final CSRF implementation.

It does not authorize implementation of authentication or database migrations as part of this decision.

PD-03 is superseded. The 15-minute JWT access token and 7-day refresh token are not the session shape. The existing `refreshTokenHash` column is the hash location until a later schema change renames it. This ADR does not rename it and does not apply a migration.

## Alternatives

| Alternative | Why it was not selected |
| --- | --- |
| JWT access token plus rotating refresh token (PD-03) | Refresh rotation is unnecessary. Immediate revocation and account-wide logout are simpler when the server stores the session. The `AuthSession` table already exists |
| Opaque bearer token with the same server row | Revocation fits the table, but the accepted client credential is an HttpOnly cookie, not a token the browser script manages |
