import { registerAs } from "@nestjs/config";
import { clusterApiUrl } from "@solana/web3.js";
import { parseAllowlist, parseCorsOrigins, validateEnv } from "./env.schema";

function readEnv() {
  return validateEnv(process.env);
}

export const appConfig = registerAs("app", () => {
  const env = readEnv();
  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    corsOrigins: parseCorsOrigins(env.CORS_ORIGIN),
    jsonBodyLimit: env.JSON_BODY_LIMIT,
  };
});

export const databaseConfig = registerAs("database", () => {
  const env = readEnv();
  return {
    url: env.DATABASE_URL ?? null,
  };
});

export const solanaConfig = registerAs("solana", () => {
  const env = readEnv();
  return {
    rpcUrl: env.SOLANA_RPC_URL ?? clusterApiUrl("devnet"),
  };
});

export const secretsConfig = registerAs("secrets", () => {
  const env = readEnv();
  return {
    authTokenSecret: env.AUTH_TOKEN_SECRET ?? null,
    answerEncryptionKey: env.ANSWER_ENCRYPTION_KEY ?? null,
    treasurySecretKey: env.TREASURY_SECRET_KEY ?? null,
    adminWalletAllowlist: parseAllowlist(env.ADMIN_WALLET_ALLOWLIST),
    treasurySigningConfigured: env.TREASURY_SECRET_KEY !== undefined,
    authSecretConfigured: env.AUTH_TOKEN_SECRET !== undefined,
    answerEncryptionConfigured: env.ANSWER_ENCRYPTION_KEY !== undefined,
  };
});
