import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { APP_NAME } from "@solversbounty/shared";
import request from "supertest";
import { HealthController } from "./health.controller";

describe("GET /health", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
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
});
