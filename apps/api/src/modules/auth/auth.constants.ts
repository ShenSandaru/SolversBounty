// ADR-003 accepts server sessions and leaves the lifetime unset.
// Ten minutes is the proposed nonce lifetime. Eight hours is a hackathon working default, not an accepted lifetime.
export const NONCE_TTL_MS = 10 * 60 * 1000;
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
export const NONCE_RATE_LIMIT = 10;
export const NONCE_RATE_WINDOW_MS = 60 * 1000;
export const SESSION_COOKIE = "sb_session";
export const LOGIN_CHAIN = "solana:devnet";
