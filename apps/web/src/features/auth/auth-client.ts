import { encodeSignature, messageBytes } from "./signature";

export type AuthSession = {
  id: string;
  walletAddress: string;
  role: "user" | "admin";
  csrfToken: string;
};

export type IssuedNonce = {
  nonce: string;
  message: string;
  expiresAt: string;
};

export class AuthClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const jsonHeaders = { "Content-Type": "application/json" };

export function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export async function requestNonce(apiUrl: string, walletAddress: string, fetchImpl: FetchLike = fetch): Promise<IssuedNonce> {
  const response = await send(fetchImpl, `${apiUrl}/auth/nonce`, {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({ walletAddress }),
  });
  const body = (await response.json()) as Partial<IssuedNonce>;
  if (!body.message || !body.expiresAt || !body.nonce) {
    throw new AuthClientError("The API returned an incomplete sign-in message.", "API_FAILURE");
  }
  return { nonce: body.nonce, message: body.message, expiresAt: body.expiresAt };
}

export async function signInWithWallet(input: {
  apiUrl: string;
  walletAddress: string;
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | undefined;
  fetchImpl?: FetchLike;
  now?: number;
}): Promise<AuthSession> {
  if (!input.signMessage) {
    throw new AuthClientError("This wallet cannot sign in. It does not support message signing.", "UNSUPPORTED_SIGNING");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const issued = await requestNonce(input.apiUrl, input.walletAddress, fetchImpl);
  if (Date.parse(issued.expiresAt) <= (input.now ?? Date.now())) {
    throw new AuthClientError("The sign-in message expired. Try again.", "NONCE_EXPIRED");
  }
  let signatureBytes: Uint8Array;
  try {
    signatureBytes = await input.signMessage(messageBytes(issued.message));
  } catch (error) {
    throw signingFailure(error);
  }
  return completeSignedLogin({
    apiUrl: input.apiUrl,
    walletAddress: input.walletAddress,
    signatureBytes,
    fetchImpl,
  });
}

export async function completeSignedLogin(input: {
  apiUrl: string;
  walletAddress: string;
  signatureBytes: Uint8Array;
  fetchImpl?: FetchLike;
}): Promise<AuthSession> {
  if (input.signatureBytes.length !== 64) {
    throw new AuthClientError("The wallet returned an unusable signature.", "INVALID_SIGNATURE_LENGTH");
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await send(fetchImpl, `${input.apiUrl}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify({
      walletAddress: input.walletAddress,
      signature: encodeSignature(input.signatureBytes),
    }),
  });
  await response.json();
  return restoreSession(input.apiUrl, fetchImpl);
}

export async function restoreSession(apiUrl: string, fetchImpl: FetchLike = fetch): Promise<AuthSession> {
  const response = await send(fetchImpl, `${apiUrl}/auth/session`, {
    method: "GET",
    credentials: "include",
  });
  const body = (await response.json()) as Partial<AuthSession>;
  if (!body.id || !body.walletAddress || (body.role !== "user" && body.role !== "admin") || !body.csrfToken) {
    throw new AuthClientError("The API returned an incomplete session.", "API_FAILURE");
  }
  return { id: body.id, walletAddress: body.walletAddress, role: body.role, csrfToken: body.csrfToken };
}

export async function logoutSession(apiUrl: string, csrfToken: string, fetchImpl: FetchLike = fetch): Promise<void> {
  await send(fetchImpl, `${apiUrl}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": csrfToken },
  });
}

export function signingFailure(error: unknown): AuthClientError {
  const name = error instanceof Error ? error.name : "unknown";
  const message = error instanceof Error ? error.message : "";
  const rejected = /reject|declin|cancel/i.test(message);
  const disconnected = name === "WalletNotConnectedError" || name === "WalletDisconnectedError" || /not connected|disconnected/i.test(message);
  const unsupported = /does not support|not support message/i.test(message);
  let code = "SIGNING_FAILED";
  let display = "The signing request failed.";
  if (rejected) {
    code = "SIGNING_REJECTED";
    display = "The signature request was rejected.";
  } else if (disconnected) {
    code = "WALLET_DISCONNECTED";
    display = "The wallet disconnected before it could sign. Connect it and try again.";
  } else if (unsupported) {
    code = "UNSUPPORTED_SIGNING";
    display = "This wallet cannot sign in. It does not support message signing.";
  } else if (name === "WalletSignMessageError") {
    code = "WALLET_PROVIDER_ERROR";
    display = "Phantom could not open the signature request. Try again.";
  }
  if (process.env.NODE_ENV === "development") {
    console.info("wallet sign-in failed", { code, name });
  }
  return new AuthClientError(display, code);
}

export function connectErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/not found|not installed|not ready/i.test(message)) {
    return "Phantom is not available. Install it and refresh this page.";
  }
  if (/reject|declin|cancel/i.test(message)) {
    return "The wallet connection was rejected.";
  }
  return "The wallet could not connect.";
}

async function send(fetchImpl: FetchLike, url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, cache: "no-store" });
  } catch {
    throw new AuthClientError("The API is unavailable.", "API_UNAVAILABLE");
  }
  if (response.ok) {
    return response;
  }
  throw await errorFromResponse(response);
}

async function errorFromResponse(response: Response): Promise<AuthClientError> {
  let code = "API_FAILURE";
  try {
    const body = (await response.json()) as { code?: string };
    if (body.code) {
      code = body.code;
    }
  } catch {
    code = "API_FAILURE";
  }
  if (response.status === 401 && code === "AUTH_REJECTED") {
    return new AuthClientError("Sign-in was rejected. The message may have expired or the signature did not match. Try again.", code);
  }
  if (response.status === 401) {
    return new AuthClientError("Authentication required.", code);
  }
  if (response.status === 429 || code === "RATE_LIMITED") {
    return new AuthClientError("Too many sign-in attempts. Wait a minute and try again.", code);
  }
  if (response.status === 403 || code === "FORBIDDEN") {
    return new AuthClientError("The server rejected this request. Sign in again.", code);
  }
  if (response.status >= 500 || code === "NOT_READY") {
    return new AuthClientError("The API is unavailable.", code);
  }
  return new AuthClientError("The request failed.", code);
}
