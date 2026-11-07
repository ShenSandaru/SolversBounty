import { Keypair, PublicKey, SystemProgram, Transaction, TransactionInstruction, type Blockhash } from "@solana/web3.js";
import { decodeBase58, encodeBase58 } from "./base58";

const MEMO_PROGRAM = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export type SignedPayout = {
  signature: string;
  serialized: Uint8Array;
  treasury: string;
};

export async function signPayoutTransfer(input: {
  secret: string;
  destination: string;
  lamports: bigint;
  memo: string;
  recentBlockhash: string;
  expectedTreasury: string | null;
}): Promise<SignedPayout | null> {
  const treasury = await treasuryKey(input.secret);
  if (!treasury) {
    return null;
  }
  const treasuryAddress = treasury.publicKey.toBase58();
  if (input.expectedTreasury && input.expectedTreasury !== treasuryAddress) {
    return null;
  }
  let destination: PublicKey;
  try {
    destination = new PublicKey(input.destination);
  } catch {
    return null;
  }
  if (destination.toBase58() !== input.destination || !Number.isSafeInteger(Number(input.lamports)) || input.lamports <= 0n) {
    return null;
  }
  const transaction = new Transaction();
  transaction.feePayer = treasury.publicKey;
  transaction.recentBlockhash = input.recentBlockhash as Blockhash;
  transaction.add(SystemProgram.transfer({ fromPubkey: treasury.publicKey, toPubkey: destination, lamports: Number(input.lamports) }));
  transaction.add(new TransactionInstruction({ keys: [], programId: MEMO_PROGRAM, data: new TextEncoder().encode(input.memo) }));
  await transaction.sign(treasury);
  const raw = transaction.signature;
  if (!raw) {
    return null;
  }
  return { signature: encodeBase58(raw), serialized: await transaction.serialize(), treasury: treasuryAddress };
}

export function payoutMemo(payoutId: string): string {
  return `sb:payout:${payoutId}`;
}

async function treasuryKey(secret: string): Promise<Keypair | null> {
  const decoded = decodeSecret(secret);
  if (!decoded || decoded.length !== 64) {
    return null;
  }
  try {
    return await Keypair.fromSecretKey(decoded);
  } catch {
    return null;
  }
}

function decodeSecret(secret: string): Uint8Array | null {
  const trimmed = secret.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (!Array.isArray(parsed) || parsed.length !== 64 || parsed.some((item) => typeof item !== "number")) {
        return null;
      }
      return Uint8Array.from(parsed);
    } catch {
      return null;
    }
  }
  if (/^[0-9a-f]{128}$/i.test(trimmed)) {
    return Uint8Array.from(Buffer.from(trimmed, "hex"));
  }
  const base58 = decodeBase58(trimmed);
  if (base58?.length === 64) {
    return base58;
  }
  const bytes = Buffer.from(trimmed, "base64");
  return bytes.length === 64 ? bytes : null;
}
