export type CapacityReason = "pool_exhausted" | "insufficient_refundable";

export function capacityDecision(input: {
  allocationCount: number;
  maxRewardedSolvers: number;
  refundable: bigint;
  rewardLamports: bigint;
}): { reserve: true } | { reserve: false; reason: CapacityReason } {
  if (input.allocationCount >= input.maxRewardedSolvers) {
    return { reserve: false, reason: "pool_exhausted" };
  }
  if (input.refundable < input.rewardLamports) {
    return { reserve: false, reason: "insufficient_refundable" };
  }
  return { reserve: true };
}
