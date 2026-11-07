import { Keypair } from "@solana/web3.js";
import { InMemoryRateLimit } from "../anti-abuse/in-memory-rate-limit";
import { DatabaseService } from "../../database/database.service";
import { NONCE_TTL_MS, CSRF_COOKIE, SESSION_COOKIE } from "./auth.constants";
import { AuthFlowError } from "./auth.errors";
import { AuthService } from "./auth.service";
import { PrismaAuthRepository } from "./prisma-auth.repository";

const databaseUrl = process.env.AUTH_INTEGRATION_DATABASE_URL;
const describePostgres = databaseUrl ? describe : describe.skip;

class ClockedAuthService extends AuthService {
  current = new Date("2026-11-07T12:00:00.000Z");

  protected override now(): Date {
    return this.current;
  }
}

function cookieToken(setCookie: string): string {
  const pair = setCookie.split(";")[0] ?? "";
  return decodeURIComponent(pair.slice(pair.indexOf("=") + 1));
}

async function sign(wallet: Keypair, message: string): Promise<string> {
  const signature = await wallet.signBytes(new TextEncoder().encode(message));
  return Buffer.from(signature).toString("base64url");
}

describePostgres("AUTH PostgreSQL integration", () => {
  let database: DatabaseService;

  beforeAll(async () => {
    database = new DatabaseService({ url: databaseUrl ?? null });
    await database.onModuleInit();
    if (database.status !== "up") {
      throw new Error("Disposable authentication database did not become ready.");
    }
  });

  afterAll(async () => {
    await database?.onModuleDestroy();
  });

  it("runs nonce, login, replay, expiry, rotation, and logout against PostgreSQL", async () => {
    const wallet = await Keypair.generate();
    const address = wallet.publicKey.toBase58();
    const auth = new ClockedAuthService(new PrismaAuthRepository(database), new InMemoryRateLimit());

    const first = await auth.issueNonce(address);
    const second = await auth.issueNonce(address);
    expect(second.nonce).not.toBe(first.nonce);
    await expect(auth.login(address, await sign(wallet, first.message))).rejects.toMatchObject({
      code: "AUTH_REJECTED",
    });

    const login = await auth.login(address, await sign(wallet, second.message));
    const again = await auth.issueNonce(address);
    const repeated = await auth.login(address, await sign(wallet, again.message));
    expect(repeated.user.id).toBe(login.user.id);
    expect(repeated.user.walletAddress).toBe(address);

    await expect(auth.sessionFromCookie(`${SESSION_COOKIE}=${encodeURIComponent(cookieToken(login.setCookies[0] ?? ""))}`)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    const current = await auth.sessionFromCookie(
      `${SESSION_COOKIE}=${encodeURIComponent(cookieToken(repeated.setCookies[0] ?? ""))}`,
    );
    expect(current.walletAddress).toBe(address);

    await expect(auth.login(address, await sign(wallet, again.message))).rejects.toBeInstanceOf(AuthFlowError);

    const bad = await Keypair.generate();
    const issued = await auth.issueNonce(address);
    await expect(auth.login(address, await sign(bad, issued.message))).rejects.toMatchObject({
      code: "AUTH_REJECTED",
    });

    auth.current = new Date(auth.current.getTime() + NONCE_TTL_MS + 1);
    const expired = await auth.issueNonce(address);
    auth.current = new Date(auth.current.getTime() + NONCE_TTL_MS + 1);
    await expect(auth.login(address, await sign(wallet, expired.message))).rejects.toMatchObject({
      code: "AUTH_REJECTED",
    });

    auth.current = new Date("2026-11-07T13:00:00.000Z");
    const fresh = await auth.issueNonce(address);
    const active = await auth.login(address, await sign(wallet, fresh.message));
    await auth.logout(
      `${SESSION_COOKIE}=${encodeURIComponent(cookieToken(active.setCookies[0] ?? ""))}; ${CSRF_COOKIE}=${encodeURIComponent(active.csrfToken)}`,
      active.csrfToken,
    );
    await expect(
      auth.sessionFromCookie(`${SESSION_COOKIE}=${encodeURIComponent(cookieToken(active.setCookies[0] ?? ""))}`),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  });
});

describe("AUTH storage unavailable", () => {
  it("returns 503 when PostgreSQL cannot be reached", async () => {
    const database = new DatabaseService({ url: "postgresql://sbauth:sbauth@127.0.0.1:59991/sbauth" });
    await database.onModuleInit();
    expect(database.status).toBe("down");
    const wallet = await Keypair.generate();
    const auth = new AuthService(new PrismaAuthRepository(database), new InMemoryRateLimit());
    await expect(auth.issueNonce(wallet.publicKey.toBase58())).rejects.toMatchObject({
      status: 503,
      code: "NOT_READY",
    });
    await database.onModuleDestroy();
  });
});
