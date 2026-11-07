import type { VerificationMethodName } from "../bounties/bounty.persistence";

export function answersMatch(method: VerificationMethodName, expected: string, submitted: string): boolean {
  if (method === "exact") {
    return submitted === expected;
  }
  if (method === "case_insensitive") {
    return submitted.toLowerCase() === expected.toLowerCase();
  }
  if (method === "normalized_text") {
    return normalizeSpace(submitted) === normalizeSpace(expected);
  }
  return numericText(submitted) === numericText(expected);
}

function normalizeSpace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function numericText(value: string): string | null {
  const trimmed = value.trim();
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? trimmed : null;
}
