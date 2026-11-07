import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { Keypair } from "@solana/web3.js";
import request from "supertest";
import { ApiExceptionFilter } from "../../common/filters/api-exception.filter";
import { secretsConfig, solanaConfig } from "../../config/app.config";
import { AntiAbuseModule } from "../anti-abuse/anti-abuse.module";
import { CSRF_COOKIE, CSRF_HEADER, SESSION_COOKIE } from "../auth/auth.constants";
import { FakeAuthPrisma } from "../auth/fake-auth-prisma";
import { PrismaAuthRepository } from "../auth/prisma-auth.repository";
import { SOLANA_TRANSFER_GATEWAY, type SolanaTransferGateway } from "../solana/solana-transfer.gateway";
import { BountiesModule } from "./bounties.module";
import { FakeBountyDb } from "./fake-bounty-db";
import { PrismaBountyRepository } from "./prisma-bounty.repository";
import type { TransferLookup } from "./observed-transfer";

const answerKey = Buffer.alloc(32, 9).toString("base64url");

class ScriptedGateway implements SolanaTransferGateway {
  steps: TransferLookup[] = [];

  lookup(): Promise<TransferLookup> {
    return Promise.resolve(this.steps.shift() ?? { outcome: "unavailable" });
  }

  recentBlockhash(): Promise<string | null> {
    return Promise.resolve(null);
  }

  submit(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

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

function signature(seed: string): string {
  return (seed + "A".repeat(88)).slice(0, 87);
}

function observed(wallet: string, destination: string, memo: string, lamports: bigint, patch: Partial<Extract<TransferLookup, { outcome: "observed" }>["transfer"]> = {}): TransferLookup {
  return {
    outcome: "observed",
    transfer: {
      cluster: "devnet",
      commitment: "confirmed",
      failed: false,
      feePayer: wallet,
      memo,
      transfers: [{ source: wallet, destination, lamports }],
      ...patch,
    },
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

describe("devnet funding", () => {
  let app: INestApplication;
  let treasury = "";
  const gateway = new ScriptedGateway();

  beforeEach(async () => {
    treasury = (await Keypair.generate()).publicKey.toBase58();
    process.env.ANSWER_ENCRYPTION_KEY = answerKey;
    process.env.TREASURY_PUBLIC_KEY = treasury;
    process.env.SOLANA_RPC_URL = "https://api.devnet.solana.com";
    gateway.steps = [];
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [secretsConfig, solanaConfig] }),
        AntiAbuseModule,
        BountiesModule,
      ],
    })
      .overrideProvider(PrismaAuthRepository)
      .useValue(PrismaAuthRepository.fromClient(new FakeAuthPrisma()))
      .overrideProvider(PrismaBountyRepository)
      .useValue(new FakeBountyDb())
      .overrideProvider(SOLANA_TRANSFER_GATEWAY)
      .useValue(gateway)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    delete process.env.ANSWER_ENCRYPTION_KEY;
    delete process.env.TREASURY_PUBLIC_KEY;
    delete process.env.SOLANA_RPC_URL;
    await app.close();
  });

  it("verifies the two obligations separately and activates once", async () => {
    const ownerWallet = await Keypair.generate();
    const otherWallet = await Keypair.generate();
    const owner = await login(app, ownerWallet);
    const other = await login(app, otherWallet);
    const created = await request(app.getHttpServer())
      .post("/bounties")
      .set("Cookie", owner.cookie)
      .set(CSRF_HEADER, owner.csrf)
      .send(draftBody());
    const bountyId = created.body.id as string;
    const funding = await request(app.getHttpServer()).get(`/bounties/${bountyId}/funding`).set("Cookie", owner.cookie);
    expect(funding.status).toBe(200);
    expect(funding.body.custody).toBe("custodial");
    expect(funding.body.network).toBe("devnet");
    expect(funding.body.treasuryAddress).toBe(treasury);
    expect(funding.body.rewardPoolLamports).toBe("1000000000");
    expect(funding.body.commissionLamports).toBe("50000000");
    expect(funding.body.totalFundingLamports).toBe("1050000000");
    expect(funding.body.buckets.funded).toBe("0");
    expect(funding.body.canActivate).toBe(false);
    expect(JSON.stringify(funding.body)).not.toContain("door-A");

    const hidden = await request(app.getHttpServer()).get(`/bounties/${bountyId}/funding`).set("Cookie", other.cookie);
    expect(hidden.status).toBe(404);

    const poolReference = funding.body.obligations.find((item: { purpose: string }) => item.purpose === "reward_pool").depositReference as string;
    const commissionReference = funding.body.obligations.find((item: { purpose: string }) => item.purpose === "commission").depositReference as string;
    const poolSignature = signature("2");
    const commissionSignature = signature("3");

    gateway.steps = [observed(owner.address, treasury, poolReference, 999n)];
    const short = await request(app.getHttpServer())
      .post(`/bounties/${bountyId}/funding/reward-pool`)
      .set("Cookie", owner.cookie)
      .set(CSRF_HEADER, owner.csrf)
      .send({ signature: poolSignature });
    expect(short.status).toBe(409);

    gateway.steps = [observed(other.address, treasury, poolReference, 1_000_000_000n)];
    const wrongSender = await request(app.getHttpServer())
      .post(`/bounties/${bountyId}/funding/reward-pool`)
      .set("Cookie", owner.cookie)
      .set(CSRF_HEADER, owner.csrf)
      .send({ signature: poolSignature });
    expect(wrongSender.status).toBe(409);

    gateway.steps = [observed(owner.address, treasury, poolReference, 1_000_000_000n, { transfers: [{ source: owner.address, destination: other.address, lamports: 1_000_000_000n }] })];
    const wrongTreasury = await request(app.getHttpServer())
      .post(`/bounties/${bountyId}/funding/reward-pool`)
      .set("Cookie", owner.cookie)
      .set(CSRF_HEADER, owner.csrf)
      .send({ signature: poolSignature });
    expect(wrongTreasury.status).toBe(409);

    gateway.steps = [observed(owner.address, treasury, poolReference, 1_000_000_000n, { cluster: "other" })];
    const wrongNetwork = await request(app.getHttpServer())
      .post(`/bounties/${bountyId}/funding/reward-pool`)
      .set("Cookie", owner.cookie)
      .set(CSRF_HEADER, owner.csrf)
      .send({ signature: poolSignature });
    expect(wrongNetwork.status).toBe(409);

    gateway.steps = [observed(owner.address, treasury, poolReference, 1_000_000_000n, { commitment: "processed" })];
    const processed = await request(app.getHttpServer())
      .post(`/bounties/${bountyId}/funding/reward-pool`)
      .set("Cookie", owner.cookie)
      .set(CSRF_HEADER, owner.csrf)
      .send({ signature: poolSignature });
    expect(processed.status).toBe(409);
    expect(processed.body.message).toContain("not confirmed");

    gateway.steps = [{ outcome: "unavailable" }];
    const timeout = await request(app.getHttpServer())
      .post(`/bounties/${bountyId}/funding/reward-pool`)
      .set("Cookie", owner.cookie)
      .set(CSRF_HEADER, owner.csrf)
      .send({ signature: poolSignature });
    expect(timeout.status).toBe(503);
    expect(timeout.body.message).toContain("same signature");

    gateway.steps = [observed(owner.address, treasury, poolReference, 1_000_000_000n)];
    const pool = await request(app.getHttpServer())
      .post(`/bounties/${bountyId}/funding/reward-pool`)
      .set("Cookie", owner.cookie)
      .set(CSRF_HEADER, owner.csrf)
      .send({ signature: poolSignature });
    expect(pool.status).toBe(201);
    expect(pool.body.buckets.funded).toBe("1000000000");
    expect(pool.body.buckets.refundable).toBe("1000000000");
    expect(pool.body.canActivate).toBe(false);
    expect(pool.body.status).toBe("funding_pending");

    const replay = await request(app.getHttpServer())
      .post(`/bounties/${bountyId}/funding/reward-pool`)
      .set("Cookie", owner.cookie)
      .set(CSRF_HEADER, owner.csrf)
      .send({ signature: poolSignature });
    expect(replay.status).toBe(201);
    expect(replay.body.buckets.funded).toBe("1000000000");

    const reused = await request(app.getHttpServer())
      .post(`/bounties/${bountyId}/funding/commission`)
      .set("Cookie", owner.cookie)
      .set(CSRF_HEADER, owner.csrf)
      .send({ signature: poolSignature });
    expect(reused.status).toBe(409);

    const partial = await request(app.getHttpServer())
      .post(`/bounties/${bountyId}/activate`)
      .set("Cookie", owner.cookie)
      .set(CSRF_HEADER, owner.csrf);
    expect(partial.status).toBe(409);
    expect((await request(app.getHttpServer()).get("/bounties")).body).toEqual([]);

    gateway.steps = [observed(owner.address, treasury, commissionReference, 50_000_000n, { failed: true })];
    const failed = await request(app.getHttpServer())
      .post(`/bounties/${bountyId}/funding/commission`)
      .set("Cookie", owner.cookie)
      .set(CSRF_HEADER, owner.csrf)
      .send({ signature: commissionSignature });
    expect(failed.status).toBe(409);

    const failedAgain = await request(app.getHttpServer())
      .post(`/bounties/${bountyId}/funding/commission`)
      .set("Cookie", owner.cookie)
      .set(CSRF_HEADER, owner.csrf)
      .send({ signature: commissionSignature });
    expect(failedAgain.status).toBe(409);

    const replacement = signature("4");
    gateway.steps = [observed(owner.address, treasury, commissionReference, 50_000_000n)];
    const commission = await request(app.getHttpServer())
      .post(`/bounties/${bountyId}/funding/commission`)
      .set("Cookie", owner.cookie)
      .set(CSRF_HEADER, owner.csrf)
      .send({ signature: replacement });
    expect(commission.status).toBe(201);
    expect(commission.body.buckets.funded).toBe("1000000000");
    expect(commission.body.canActivate).toBe(true);
    expect(commission.body.obligations.find((item: { purpose: string }) => item.purpose === "commission").status).toBe("confirmed");

    const stranger = await request(app.getHttpServer())
      .post(`/bounties/${bountyId}/activate`)
      .set("Cookie", other.cookie)
      .set(CSRF_HEADER, other.csrf);
    expect(stranger.status).toBe(404);

    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post(`/bounties/${bountyId}/activate`).set("Cookie", owner.cookie).set(CSRF_HEADER, owner.csrf),
      request(app.getHttpServer()).post(`/bounties/${bountyId}/activate`).set("Cookie", owner.cookie).set(CSRF_HEADER, owner.csrf),
    ]);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.status).toBe("active");
    expect(second.body.status).toBe("active");
    const listed = await request(app.getHttpServer()).get("/bounties");
    expect(listed.body).toHaveLength(1);
    expect(JSON.stringify(listed.body)).not.toContain("door-A");
    const after = await request(app.getHttpServer()).get(`/bounties/${bountyId}/funding`).set("Cookie", owner.cookie);
    expect(after.body.buckets.funded).toBe("1000000000");
    expect(after.body.canActivate).toBe(false);
  });

  it("rejects a zero commission before any transfer", async () => {
    const owner = await login(app, await Keypair.generate());
    const created = await request(app.getHttpServer())
      .post("/bounties")
      .set("Cookie", owner.cookie)
      .set(CSRF_HEADER, owner.csrf)
      .send(draftBody({ rewardSol: "0.000000001", maxRewardedSolvers: 1 }));
    const funding = await request(app.getHttpServer()).get(`/bounties/${created.body.id as string}/funding`).set("Cookie", owner.cookie);
    expect(funding.status).toBe(400);
  });
});
