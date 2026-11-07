import { commissionLamports } from "./bounties.service";
import { bucketsBalance, bucketsFromEntries } from "./funding-ledger";

describe("funding amounts", () => {
  it("floors the 5% commission and keeps it out of the reward pool", () => {
    const pool = 1_000_000_000n;
    const commission = commissionLamports(pool);
    expect(commission).toBe(50_000_000n);
    expect(pool + commission).toBe(1_050_000_000n);
    expect(commissionLamports(1_000_000_001n)).toBe(50_000_000n);
    expect(commissionLamports(0n)).toBe(0n);
    expect(commissionLamports(19n)).toBe(0n);
    expect(commissionLamports(20n)).toBe(1n);
  });

  it("uses integer lamports for values past the safe number range", () => {
    const pool = 2n ** 80n;
    expect(commissionLamports(pool)).toBe((pool * 5n) / 100n);
    expect(pool + commissionLamports(pool)).toBe(pool + (pool * 5n) / 100n);
  });

  it("posts a reward-pool deposit without a commission bucket", () => {
    const buckets = bucketsFromEntries([{ entryType: "deposit", amountLamports: 1_000_000_000n }]);
    expect(buckets.funded).toBe(1_000_000_000n);
    expect(buckets.refundable).toBe(1_000_000_000n);
    expect(buckets.paid).toBe(0n);
    expect(bucketsBalance(buckets)).toBe(true);
  });
});
