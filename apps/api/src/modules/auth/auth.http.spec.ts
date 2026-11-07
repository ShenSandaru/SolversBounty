import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Keypair } from "@solana/web3.js";
import request from "supertest";
import { ApiExceptionFilter } from "../../common/filters/api-exception.filter";
import { AntiAbuseModule } from "../anti-abuse/anti-abuse.module";
import { AuthController } from "./auth.controller";
import { SESSION_COOKIE } from "./auth.constants";
import { AuthService } from "./auth.service";
import { FakeAuthPrisma } from "./fake-auth-prisma";
import { PrismaAuthRepository } from "./prisma-auth.repository";

describe("auth HTTP", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AntiAbuseModule],
      controllers: [AuthController],
      providers: [AuthService, { provide: PrismaAuthRepository, useValue: PrismaAuthRepository.fromClient(new FakeAuthPrisma()) }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("AUTH-008 returns an authentication error that does not echo the nonce", async () => {
    const wallet = await Keypair.generate();
    const address = wallet.publicKey.toBase58();
    const issued = await request(app.getHttpServer()).post("/auth/nonce").send({ walletAddress: address });
    expect(issued.status).toBe(201);
    expect(issued.body.message).toContain("does not approve a SOL transfer");

    const rejected = await request(app.getHttpServer()).post("/auth/login").send({
      walletAddress: address,
      signature: Buffer.alloc(64, 1).toString("base64url"),
    });
    expect(rejected.status).toBe(401);
    expect(rejected.body.code).toBe("AUTH_REJECTED");
    expect(JSON.stringify(rejected.body)).not.toContain(issued.body.nonce as string);
  });

  it("AUTH-006 sets an HttpOnly cookie and logout revokes it", async () => {
    const wallet = await Keypair.generate();
    const address = wallet.publicKey.toBase58();
    const issued = await request(app.getHttpServer()).post("/auth/nonce").send({ walletAddress: address });
    const signature = await wallet.signBytes(new TextEncoder().encode(issued.body.message as string));
    const login = await request(app.getHttpServer()).post("/auth/login").send({
      walletAddress: address,
      signature: Buffer.from(signature).toString("base64url"),
    });
    expect(login.status).toBe(201);
    const cookie = login.headers["set-cookie"]?.[0] ?? "";
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).not.toContain("Domain=");
    expect(login.body).toEqual({ walletAddress: address, role: "user" });

    const session = await request(app.getHttpServer()).get("/auth/session").set("Cookie", cookie.split(";")[0] ?? "");
    expect(session.status).toBe(200);
    expect(session.body.walletAddress).toBe(address);

    const missing = await request(app.getHttpServer()).get("/auth/session");
    expect(missing.status).toBe(401);
    expect(missing.body.code).toBe("UNAUTHENTICATED");

    await request(app.getHttpServer()).post("/auth/logout").set("Cookie", cookie.split(";")[0] ?? "").expect(201);
    const after = await request(app.getHttpServer()).get("/auth/session").set("Cookie", cookie.split(";")[0] ?? "");
    expect(after.status).toBe(401);
  });
});
