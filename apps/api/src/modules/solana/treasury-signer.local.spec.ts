// Signs one payout with the local treasury configuration. It does not contact RPC,
// write a payout row, or print the secret or the signed bytes.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "dotenv";
import { Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { encodeBase58 } from "./base58";
import { payoutMemo, signPayoutTransfer } from "./treasury-signer";

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
const PAYOUT_ID = "00000000-0000-4000-8000-000000000099";
const LAMPORTS = 10_000_000n;

function localTreasury(): { publicKey: string; secret: string } | null {
  try {
    const parsed = parse(readFileSync(resolve(__dirname, "../../../.env")));
    const publicKey = parsed.TREASURY_PUBLIC_KEY?.trim() ?? "";
    const secret = parsed.TREASURY_SECRET_KEY?.trim() ?? "";
    if (!publicKey || !secret) {
      return null;
    }
    return { publicKey, secret };
  } catch {
    return null;
  }
}

function transferLamports(data: Uint8Array): bigint {
  if (data.byteLength < 12) {
    throw new Error("The transfer instruction is incomplete.");
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint32(0, true) !== 2) {
    throw new Error("The instruction is not a system transfer.");
  }
  return view.getBigUint64(4, true);
}

const configured = localTreasury();
const describeLocal = configured ? describe : describe.skip;

describeLocal("configured treasury signs a payout locally", () => {
  it("matches the public key and verifies the signed payout without submitting it", async () => {
    if (!configured) {
      throw new Error("Treasury configuration is missing.");
    }
    const recipient = (await Keypair.generate()).publicKey.toBase58();
    const memo = payoutMemo(PAYOUT_ID);
    const signed = await signPayoutTransfer({
      secret: configured.secret,
      destination: recipient,
      lamports: LAMPORTS,
      memo,
      recentBlockhash: encodeBase58(new Uint8Array(32).fill(7)),
      expectedTreasury: configured.publicKey,
    });
    if (!signed) {
      throw new Error("The treasury signer refused the configured key.");
    }
    expect(signed.treasury).toBe(configured.publicKey);
    const transaction = Transaction.from(signed.serialized);
    expect(await transaction.verifySignatures()).toBe(true);
    expect(transaction.feePayer?.toBase58()).toBe(configured.publicKey);
    const transfer = transaction.instructions.find((item) => item.programId.equals(SystemProgram.programId));
    const memoInstruction = transaction.instructions.find((item) => item.programId.equals(MEMO_PROGRAM));
    if (!transfer || !memoInstruction) {
      throw new Error("The signed payout is missing the transfer or the memo.");
    }
    expect(transfer.keys[0]?.pubkey.toBase58()).toBe(configured.publicKey);
    expect(transfer.keys[0]?.isSigner).toBe(true);
    expect(transfer.keys[1]?.pubkey.toBase58()).toBe(recipient);
    expect(transferLamports(transfer.data)).toBe(LAMPORTS);
    expect(new TextDecoder().decode(memoInstruction.data)).toBe(memo);
  });
});
