import { readParsedTransaction } from "./observed-transfer";

describe("parsed Devnet transactions", () => {
  it("reads one system transfer and one memo", () => {
    const transfer = readParsedTransaction({
      result: {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [{ pubkey: "creator" }],
            instructions: [
              { program: "system", parsed: { type: "transfer", info: { source: "creator", destination: "treasury", lamports: 20 } } },
              { program: "spl-memo", parsed: "sb:deposit:id:reward_pool" },
            ],
          },
        },
      },
    }, "confirmed");
    expect(transfer).toMatchObject({
      commitment: "confirmed",
      failed: false,
      feePayer: "creator",
      memo: "sb:deposit:id:reward_pool",
      transfers: [{ source: "creator", destination: "treasury", lamports: 20n }],
    });
  });

  it("drops a transaction that carries two memos", () => {
    const transfer = readParsedTransaction({
      result: {
        meta: { err: null },
        transaction: {
          message: {
            accountKeys: [{ pubkey: "creator" }],
            instructions: [
              { program: "spl-memo", parsed: "one" },
              { program: "spl-memo", parsed: "two" },
            ],
          },
        },
      },
    }, "confirmed");
    expect(transfer).toMatchObject({ memo: null });
  });

  it("treats a null result as not found", () => {
    expect(readParsedTransaction({ result: null }, "confirmed")).toBe("not_found");
  });
});
