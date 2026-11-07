import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export function buildFundingTransaction(input: {
  from: PublicKey;
  treasury: PublicKey;
  lamports: bigint;
  memo: string;
  recentBlockhash: string;
}): Transaction {
  if (!Number.isSafeInteger(Number(input.lamports)) || input.lamports <= 0n) {
    throw new Error("The funding amount cannot be sent as a single transfer.");
  }
  const transaction = new Transaction();
  transaction.feePayer = input.from;
  transaction.recentBlockhash = input.recentBlockhash;
  transaction.add(
    SystemProgram.transfer({
      fromPubkey: input.from,
      toPubkey: input.treasury,
      lamports: Number(input.lamports),
    }),
  );
  transaction.add(
    new TransactionInstruction({
      keys: [],
      programId: MEMO_PROGRAM,
      data: new TextEncoder().encode(input.memo),
    }),
  );
  return transaction;
}
