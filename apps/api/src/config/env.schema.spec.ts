import { parseAllowlist, validateEnv } from "./env.schema";

describe("validateEnv", () => {
  it("starts local development without secrets or a database", () => {
    const env = validateEnv({ NODE_ENV: "development", AUTH_TOKEN_SECRET: "", TREASURY_SECRET_KEY: " " });
    expect(env.PORT).toBe(3001);
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.AUTH_TOKEN_SECRET).toBeUndefined();
    expect(env.TREASURY_SECRET_KEY).toBeUndefined();
    expect(env.CORS_ORIGIN).toBe("http://localhost:3000");
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
});

describe("parseAllowlist", () => {
  it("splits wallet addresses and drops blanks", () => {
    expect(parseAllowlist(" abc , ,def ")).toEqual(["abc", "def"]);
    expect(parseAllowlist(undefined)).toEqual([]);
  });
});
