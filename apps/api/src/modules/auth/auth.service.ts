import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InMemoryRateLimit } from "../anti-abuse/in-memory-rate-limit";
import {
  SignatureError,
  WalletAddressError,
  canonicalWalletAddress,
  decodeSignature,
  verifyWalletSignature,
} from "../solana/verify-wallet-signature";
import { CSRF_COOKIE, NONCE_RATE_LIMIT, NONCE_RATE_WINDOW_MS, NONCE_TTL_MS, SESSION_TTL_MS } from "./auth.constants";
import { clearCsrfCookie, clearSessionCookie, csrfCookie, csrfTokensMatch, readNamedCookie, readSessionCookie, sessionCookie } from "./auth.cookies";
import { AuthFlowError } from "./auth.errors";
import { buildLoginMessage, loginOrigin } from "./login-message";
import { PrismaAuthRepository } from "./prisma-auth.repository";

export type AuthSettings = {
  origin: string;
  secureCookie: boolean;
  adminWallets: string[];
};

export type IssuedNonce = {
  nonce: string;
  message: string;
  expiresAt: string;
};

export type LoginResult = {
  setCookies: string[];
  csrfToken: string;
  user: { id: string; walletAddress: string; role: "user" | "admin" };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: PrismaAuthRepository,
    private readonly rateLimit: InMemoryRateLimit,
    @Optional() @Inject(ConfigService) private readonly config?: ConfigService,
  ) {}

  protected now(): Date {
    return new Date();
  }

  async issueNonce(walletAddress: string): Promise<IssuedNonce> {
    const wallet = this.readWallet(walletAddress);
    if (!this.rateLimit.allow(`auth-nonce:${wallet}`, NONCE_RATE_LIMIT, NONCE_RATE_WINDOW_MS)) {
      throw new AuthFlowError(429, "RATE_LIMITED", "Too many nonce requests.");
    }
    const now = this.now();
    const expiresAt = new Date(now.getTime() + NONCE_TTL_MS);
    const nonce = randomBytes(16).toString("base64url");
    await this.repository.issueNonce({ userWallet: wallet, nonce, expiresAt, now });
    return {
      nonce,
      message: this.messageFor(wallet, nonce, now, expiresAt),
      expiresAt: expiresAt.toISOString(),
    };
  }

  async login(walletAddress: string, signatureText: string): Promise<LoginResult> {
    const wallet = this.readWallet(walletAddress);
    let signature: Uint8Array;
    try {
      signature = decodeSignature(signatureText);
    } catch (error) {
      if (error instanceof SignatureError) {
        throw new AuthFlowError(401, "AUTH_REJECTED", "Authentication failed.");
      }
      throw error;
    }
    const now = this.now();
    const active = await this.repository.findActiveNonce(wallet, now);
    if (!active) {
      throw new AuthFlowError(401, "AUTH_REJECTED", "Authentication failed.");
    }
    const message = this.messageFor(wallet, active.nonce, new Date(active.expiresAt.getTime() - NONCE_TTL_MS), active.expiresAt);
    const valid = await verifyWalletSignature(wallet, message, signature);
    if (!valid) {
      throw new AuthFlowError(401, "AUTH_REJECTED", "Authentication failed.");
    }
    const token = randomBytes(32).toString("base64url");
    const csrfToken = randomBytes(32).toString("base64url");
    const hash = hashSessionToken(token);
    const saved = await this.repository.consumeLogin({
      userWallet: wallet,
      nonce: active.nonce,
      now,
      role: this.roleFor(wallet),
      refreshTokenHash: hash,
      sessionExpiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    });
    if (!saved) {
      throw new AuthFlowError(401, "AUTH_REJECTED", "Authentication failed.");
    }
    const settings = this.settings();
    const maxAgeSeconds = SESSION_TTL_MS / 1000;
    return {
      setCookies: [
        sessionCookie(token, maxAgeSeconds, settings.secureCookie),
        csrfCookie(csrfToken, maxAgeSeconds, settings.secureCookie),
      ],
      csrfToken,
      user: { id: saved.user.id, walletAddress: saved.user.walletAddress, role: saved.user.role },
    };
  }

  async sessionFromCookie(cookieHeader: string | undefined): Promise<{ id: string; walletAddress: string; role: "user" | "admin" }> {
    const token = readToken(cookieHeader);
    const found = await this.repository.findSession(hashSessionToken(token), this.now());
    if (!found) {
      throw new AuthFlowError(401, "UNAUTHENTICATED", "Authentication required.");
    }
    return { id: found.user.id, walletAddress: found.user.walletAddress, role: found.user.role };
  }

  async csrfForSession(cookieHeader: string | undefined): Promise<{ csrfToken: string; setCsrfCookie: string | null }> {
    await this.sessionFromCookie(cookieHeader);
    const existing = readNamedCookie(cookieHeader, CSRF_COOKIE);
    if (existing) {
      return { csrfToken: existing, setCsrfCookie: null };
    }
    const csrfToken = randomBytes(32).toString("base64url");
    return {
      csrfToken,
      setCsrfCookie: csrfCookie(csrfToken, SESSION_TTL_MS / 1000, this.settings().secureCookie),
    };
  }

  async logout(cookieHeader: string | undefined, csrfHeader: string | undefined): Promise<string[]> {
    if (!csrfTokensMatch(cookieHeader, csrfHeader)) {
      throw new AuthFlowError(403, "FORBIDDEN", "Cross-site request blocked.");
    }
    const token = readToken(cookieHeader);
    await this.repository.revokeSession(hashSessionToken(token), this.now());
    const settings = this.settings();
    return [clearSessionCookie(settings.secureCookie), clearCsrfCookie(settings.secureCookie)];
  }

  private messageFor(wallet: string, nonce: string, issuedAt: Date, expiresAt: Date): string {
    const { domain, uri } = loginOrigin(this.settings().origin);
    return buildLoginMessage({ domain, uri, walletAddress: wallet, nonce, issuedAt, expiresAt });
  }

  private roleFor(wallet: string): "user" | "admin" {
    return this.settings().adminWallets.includes(wallet) ? "admin" : "user";
  }

  private readWallet(value: string): string {
    try {
      return canonicalWalletAddress(value);
    } catch (error) {
      if (error instanceof WalletAddressError) {
        throw new AuthFlowError(400, "VALIDATION_ERROR", "Wallet address is not a Solana public key.");
      }
      throw error;
    }
  }

  private settings(): AuthSettings {
    const origins = this.config?.get<string[]>("app.corsOrigins") ?? ["http://localhost:3000"];
    const nodeEnv = this.config?.get<string>("app.nodeEnv") ?? "development";
    const adminWallets = (this.config?.get<string[]>("secrets.adminWalletAllowlist") ?? [])
      .map((wallet) => {
        try {
          return canonicalWalletAddress(wallet);
        } catch {
          return "";
        }
      })
      .filter((wallet) => wallet.length > 0);
    return {
      origin: origins[0] ?? "http://localhost:3000",
      secureCookie: nodeEnv === "production",
      adminWallets,
    };
  }
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readToken(cookieHeader: string | undefined): string {
  const token = readSessionCookie(cookieHeader);
  if (!token) {
    throw new AuthFlowError(401, "UNAUTHENTICATED", "Authentication required.");
  }
  return token;
}
