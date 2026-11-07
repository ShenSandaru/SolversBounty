import { Keypair } from "@solana/web3.js";
import { ConfigService } from "@nestjs/config";
import { InMemoryRateLimit } from "../anti-abuse/in-memory-rate-limit";
import { CSRF_COOKIE, NONCE_TTL_MS, SESSION_COOKIE } from "./auth.constants";
import { AuthFlowError } from "./auth.errors";
import { AuthService } from "./auth.service";
import { FakeAuthPrisma } from "./fake-auth-prisma";
import { PrismaAuthRepository } from "./prisma-auth.repository";

class ClockedAuthService extends AuthService {
  current = new Date("2026-11-07T12:00:00.000Z");

  protected override now(): Date {
    return this.current;
  }
}

function settings(admin?: string): ConfigService {
  return {
    get: (key: string) => {
      if (key === "app.corsOrigins") {
        return ["http://localhost:3000"];
      }
      if (key === "app.nodeEnv") {
        return "development";
      }
      if (key === "secrets.adminWalletAllowlist") {
        return admin ? [admin] : [];
      }
      return undefined;
    },
  } as ConfigService;
}

async function sign(wallet: Keypair, message: string): Promise<string> {
  const signature = await wallet.signBytes(new TextEncoder().encode(message));
  return Buffer.from(signature).toString("base64url");
}

describe("AuthService wallet login", () => {
  it("AUTH-002 AUTH-005 AUTH-006 AUTH-008 AUTH-009 issues one nonce, logs in once, and rejects reuse and bad signatures", async () => {
    const wallet = await Keypair.generate();
    const address = wallet.publicKey.toBase58();
    const store = new FakeAuthPrisma();
    const auth = new ClockedAuthService(PrismaAuthRepository.fromClient(store), new InMemoryRateLimit(), settings(address));

    const first = await auth.issueNonce(address);
    const second = await auth.issueNonce(address);
    expect(second.nonce).not.toBe(first.nonce);
    expect(second.nonce.length).toBeGreaterThanOrEqual(22);
    expect(store.nonces.filter((row) => row.retiredAt === null && row.usedAt === null)).toHaveLength(1);
    await expect(auth.login(address, await sign(wallet, first.message))).rejects.toMatchObject({ code: "AUTH_REJECTED" });
    expect(store.users).toHaveLength(0);
    expect(store.sessions).toHaveLength(0);

    const login = await auth.login(address, await sign(wallet, second.message));
    expect(login.user.role).toBe("admin");
    expect(login.user.walletAddress).toBe(address);
    expect(login.setCookies[0]).toContain("HttpOnly");
    expect(login.setCookies[0]).toContain("SameSite=Lax");
    expect(login.setCookies[0]).toContain("Path=/");
    expect(login.setCookies[0]).not.toContain("Domain=");
    expect(login.setCookies.join(" ")).not.toContain(second.nonce);
    expect(store.users).toHaveLength(1);

    const token = decodeURIComponent(login.setCookies[0]?.split(";")[0]?.replace(`${SESSION_COOKIE}=`, "") ?? "");
    const session = await auth.sessionFromCookie(`${SESSION_COOKIE}=${encodeURIComponent(token)}`);
    expect(session.walletAddress).toBe(address);

    await expect(auth.login(address, await sign(wallet, second.message))).rejects.toBeInstanceOf(AuthFlowError);
    expect(store.sessions.filter((row) => row.revokedAt === null)).toHaveLength(1);

    const again = await auth.issueNonce(address);
    const rotated = await auth.login(address, await sign(wallet, again.message));
    expect(store.users).toHaveLength(1);
    expect(store.sessions.filter((row) => row.revokedAt === null)).toHaveLength(1);
    await expect(auth.sessionFromCookie(`${SESSION_COOKIE}=${encodeURIComponent(token)}`)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    const nextToken = decodeURIComponent(rotated.setCookies[0]?.split(";")[0]?.replace(`${SESSION_COOKIE}=`, "") ?? "");
    const header = `${SESSION_COOKIE}=${encodeURIComponent(nextToken)}; ${CSRF_COOKIE}=${encodeURIComponent(rotated.csrfToken)}`;
    await expect(auth.logout(header, "wrong")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await auth.logout(header, rotated.csrfToken);
    await expect(auth.sessionFromCookie(`${SESSION_COOKIE}=${encodeURIComponent(nextToken)}`)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("AUTH-009 rejects an expired nonce without creating a session", async () => {
    const wallet = await Keypair.generate();
    const address = wallet.publicKey.toBase58();
    const store = new FakeAuthPrisma();
    const auth = new ClockedAuthService(PrismaAuthRepository.fromClient(store), new InMemoryRateLimit(), settings());
    const issued = await auth.issueNonce(address);
    auth.current = new Date(auth.current.getTime() + NONCE_TTL_MS + 1);
    await expect(auth.login(address, await sign(wallet, issued.message))).rejects.toMatchObject({ code: "AUTH_REJECTED" });
    expect(store.sessions).toHaveLength(0);
    expect(store.nonces[0]?.usedAt).toBeNull();
  });

  it("limits nonce issuance to 10 per minute for one wallet", async () => {
    const wallet = await Keypair.generate();
    const address = wallet.publicKey.toBase58();
    const auth = new ClockedAuthService(PrismaAuthRepository.fromClient(new FakeAuthPrisma()), new InMemoryRateLimit(), settings());
    for (let count = 0; count < 10; count += 1) {
      await auth.issueNonce(address);
    }
    await expect(auth.issueNonce(address)).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });
});
