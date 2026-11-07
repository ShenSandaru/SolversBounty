import { Test } from "@nestjs/testing";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { APP_NAME } from "@solversbounty/shared";
import request from "supertest";
import { AppModule } from "./app.module";
import { configureApp } from "./bootstrap";
import { DatabaseService } from "./database/database.service";

describe("AppModule", () => {
  let app: NestExpressApplication;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousNodeEnv = process.env.NODE_ENV;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DatabaseService)
      .useValue({ status: "not_configured", onModuleInit: async () => undefined, onModuleDestroy: async () => undefined })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl;
    }
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  });

  it("initializes the infrastructure shell and serves health plus OpenAPI", async () => {
    const health = await request(app.getHttpServer()).get("/health").expect(200);
    expect(health.body).toEqual({ status: "ok", service: APP_NAME });
    expect(health.headers["x-content-type-options"]).toBe("nosniff");
    expect(health.headers["x-request-id"]).toEqual(expect.any(String));

    const ready = await request(app.getHttpServer()).get("/health/ready").expect(200);
    expect(ready.body.checks.database).toBe("not_configured");

    const docs = await request(app.getHttpServer()).get("/docs-json").expect(200);
    expect(docs.body.paths["/health"]).toBeDefined();
    expect(docs.body.paths["/health/ready"]).toBeDefined();
  });
});
