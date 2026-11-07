import { PublicKey } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { buildFundingTransaction } from "./funding-transaction";

describe("funding transaction", () => {
  it("puts the exact lamports and the deposit reference in one transfer", () => {
    const from = PublicKey.unique();
    const treasury = PublicKey.unique();
    const transaction = buildFundingTransaction({
      from,
      treasury,
      lamports: 1_000_000_000n,
      memo: "sb:deposit:bounty:reward_pool",
      recentBlockhash: "11111111111111111111111111111111",
    });
    expect(transaction.instructions).toHaveLength(2);
    expect(transaction.feePayer?.equals(from)).toBe(true);
    expect(transaction.instructions[1]?.data).toEqual(new TextEncoder().encode("sb:deposit:bounty:reward_pool"));
  });
});
