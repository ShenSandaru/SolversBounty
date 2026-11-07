import { randomBytes } from "node:crypto";
// This spec stays skipped unless BOUNTY_INTEGRATION_DATABASE_URL is set for a local run.
import { ConfigService } from "@nestjs/config";
import { Keypair } from "@solana/web3.js";
import { InMemoryRateLimit } from "../anti-abuse/in-memory-rate-limit";
import { DatabaseService } from "../../database/database.service";
import { AuthService } from "../auth/auth.service";
import { PrismaAuthRepository } from "../auth/prisma-auth.repository";
import { decryptAnswer, parseAnswerKey } from "./answer-cipher";
import { BountiesService } from "./bounties.service";
import { PrismaBountyRepository } from "./prisma-bounty.repository";

const databaseUrl = process.env.BOUNTY_INTEGRATION_DATABASE_URL;
const describeNeon = databaseUrl ? describe : describe.skip;

async function sign(wallet: Keypair, message: string): Promise<string> {
  const signature = await wallet.signBytes(new TextEncoder().encode(message));
  return Buffer.from(signature).toString("base64url");
}

describeNeon("bounty Prisma repository on Neon", () => {
  let database: DatabaseService;

  beforeAll(async () => {
    database = new DatabaseService({ url: databaseUrl ?? null });
    await database.onModuleInit();
    if (database.status !== "up" || !database.activeClient) {
      throw new Error("Neon development database did not become ready.");
    }
    const rows = await database.activeClient.$queryRawUnsafe("select current_database() as database");
    const databaseName = Array.isArray(rows) && isRecord(rows[0]) ? rows[0].database : undefined;
    if (databaseName !== "neondb") {
      throw new Error("Refusing bounty integration because the connected database is not the development database.");
    }
  });

  afterAll(async () => {
    await database?.onModuleDestroy();
  });

  it("creates, hides, and updates a draft through Prisma", async () => {
    const key = process.env.ANSWER_ENCRYPTION_KEY;
    if (!key) {
      throw new Error("ANSWER_ENCRYPTION_KEY is not configured.");
    }
    const auth = new AuthService(new PrismaAuthRepository(database), new InMemoryRateLimit());
    const ownerWallet = await Keypair.generate();
    const otherWallet = await Keypair.generate();
    const owner = await login(auth, ownerWallet);
    const other = await login(auth, otherWallet);
    const service = new BountiesService(new PrismaBountyRepository(database), configFor(key));
    const answer = `neon-${randomBytes(8).toString("hex")}`;
    const input = draftInput(answer);

    const created = await service.create(owner.id, { ...input, creatorId: other.id, status: "active" });
    expect(created.status).toBe("draft");
    expect(created.expectedAnswer).toBe(answer);
    expect(created.rewardLamports).toBe("10000000");
    expect(created.principalLamports).toBe("1000000000");
    expect(created.commissionLamports).toBe("50000000");

    const stored = await raw(database).$queryRawUnsafe(
      "select expected_answer_ciphertext, encryption_key_id from bounty_questions where bounty_id = $1::uuid",
      created.id,
    );
    const question = Array.isArray(stored) ? stored[0] : undefined;
    if (!isRecord(question) || typeof question.expected_answer_ciphertext !== "string") {
      throw new Error("The question row was not stored.");
    }
    expect(question.encryption_key_id).toBe("primary");
    expect(question.expected_answer_ciphertext).not.toContain(answer);
    expect(decryptAnswer(question.expected_answer_ciphertext, parseAnswerKey(key))).toBe(answer);

    const audits = await raw(database).$queryRawUnsafe(
      "select action, metadata::text as metadata from audit_logs where entity_id = $1::uuid order by created_at asc",
      created.id,
    );
    expect(Array.isArray(audits) && audits[0] && isRecord(audits[0]) ? audits[0].action : undefined).toBe("bounty.draft_saved");
    expect(JSON.stringify(audits)).not.toContain(answer);

    const active = await service.active();
    expect(active.some((bounty) => bounty.id === created.id)).toBe(false);
    expect(JSON.stringify(active)).not.toContain(answer);

    await expect(service.owned(other.id, created.id)).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    await expect(service.update(other.id, created.id, input)).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    const otherList = await service.mine(other.id);
    expect(otherList.some((bounty) => bounty.id === created.id)).toBe(false);

    const updated = await service.update(owner.id, created.id, { ...input, title: "Neon draft revised", description: "Revised on Neon." });
    expect(updated.title).toBe("Neon draft revised");
    expect(updated.description).toBe("Revised on Neon.");
    expect(updated.status).toBe("draft");
    expect(updated.expectedAnswer).toBe(answer);
    const reread = await service.owned(owner.id, created.id);
    expect(reread.title).toBe("Neon draft revised");

    const updatedAudits = await raw(database).$queryRawUnsafe(
      "select action from audit_logs where entity_id = $1::uuid order by created_at asc",
      created.id,
    );
    const actions = Array.isArray(updatedAudits) ? updatedAudits.filter(isRecord).map((row) => row.action) : [];
    expect(actions).toEqual(["bounty.draft_saved", "bounty.draft_updated"]);
    await expect(service.activate(owner.id, created.id)).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });
});

function configFor(key: string): ConfigService {
  return {
    get: (name: string) => (name === "secrets.answerEncryptionKey" ? key : undefined),
  } as ConfigService;
}

async function login(auth: AuthService, wallet: Keypair): Promise<{ id: string }> {
  const issued = await auth.issueNonce(wallet.publicKey.toBase58());
  const result = await auth.login(wallet.publicKey.toBase58(), await sign(wallet, issued.message));
  return result.user;
}

function draftInput(answer: string) {
  return {
    title: "Neon draft validation",
    description: "Created by the Neon bounty repository test.",
    instructions: "No transfer is requested.",
    prompt: "What is two plus two?",
    category: "mathematics" as const,
    expectedAnswer: answer,
    verificationMethod: "numeric_exact" as const,
    rewardSol: "0.01",
    maxRewardedSolvers: 100,
    attemptLimit: 3,
    deadline: "2099-01-01T00:00:00.000Z",
  };
}

function raw(database: DatabaseService): { $queryRawUnsafe(query: string, ...values: unknown[]): Promise<unknown> } {
  const client = database.activeClient as { $queryRawUnsafe(query: string, ...values: unknown[]): Promise<unknown> } | null;
  if (!client) {
    throw new Error("Neon development database is not connected.");
  }
  return client;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
