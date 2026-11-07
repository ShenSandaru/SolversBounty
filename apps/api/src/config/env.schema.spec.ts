import { parseAllowlist, validateEnv } from "./env.schema";

describe("validateEnv", () => {
  it("starts local development without secrets or a database", () => {
    const env = validateEnv({ NODE_ENV: "development", AUTH_TOKEN_SECRET: "", TREASURY_SECRET_KEY: " " });
    expect(env.PORT).toBe(3001);
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.AUTH_TOKEN_SECRET).toBeUndefined();
    expect(env.TREASURY_SECRET_KEY).toBeUndefined();
    expect(env.PAYOUT_BROADCAST_ENABLED).toBe(false);
    expect(env.CORS_ORIGIN).toBe("http://localhost:3000");
  });

  it("keeps payout broadcasts off unless the switch is exactly true", () => {
    expect(validateEnv({ PAYOUT_BROADCAST_ENABLED: "false" }).PAYOUT_BROADCAST_ENABLED).toBe(false);
    expect(validateEnv({ PAYOUT_BROADCAST_ENABLED: "true" }).PAYOUT_BROADCAST_ENABLED).toBe(true);
    expect(() => validateEnv({ PAYOUT_BROADCAST_ENABLED: "yes" })).toThrow("PAYOUT_BROADCAST_ENABLED must be true or false.");
  });

  it("requires a database URL in production", () => {
    expect(() => validateEnv({ NODE_ENV: "production" })).toThrow(
      "DATABASE_URL is required when NODE_ENV is production.",
    );
  });

  it("rejects a non-numeric port without echoing other values", () => {
    expect(() => validateEnv({ PORT: "nope", DATABASE_URL: "postgresql://user:secret@localhost/db" })).toThrow(
      /PORT must be a positive integer/,
    );
    try {
      validateEnv({ PORT: "nope", DATABASE_URL: "postgresql://user:secret@localhost/db" });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain("secret");
    }
  });

  it("rejects a database URL that is not postgres without repeating it", () => {
    expect(() => validateEnv({ DATABASE_URL: "mysql://root:secret@localhost/db" })).toThrow(
      "DATABASE_URL must be a postgres connection string.",
    );
  });

  it("requires sslmode=require on Neon URLs and keeps the secret out of the error", () => {
    const pooled = "postgresql://user:secret@ep-example-pooler.c-1.region.aws.neon.tech/db";
    expect(() => validateEnv({ DATABASE_URL: pooled })).toThrow(
      "DATABASE_URL must set sslmode=require for Neon.",
    );
    try {
      validateEnv({ DATABASE_URL: pooled, DIRECT_URL: pooled });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain("secret");
    }
  });

  it("accepts a pooled runtime URL and a direct CLI URL when both require SSL", () => {
    const env = validateEnv({
      DATABASE_URL: "postgresql://user:secret@ep-example-pooler.c-1.region.aws.neon.tech/db?sslmode=require",
      DIRECT_URL: "postgresql://user:secret@ep-example.c-1.region.aws.neon.tech/db?sslmode=verify-full",
    });
    expect(env.DATABASE_URL).toContain("sslmode=require");
    expect(env.DIRECT_URL).toContain("sslmode=verify-full");
  });

  it("still requires the pooled URL in production when only the direct URL is set", () => {
    expect(() =>
      validateEnv({
        NODE_ENV: "production",
        DIRECT_URL: "postgresql://user:secret@ep-example.c-1.region.aws.neon.tech/db?sslmode=require",
      }),
    ).toThrow("DATABASE_URL is required when NODE_ENV is production.");
  });
});

describe("parseAllowlist", () => {
  it("splits wallet addresses and drops blanks", () => {
    expect(parseAllowlist(" abc , ,def ")).toEqual(["abc", "def"]);
    expect(parseAllowlist(undefined)).toEqual([]);
  });
});
