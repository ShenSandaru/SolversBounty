import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { APP_NAME } from "@solversbounty/shared";
import request from "supertest";
import { DatabaseService } from "../database/database.service";
import { HealthController } from "./health.controller";

describe("GET /health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DatabaseService, useValue: { status: "not_configured" } }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the shared health payload", async () => {
    const response = await request(app.getHttpServer()).get("/health").expect(200);
    expect(response.body).toEqual({
      status: "ok",
      service: APP_NAME,
    });
  });

  it("reports readiness without a configured database", async () => {
    const response = await request(app.getHttpServer()).get("/health/ready").expect(200);
    expect(response.body).toEqual({
      status: "ready",
      checks: { database: "not_configured" },
    });
  });
});

describe("GET /health/ready when PostgreSQL is down", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DatabaseService, useValue: { status: "down" } }],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns not ready and does not include a connection string", async () => {
    const response = await request(app.getHttpServer()).get("/health/ready").expect(503);
    expect(response.body).toEqual({
      status: "not_ready",
      checks: { database: "down" },
    });
    expect(JSON.stringify(response.body)).not.toContain("postgres");
  });
});
