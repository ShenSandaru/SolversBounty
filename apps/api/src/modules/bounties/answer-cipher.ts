import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { BountyFlowError } from "./bounty.errors";

export const ANSWER_KEY_ID = "primary";

export function parseAnswerKey(value: string | undefined): Buffer {
  if (!value) {
    throw new BountyFlowError(503, "NOT_READY", "Answer protection is not configured.");
  }
  const key = decodeKey(value);
  if (key.length !== 32) {
    throw new BountyFlowError(503, "NOT_READY", "Answer protection is not configured.");
  }
  return key;
}

export function encryptAnswer(plaintext: string, key: Buffer): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${nonce.toString("base64url")}.${ciphertext.toString("base64url")}.${tag.toString("base64url")}`;
}

export function decryptAnswer(payload: string, key: Buffer): string {
  const parts = payload.split(".");
  if (parts.length !== 4 || parts[0] !== "v1" || !parts[1] || !parts[2] || !parts[3]) {
    throw new BountyFlowError(500, "INTERNAL", "Internal server error");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parts[1], "base64url"));
    decipher.setAuthTag(Buffer.from(parts[3], "base64url"));
    const plain = Buffer.concat([decipher.update(Buffer.from(parts[2], "base64url")), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    throw new BountyFlowError(500, "INTERNAL", "Internal server error");
  }
}

function decodeKey(value: string): Buffer {
  if (/^[0-9a-f]{64}$/i.test(value)) {
    return Buffer.from(value, "hex");
  }
  return Buffer.from(value, "base64url");
}
