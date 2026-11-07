import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { Keypair } from "@solana/web3.js";
import request from "supertest";
import { ApiExceptionFilter } from "../../common/filters/api-exception.filter";
import { secretsConfig } from "../../config/app.config";
import { AntiAbuseModule } from "../anti-abuse/anti-abuse.module";
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE } from "../auth/auth.constants";
import { FakeAuthPrisma } from "../auth/fake-auth-prisma";
import { PrismaAuthRepository } from "../auth/prisma-auth.repository";
import { BountiesModule } from "../bounties/bounties.module";
import { FakeBountyDb } from "../bounties/fake-bounty-db";
import { PrismaBountyRepository } from "../bounties/prisma-bounty.repository";
import { SOLANA_TRANSFER_GATEWAY } from "../solana/solana-transfer.gateway";
import { SubmissionsModule } from "./submissions.module";

const answerKey = Buffer.alloc(32, 7).toString("base64url");

function draftBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "Archive door",
    description: "Three labels, one of them true.",
    instructions: "Submit the door letter.",
    prompt: "Which door leads to the archive?",
    category: "logic",
    expectedAnswer: "door-A",
    verificationMethod: "exact",
    rewardSol: "0.01",
    maxRewardedSolvers: 2,
    attemptLimit: 2,
    deadline: "2099-01-01T00:00:00.000Z",
    ...overrides,
  };
}

async function login(app: INestApplication, wallet: Keypair): Promise<{ cookie: string; csrf: string; address: string }> {
  const address = wallet.publicKey.toBase58();
  const issued = await request(app.getHttpServer()).post("/auth/nonce").send({ walletAddress: address });
  const signed = await wallet.signBytes(new TextEncoder().encode(issued.body.message as string));
  const response = await request(app.getHttpServer()).post("/auth/login").send({
    walletAddress: address,
    signature: Buffer.from(signed).toString("base64url"),
  });
  const cookies = Array.isArray(response.headers["set-cookie"]) ? response.headers["set-cookie"] : [response.headers["set-cookie"] ?? ""];
  const session = cookies.find((value) => value.startsWith(`${SESSION_COOKIE}=`))?.split(";")[0] ?? "";
  const csrf = cookies.find((value) => value.startsWith(`${CSRF_COOKIE}=`))?.split(";")[0] ?? "";
  return { cookie: `${session}; ${csrf}`, csrf: response.body.csrfToken as string, address };
}

describe("solver participation", () => {
  let app: INestApplication;
  let db: FakeBountyDb;

  beforeEach(async () => {
    process.env.ANSWER_ENCRYPTION_KEY = answerKey;
    db = new FakeBountyDb();
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [secretsConfig] }),
        AntiAbuseModule,
        BountiesModule,
        SubmissionsModule,
      ],
    })
      .overrideProvider(PrismaAuthRepository)
      .useValue(PrismaAuthRepository.fromClient(new FakeAuthPrisma()))
      .overrideProvider(PrismaBountyRepository)
      .useValue(db)
      .overrideProvider(SOLANA_TRANSFER_GATEWAY)
      .useValue({ lookup: () => Promise.resolve({ outcome: "unavailable" }) })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    delete process.env.ANSWER_ENCRYPTION_KEY;
    await app.close();
  });

  it("lists only active bounties and hides the expected answer", async () => {
    const creator = await login(app, await Keypair.generate());
    const created = await request(app.getHttpServer()).post("/bounties").set("cookie", creator.cookie).set(CSRF_HEADER, creator.csrf).send(draftBody());
    const cipher = await request(app.getHttpServer()).post("/bounties").set("cookie", creator.cookie).set(CSRF_HEADER, creator.csrf).send(draftBody({ title: "Cipher room", category: "ciphers", description: "A cipher." }));
    expect(created.status).toBe(201);
    db.rows.find((row) => row.id === created.body.id)!.status = "active";
    db.rows.find((row) => row.id === cipher.body.id)!.status = "active";
    const listed = await request(app.getHttpServer()).get("/bounties");
    expect(listed.body.map((item: { id: string }) => item.id).sort()).toEqual([created.body.id, cipher.body.id].sort());
    expect(JSON.stringify(listed.body)).not.toContain("door-A");
    expect(JSON.stringify(listed.body)).not.toContain("expectedAnswer");
    const filtered = await request(app.getHttpServer()).get("/bounties").query({ q: "cipher", category: "ciphers" });
    expect(filtered.body).toHaveLength(1);
    expect(filtered.body[0].title).toBe("Cipher room");
    const detail = await request(app.getHttpServer()).get(`/bounties/${created.body.id}/public`);
    expect(detail.status).toBe(200);
    expect(detail.body.prompt).toBe("Which door leads to the archive?");
    expect(JSON.stringify(detail.body)).not.toContain("door-A");
  });

  it("requires consent, verifies on the server, and reserves one reward", async () => {
    const creator = await login(app, await Keypair.generate());
    const solver = await login(app, await Keypair.generate());
    const other = await login(app, await Keypair.generate());
    const created = await request(app.getHttpServer()).post("/bounties").set("cookie", creator.cookie).set(CSRF_HEADER, creator.csrf).send(draftBody({ maxRewardedSolvers: 2, attemptLimit: 2 }));
    const bountyId = created.body.id as string;
    const row = db.rows.find((item) => item.id === bountyId)!;
    row.status = "active";
    db.depositReward(bountyId, 20_000_000n);

    const anonymous = await request(app.getHttpServer()).post(`/bounties/${bountyId}/sessions`).send({});
    expect(anonymous.status).toBe(401);
    const early = await request(app.getHttpServer()).post(`/bounties/${bountyId}/sessions`).set("cookie", solver.cookie).set(CSRF_HEADER, solver.csrf).send({});
    expect(early.status).toBe(409);

    const consent = await request(app.getHttpServer()).post(`/bounties/${bountyId}/consent`).set("cookie", solver.cookie).set(CSRF_HEADER, solver.csrf).send({ accepted: true });
    expect(consent.body.policyVersion).toBe("research-consent-v1");
    const started = await request(app.getHttpServer()).post(`/bounties/${bountyId}/sessions`).set("cookie", solver.cookie).set(CSRF_HEADER, solver.csrf).send({});
    expect(started.status).toBe(201);
    const again = await request(app.getHttpServer()).post(`/bounties/${bountyId}/sessions`).set("cookie", solver.cookie).set(CSRF_HEADER, solver.csrf).send({ startedAt: "2000-01-01T00:00:00.000Z" });
    expect(again.body.id).toBe(started.body.id);
    expect(again.body.startedAt).not.toContain("2000");
    expect(JSON.stringify(started.body)).not.toContain("door-A");

    const wrong = await request(app.getHttpServer()).post(`/sessions/${started.body.id}/submissions`).set("cookie", solver.cookie).set(CSRF_HEADER, solver.csrf).send({ answer: "door-B", isCorrect: true, submittedAt: "1999-01-01T00:00:00.000Z" });
    expect(wrong.status).toBe(201);
    expect(wrong.body.latest.isCorrect).toBe(false);
    expect(wrong.body.remainingAttempts).toBe(1);
    expect(wrong.body.latest.submittedAt).toBeUndefined();

    const correct = await request(app.getHttpServer()).post(`/sessions/${started.body.id}/submissions`).set("cookie", solver.cookie).set(CSRF_HEADER, solver.csrf).send({ answer: "door-A", isCorrect: false });
    expect(correct.body.latest.isCorrect).toBe(true);
    expect(correct.body.latest.rewardStatus).toBe("pending");
    expect(correct.body.status).toBe("completed");
    expect(new Date(correct.body.latest ? started.body.startedAt : started.body.startedAt).getTime()).toBeLessThanOrEqual(Date.now());

    const replay = await request(app.getHttpServer()).post(`/sessions/${started.body.id}/submissions`).set("cookie", solver.cookie).set(CSRF_HEADER, solver.csrf).send({ answer: "door-A" });
    expect(replay.status).toBe(409);
    const hidden = await request(app.getHttpServer()).get(`/sessions/${started.body.id}`).set("cookie", other.cookie);
    expect(hidden.status).toBe(404);
    const result = await request(app.getHttpServer()).get(`/sessions/${started.body.id}/result`).set("cookie", solver.cookie);
    expect(result.body.latest.isCorrect).toBe(true);
    expect(JSON.stringify(result.body)).not.toContain("door-A");

    const analytics = await request(app.getHttpServer()).get(`/bounties/${bountyId}/analytics`).set("cookie", creator.cookie);
    expect(analytics.body).toEqual({
      participantCount: 1,
      correctCount: 1,
      incorrectCount: 1,
      attemptCount: 2,
      averageCompletionTimeMs: expect.any(Number),
      accuracy: "0.5000",
    });
    expect(JSON.stringify(analytics.body)).not.toContain(solver.address);
    const stranger = await request(app.getHttpServer()).get(`/bounties/${bountyId}/analytics`).set("cookie", solver.cookie);
    expect(stranger.status).toBe(404);
  });

  it("stops at the attempt limit and at the reward cap", async () => {
    const creator = await login(app, await Keypair.generate());
    const first = await login(app, await Keypair.generate());
    const second = await login(app, await Keypair.generate());
    const created = await request(app.getHttpServer()).post("/bounties").set("cookie", creator.cookie).set(CSRF_HEADER, creator.csrf).send(draftBody({ maxRewardedSolvers: 1, attemptLimit: 1 }));
    const bountyId = created.body.id as string;
    db.rows.find((item) => item.id === bountyId)!.status = "active";
    db.depositReward(bountyId, 10_000_000n);
    await request(app.getHttpServer()).post(`/bounties/${bountyId}/consent`).set("cookie", first.cookie).set(CSRF_HEADER, first.csrf).send({ accepted: true });
    await request(app.getHttpServer()).post(`/bounties/${bountyId}/consent`).set("cookie", second.cookie).set(CSRF_HEADER, second.csrf).send({ accepted: true });
    const one = await request(app.getHttpServer()).post(`/bounties/${bountyId}/sessions`).set("cookie", first.cookie).set(CSRF_HEADER, first.csrf).send({});
    const two = await request(app.getHttpServer()).post(`/bounties/${bountyId}/sessions`).set("cookie", second.cookie).set(CSRF_HEADER, second.csrf).send({});
    const [left, right] = await Promise.all([
      request(app.getHttpServer()).post(`/sessions/${one.body.id}/submissions`).set("cookie", first.cookie).set(CSRF_HEADER, first.csrf).send({ answer: "door-A" }),
      request(app.getHttpServer()).post(`/sessions/${two.body.id}/submissions`).set("cookie", second.cookie).set(CSRF_HEADER, second.csrf).send({ answer: "door-A" }),
    ]);
    const statuses = [left.status, right.status].sort();
    expect(statuses).toEqual([201, 409]);
    const winner = left.status === 201 ? left : right;
    expect(winner.body.latest.rewardStatus).toBe("pending");
    const blocked = await request(app.getHttpServer()).post(`/bounties/${bountyId}/sessions`).set("cookie", creator.cookie).set(CSRF_HEADER, creator.csrf).send({});
    expect(blocked.status).toBe(409);

    const limited = await request(app.getHttpServer()).post("/bounties").set("cookie", creator.cookie).set(CSRF_HEADER, creator.csrf).send(draftBody({ title: "Second", attemptLimit: 1, maxRewardedSolvers: 1 }));
    const limitedId = limited.body.id as string;
    db.rows.find((item) => item.id === limitedId)!.status = "active";
    db.depositReward(limitedId, 0n);
    await request(app.getHttpServer()).post(`/bounties/${limitedId}/consent`).set("cookie", first.cookie).set(CSRF_HEADER, first.csrf).send({ accepted: true });
    const session = await request(app.getHttpServer()).post(`/bounties/${limitedId}/sessions`).set("cookie", first.cookie).set(CSRF_HEADER, first.csrf).send({});
    const missed = await request(app.getHttpServer()).post(`/sessions/${session.body.id}/submissions`).set("cookie", first.cookie).set(CSRF_HEADER, first.csrf).send({ answer: "nope" });
    expect(missed.body.status).toBe("completed");
    const extra = await request(app.getHttpServer()).post(`/sessions/${session.body.id}/submissions`).set("cookie", first.cookie).set(CSRF_HEADER, first.csrf).send({ answer: "door-A" });
    expect(extra.status).toBe(409);
  });

  it("rejects an expired bounty and an underfunded correct answer without a second reward", async () => {
    const creator = await login(app, await Keypair.generate());
    const solver = await login(app, await Keypair.generate());
    const created = await request(app.getHttpServer()).post("/bounties").set("cookie", creator.cookie).set(CSRF_HEADER, creator.csrf).send(draftBody());
    const bountyId = created.body.id as string;
    const row = db.rows.find((item) => item.id === bountyId)!;
    row.status = "active";
    row.deadline = new Date("2001-01-01T00:00:00.000Z");
    await request(app.getHttpServer()).post(`/bounties/${bountyId}/consent`).set("cookie", solver.cookie).set(CSRF_HEADER, solver.csrf).send({ accepted: true });
    const expired = await request(app.getHttpServer()).post(`/bounties/${bountyId}/sessions`).set("cookie", solver.cookie).set(CSRF_HEADER, solver.csrf).send({});
    expect(expired.status).toBe(409);
    const listed = await request(app.getHttpServer()).get("/bounties");
    expect(listed.body).toEqual([]);

    const funded = await request(app.getHttpServer()).post("/bounties").set("cookie", creator.cookie).set(CSRF_HEADER, creator.csrf).send(draftBody({ title: "Thin pool", maxRewardedSolvers: 2 }));
    const fundedId = funded.body.id as string;
    db.rows.find((item) => item.id === fundedId)!.status = "active";
    db.depositReward(fundedId, 10_000_000n);
    const other = await login(app, await Keypair.generate());
    for (const person of [solver, other]) {
      await request(app.getHttpServer()).post(`/bounties/${fundedId}/consent`).set("cookie", person.cookie).set(CSRF_HEADER, person.csrf).send({ accepted: true });
    }
    const first = await request(app.getHttpServer()).post(`/bounties/${fundedId}/sessions`).set("cookie", solver.cookie).set(CSRF_HEADER, solver.csrf).send({});
    const second = await request(app.getHttpServer()).post(`/bounties/${fundedId}/sessions`).set("cookie", other.cookie).set(CSRF_HEADER, other.csrf).send({});
    const reserved = await request(app.getHttpServer()).post(`/sessions/${first.body.id}/submissions`).set("cookie", solver.cookie).set(CSRF_HEADER, solver.csrf).send({ answer: "door-A" });
    const ineligible = await request(app.getHttpServer()).post(`/sessions/${second.body.id}/submissions`).set("cookie", other.cookie).set(CSRF_HEADER, other.csrf).send({ answer: "door-A" });
    expect(reserved.body.latest.rewardStatus).toBe("pending");
    expect(ineligible.body.latest.isCorrect).toBe(true);
    expect(ineligible.body.latest.ineligibilityReason).toBe("insufficient_refundable");
    expect(ineligible.body.latest.rewardStatus).toBeNull();
    expect(JSON.stringify(ineligible.body)).not.toContain("door-A");
  });
});
