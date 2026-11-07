import { z } from "zod";

const blankToUndefined = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const optionalText = z.preprocess(blankToUndefined, z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.preprocess(
    blankToUndefined,
    z.enum(["development", "test", "production"]).default("development"),
  ),
  PORT: z.preprocess(
    blankToUndefined,
    z.coerce
      .number({ error: "PORT must be a positive integer." })
      .int("PORT must be a positive integer.")
      .positive("PORT must be a positive integer.")
      .default(3001),
  ),
  DATABASE_URL: z.preprocess(
    blankToUndefined,
    z
      .string()
      .refine(
        (value) => value.startsWith("postgres://") || value.startsWith("postgresql://"),
        "DATABASE_URL must be a postgres connection string.",
      )
      .optional(),
  ),
  SOLANA_RPC_URL: z.preprocess(
    blankToUndefined,
    z
      .string()
      .refine(
        (value) => value.startsWith("http://") || value.startsWith("https://"),
        "SOLANA_RPC_URL must be an http or https URL.",
      )
      .optional(),
  ),
  CORS_ORIGIN: z.preprocess(
    blankToUndefined,
    z.string().min(1).default("http://localhost:3000"),
  ),
  JSON_BODY_LIMIT: z.preprocess(blankToUndefined, z.string().min(1).default("64kb")),
  AUTH_TOKEN_SECRET: optionalText,
  ANSWER_ENCRYPTION_KEY: optionalText,
  TREASURY_SECRET_KEY: optionalText,
  ADMIN_WALLET_ALLOWLIST: optionalText,
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(source: Record<string, unknown>): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join(" "));
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.DATABASE_URL === undefined) {
    throw new Error("DATABASE_URL is required when NODE_ENV is production.");
  }
  return parsed.data;
}

export function parseAllowlist(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function parseCorsOrigins(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
