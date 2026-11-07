import { describe, expect, it, vi } from "vitest";
import { AuthClientError, logoutSession, requestNonce, restoreSession, signInWithWallet, signingFailure } from "./auth-client";
import { encodeSignature, messageBytes } from "./signature";

function namedError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

const apiUrl = "http://localhost:3001";
const wallet = "11111111111111111111111111111111";
const message = "solversbounty.dev wants you to sign in with your Solana account:\nThis signature does not approve a SOL transfer.";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("wallet authentication client", () => {
  it("requests a nonce with the connected wallet", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(201, { nonce: "abc", message, expiresAt: "2026-11-07T12:10:00.000Z" }));
    const issued = await requestNonce(apiUrl, wallet, fetchImpl);
    expect(issued.message).toBe(message);
    expect(fetchImpl).toHaveBeenCalledWith(`${apiUrl}/auth/nonce`, expect.objectContaining({
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ walletAddress: wallet }),
    }));
  });

  it("signs the exact backend message and submits a base64url signature", async () => {
    let signed = new Uint8Array(64);
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).endsWith("/auth/nonce")) {
        return jsonResponse(201, { nonce: "nonce-value", message, expiresAt: "2099-01-01T00:00:00.000Z" });
      }
      if (String(url).endsWith("/auth/login")) {
        const body = JSON.parse(String(init?.body)) as { signature: string; walletAddress: string };
        expect(body.walletAddress).toBe(wallet);
        expect(body.signature).toBe(encodeSignature(signed));
        expect(init?.credentials).toBe("include");
        return jsonResponse(201, { walletAddress: wallet, role: "user", csrfToken: "csrf" });
      }
      return jsonResponse(200, { id: "user-1", walletAddress: wallet, role: "user", csrfToken: "csrf" });
    });
    const session = await signInWithWallet({
      apiUrl,
      walletAddress: wallet,
      fetchImpl,
      now: Date.parse("2026-11-07T12:00:00.000Z"),
      signMessage: async (bytes) => {
        expect(Buffer.from(bytes).toString("utf8")).toBe(message);
        expect(Buffer.from(bytes).equals(Buffer.from(messageBytes(message)))).toBe(true);
        signed = new Uint8Array(64);
        signed[0] = 1;
        signed[1] = 2;
        signed[2] = 255;
        signed[3] = 64;
        return signed;
      },
    });
    expect(session.csrfToken).toBe("csrf");
  });

  it("encodes the signature as unpadded base64url", () => {
    expect(encodeSignature(Uint8Array.from([251, 255, 239]))).toBe("-__v");
  });

  it("restores the session after refresh without reading the session cookie", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(200, {
      id: "user-1",
      walletAddress: wallet,
      role: "admin",
      csrfToken: "csrf-from-server",
    }));
    const session = await restoreSession(apiUrl, fetchImpl);
    expect(session.role).toBe("admin");
    expect(fetchImpl).toHaveBeenCalledWith(`${apiUrl}/auth/session`, expect.objectContaining({
      credentials: "include",
    }));
  });

  it("reports an invalid signature", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith("/auth/nonce")) {
        return jsonResponse(201, { nonce: "n", message, expiresAt: "2099-01-01T00:00:00.000Z" });
      }
      return jsonResponse(401, { code: "AUTH_REJECTED", message: "Authentication failed." });
    });
    await expect(signInWithWallet({
      apiUrl,
      walletAddress: wallet,
      fetchImpl,
      signMessage: async () => new Uint8Array(64),
    })).rejects.toMatchObject({ code: "AUTH_REJECTED" });
  });

  it("reports a rejected signature request", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(201, { nonce: "n", message, expiresAt: "2099-01-01T00:00:00.000Z" }));
    await expect(signInWithWallet({
      apiUrl,
      walletAddress: wallet,
      fetchImpl,
      signMessage: async () => {
        throw new Error("User rejected the request.");
      },
    })).rejects.toThrow("The signature request was rejected.");
  });

  it("reports an expired nonce before signing", async () => {
    const signMessage = vi.fn(async () => new Uint8Array());
    const fetchImpl = vi.fn(async () => jsonResponse(201, { nonce: "n", message, expiresAt: "2020-01-01T00:00:00.000Z" }));
    await expect(signInWithWallet({
      apiUrl,
      walletAddress: wallet,
      fetchImpl,
      signMessage,
      now: Date.parse("2026-11-07T12:00:00.000Z"),
    })).rejects.toMatchObject({ code: "NONCE_EXPIRED" });
    expect(signMessage).not.toHaveBeenCalled();
  });

  it("sends the CSRF token on logout and does not store it in the request body", async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.credentials).toBe("include");
      expect(new Headers(init?.headers).get("X-CSRF-Token")).toBe("csrf-token");
      expect(init?.body).toBeUndefined();
      return jsonResponse(201, { revoked: true });
    });
    await logoutSession(apiUrl, "csrf-token", fetchImpl);
  });

  it("reports an unavailable API", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    await expect(requestNonce(apiUrl, wallet, fetchImpl)).rejects.toMatchObject({ code: "API_UNAVAILABLE" });
  });

  it("rejects a signature that is not 64 bytes before calling the API", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (String(url).endsWith("/auth/nonce")) {
        return jsonResponse(201, { nonce: "n", message, expiresAt: "2099-01-01T00:00:00.000Z" });
      }
      return jsonResponse(201, {});
    });
    await expect(signInWithWallet({
      apiUrl,
      walletAddress: wallet,
      fetchImpl,
      signMessage: async () => new Uint8Array(32),
    })).rejects.toMatchObject({ code: "INVALID_SIGNATURE_LENGTH" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("reports a disconnected wallet and a provider failure separately", () => {
    expect(signingFailure(namedError("WalletNotConnectedError", "Wallet not connected"))).toMatchObject({
      code: "WALLET_DISCONNECTED",
    });
    expect(signingFailure(namedError("WalletSignMessageError", "Unexpected error"))).toMatchObject({
      code: "WALLET_PROVIDER_ERROR",
    });
    expect(signingFailure(namedError("Error", "Something else failed"))).toMatchObject({
      code: "SIGNING_FAILED",
    });
  });

  it("reports a disconnected wallet while signing", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(201, { nonce: "n", message, expiresAt: "2099-01-01T00:00:00.000Z" }));
    await expect(signInWithWallet({
      apiUrl,
      walletAddress: wallet,
      fetchImpl,
      signMessage: async () => {
        throw namedError("WalletDisconnectedError", "Wallet disconnected");
      },
    })).rejects.toMatchObject({ code: "WALLET_DISCONNECTED" });
  });

  it("reports a wallet that cannot sign messages", async () => {
    await expect(signInWithWallet({
      apiUrl,
      walletAddress: wallet,
      signMessage: undefined,
    })).rejects.toBeInstanceOf(AuthClientError);
    await expect(signInWithWallet({
      apiUrl,
      walletAddress: wallet,
      signMessage: undefined,
    })).rejects.toMatchObject({ code: "UNSUPPORTED_SIGNING" });
  });
});
