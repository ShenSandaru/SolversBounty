import { LAMPORTS_PER_SOL } from "./constants";

const SOL_PATTERN = /^(\d+)(?:\.(\d{1,9}))?$/;

export function parseSolToLamports(input: string): bigint | null {
  const match = SOL_PATTERN.exec(input.trim());
  if (!match) {
    return null;
  }

  const whole = match[1];
  const fraction = match[2] ?? "";
  if (whole === undefined) {
    return null;
  }

  const fractionLamports = fraction.padEnd(9, "0");
  return BigInt(whole) * LAMPORTS_PER_SOL + BigInt(fractionLamports);
}

export function formatLamportsAsSol(lamports: bigint): string {
  const negative = lamports < 0n;
  const absolute = negative ? -lamports : lamports;
  const whole = absolute / LAMPORTS_PER_SOL;
  const fraction = (absolute % LAMPORTS_PER_SOL)
    .toString()
    .padStart(9, "0")
    .replace(/0+$/, "");
  const text = fraction.length > 0 ? `${whole.toString()}.${fraction}` : whole.toString();
  return negative ? `-${text}` : text;
}

export function principalLamports(rewardLamports: bigint, maxRewardedSolvers: number): bigint {
  if (!Number.isInteger(maxRewardedSolvers) || maxRewardedSolvers < 0) {
    throw new Error("maxRewardedSolvers must be a non-negative integer");
  }

  return rewardLamports * BigInt(maxRewardedSolvers);
}
