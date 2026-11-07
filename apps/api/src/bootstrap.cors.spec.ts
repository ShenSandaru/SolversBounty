import { Controller, Get, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { configureApp } from "./bootstrap";

@Controller()
class CorsProbeController {
  @Get("auth/session")
  session() {
    return { ok: true };
  }
}

@Module({
  controllers: [CorsProbeController],
  providers: [
    {
      provide: ConfigService,
      useValue: {
        getOrThrow(key: string) {
          if (key === "app.corsOrigins") {
            return ["http://localhost:3000"];
          }
          if (key === "app.jsonBodyLimit") {
            return "64kb";
          }
          throw new Error(key);
        },
      },
    },
  ],
})
class CorsProbeModule {}

describe("credentialed CORS", () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await NestFactory.create<NestExpressApplication>(CorsProbeModule, { bodyParser: false, logger: false });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns the web origin and credentials on a session read", async () => {
    const response = await request(app.getHttpServer()).get("/auth/session").set("Origin", "http://localhost:3000");
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("answers a credentialed login preflight", async () => {
    const response = await request(app.getHttpServer())
      .options("/auth/login")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "content-type,x-csrf-token");
    expect(response.status).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
    expect(String(response.headers["access-control-allow-headers"]).toLowerCase()).toContain("x-csrf-token");
    expect(String(response.headers["access-control-allow-methods"]).toUpperCase()).toContain("POST");
  });

  it("does not reflect an unknown origin", async () => {
    const response = await request(app.getHttpServer()).get("/auth/session").set("Origin", "https://evil.example");
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
