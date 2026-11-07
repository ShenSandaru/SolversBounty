import { Controller, Get, Module, Post, Query } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { z } from "zod";
import { ApiExceptionFilter } from "../filters/api-exception.filter";
import { BigIntSerializerInterceptor, serializeBigInt } from "../interceptors/bigint-serializer.interceptor";
import { ZodValidationPipe } from "../pipes/zod-validation.pipe";

@Controller("probe")
class ProbeController {
  @Get("bigint")
  getBigInt() {
    return { lamports: 1_500_000_000n, nested: { ids: [2n] }, at: new Date("2026-01-01T00:00:00.000Z") };
  }

  @Get("boom")
  getBoom() {
    throw new Error("expected answer is secret and postgresql://user:secret@localhost/db");
  }

  @Post("answers")
  postAnswer(@Query(new ZodValidationPipe(z.object({ attempt: z.coerce.number().int().positive() }))) query: { attempt: number }) {
    return { attempt: query.attempt };
  }
}

@Module({
  controllers: [ProbeController],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: BigIntSerializerInterceptor },
  ],
})
class ProbeModule {}

describe("API conventions", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [ProbeModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("serializes bigint values as decimal strings and leaves dates alone", async () => {
    expect(serializeBigInt({ amount: 5n, when: new Date("2026-01-01T00:00:00.000Z") })).toEqual({
      amount: "5",
      when: new Date("2026-01-01T00:00:00.000Z"),
    });
    const response = await request(app.getHttpServer()).get("/probe/bigint").expect(200);
    expect(response.body.lamports).toBe("1500000000");
    expect(response.body.nested.ids).toEqual(["2"]);
    expect(response.body.at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("hides unexpected exception details", async () => {
    const response = await request(app.getHttpServer()).get("/probe/boom").expect(500);
    expect(response.body).toMatchObject({
      statusCode: 500,
      code: "INTERNAL",
      message: "Internal server error",
    });
    expect(JSON.stringify(response.body)).not.toContain("secret");
    expect(response.body.requestId).toEqual(expect.any(String));
  });

  it("returns validation issues without the submitted value", async () => {
    const response = await request(app.getHttpServer())
      .post("/probe/answers")
      .query({ attempt: "not-a-number" })
      .expect(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.body.issues).toEqual([{ path: "attempt", message: expect.any(String) }]);
    expect(JSON.stringify(response.body)).not.toContain("not-a-number");
  });
});
