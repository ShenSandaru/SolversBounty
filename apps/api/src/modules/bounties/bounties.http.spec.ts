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
import { BountiesModule } from "./bounties.module";
import { FakeBountyDb } from "./fake-bounty-db";
import { PrismaBountyRepository } from "./prisma-bounty.repository";

const answerKey = Buffer.alloc(32, 9).toString("base64url");

function draftBody(overrides: Record<string, unknown> = {}) {
  return {
    title: "The archive door",
    description: "Three labels, one of them true.",
    instructions: "Submit the door letter.",
    prompt: "Which door leads to the archive?",
    category: "logic",
    expectedAnswer: "door-A",
    verificationMethod: "exact",
    rewardSol: "0.01",
    maxRewardedSolvers: 100,
    attemptLimit: 3,
    deadline: "2099-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function setCookieList(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

async function login(app: INestApplication, wallet: Keypair): Promise<{ cookie: string; csrf: string }> {
  const address = wallet.publicKey.toBase58();
  const issued = await request(app.getHttpServer()).post("/auth/nonce").send({ walletAddress: address });
  const signature = await wallet.signBytes(new TextEncoder().encode(issued.body.message as string));
  const response = await request(app.getHttpServer()).post("/auth/login").send({
    walletAddress: address,
    signature: Buffer.from(signature).toString("base64url"),
  });
  const cookies = setCookieList(response.headers["set-cookie"]);
  const session = cookies.find((value) => value.startsWith(`${SESSION_COOKIE}=`))?.split(";")[0] ?? "";
  const csrf = cookies.find((value) => value.startsWith(`${CSRF_COOKIE}=`))?.split(";")[0] ?? "";
  return { cookie: `${session}; ${csrf}`, csrf: response.body.csrfToken as string };
}

describe("bounty drafts", () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.ANSWER_ENCRYPTION_KEY = answerKey;
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [secretsConfig] }),
        AntiAbuseModule,
        BountiesModule,
      ],
    })
      .overrideProvider(PrismaAuthRepository)
      .useValue(PrismaAuthRepository.fromClient(new FakeAuthPrisma()))
      .overrideProvider(PrismaBountyRepository)
      .useValue(new FakeBountyDb())
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    delete process.env.ANSWER_ENCRYPTION_KEY;
    await app.close();
  });

  it("creates a draft for the session user and hides it from the active list", async () => {
    const owner = await Keypair.generate();
    const other = await Keypair.generate();
    const ownerSession = await login(app, owner);
    const otherSession = await login(app, other);

    const unauthenticated = await request(app.getHttpServer()).post("/bounties").send(draftBody());
    expect(unauthenticated.status).toBe(401);

    const missingToken = await request(app.getHttpServer()).post("/bounties").set("Cookie", ownerSession.cookie).send(draftBody());
    expect(missingToken.status).toBe(403);

    const invalid = await request(app.getHttpServer())
      .post("/bounties")
      .set("Cookie", ownerSession.cookie)
      .set(CSRF_HEADER, ownerSession.csrf)
      .send(draftBody({ title: "", deadline: "2020-01-01T00:00:00.000Z", rewardSol: "0" }));
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("VALIDATION_ERROR");
    expect(JSON.stringify(invalid.body)).not.toContain("door-A");

    const created = await request(app.getHttpServer())
      .post("/bounties")
      .set("Cookie", ownerSession.cookie)
      .set(CSRF_HEADER, ownerSession.csrf)
      .send(draftBody({ creatorId: otherSession.csrf, status: "active" }));
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("draft");
    expect(created.body.expectedAnswer).toBe("door-A");
    expect(created.body.rewardLamports).toBe("10000000");
    expect(created.body.principalLamports).toBe("1000000000");
    expect(created.body.commissionLamports).toBe("50000000");
    expect(created.body.creatorId).toBeUndefined();

    const active = await request(app.getHttpServer()).get("/bounties");
    expect(active.status).toBe(200);
    expect(active.body).toEqual([]);
    expect(JSON.stringify(active.body)).not.toContain("door-A");

    const hidden = await request(app.getHttpServer())
      .get(`/bounties/${created.body.id as string}`)
      .set("Cookie", otherSession.cookie);
    expect(hidden.status).toBe(404);
    expect(JSON.stringify(hidden.body)).not.toContain("door-A");

    const visible = await request(app.getHttpServer())
      .get(`/bounties/${created.body.id as string}`)
      .set("Cookie", ownerSession.cookie);
    expect(visible.body.expectedAnswer).toBe("door-A");

    const mine = await request(app.getHttpServer()).get("/bounties/mine").set("Cookie", otherSession.cookie);
    expect(mine.body).toEqual([]);
    const ownerList = await request(app.getHttpServer()).get("/bounties/mine").set("Cookie", ownerSession.cookie);
    expect(ownerList.body).toHaveLength(1);

    const updated = await request(app.getHttpServer())
      .patch(`/bounties/${created.body.id as string}`)
      .set("Cookie", ownerSession.cookie)
      .set(CSRF_HEADER, ownerSession.csrf)
      .send(draftBody({ title: "Revised archive door", expectedAnswer: "door-B" }));
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe("Revised archive door");
    expect(updated.body.expectedAnswer).toBe("door-B");
    expect(updated.body.status).toBe("draft");

    const blocked = await request(app.getHttpServer())
      .patch(`/bounties/${created.body.id as string}`)
      .set("Cookie", otherSession.cookie)
      .set(CSRF_HEADER, otherSession.csrf)
      .send(draftBody());
    expect(blocked.status).toBe(404);

    const activation = await request(app.getHttpServer())
      .post(`/bounties/${created.body.id as string}/activate`)
      .set("Cookie", ownerSession.cookie)
      .set(CSRF_HEADER, ownerSession.csrf);
    expect(activation.status).toBe(409);
    expect(activation.body.code).toBe("CONFLICT");
    const stillDraft = await request(app.getHttpServer())
      .get(`/bounties/${created.body.id as string}`)
      .set("Cookie", ownerSession.cookie);
    expect(stillDraft.body.status).toBe("draft");
  });
});
