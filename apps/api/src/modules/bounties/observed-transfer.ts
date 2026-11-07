export type ObservedTransfer = {
  cluster: "devnet" | "other";
  commitment: "processed" | "confirmed" | "finalized";
  failed: boolean;
  feePayer: string;
  memo: string | null;
  transfers: { source: string; destination: string; lamports: bigint }[];
};

export type TransferLookup = { outcome: "unavailable" } | { outcome: "not_found" } | { outcome: "observed"; transfer: ObservedTransfer };

const SYSTEM_PROGRAM = "11111111111111111111111111111111";

export function readParsedTransaction(payload: unknown, commitment: "confirmed" | "finalized"): ObservedTransfer | "not_found" {
  if (!isRecord(payload)) {
    return "not_found";
  }
  const result = payload.result;
  if (result === null) {
    return "not_found";
  }
  if (!isRecord(result) || !isRecord(result.meta) || !isRecord(result.transaction)) {
    return "not_found";
  }
  const message = isRecord(result.transaction.message) ? result.transaction.message : null;
  if (!message) {
    return "not_found";
  }
  const instructions = Array.isArray(message.instructions) ? message.instructions : [];
  const feePayer = readFeePayer(message.accountKeys);
  if (!feePayer) {
    return "not_found";
  }
  return {
    cluster: "devnet",
    commitment,
    failed: result.meta.err !== null && result.meta.err !== undefined,
    feePayer,
    memo: readMemo(instructions),
    transfers: readTransfers(instructions),
  };
}

function readFeePayer(accountKeys: unknown): string | null {
  if (!Array.isArray(accountKeys) || !isRecord(accountKeys[0])) {
    return null;
  }
  const pubkey = accountKeys[0].pubkey;
  return typeof pubkey === "string" && pubkey.length > 0 ? pubkey : null;
}

function readTransfers(instructions: unknown[]): { source: string; destination: string; lamports: bigint }[] {
  const transfers: { source: string; destination: string; lamports: bigint }[] = [];
  for (const instruction of instructions) {
    if (!isRecord(instruction)) {
      continue;
    }
    const systemInstruction = instruction.program === "system" || instruction.programId === SYSTEM_PROGRAM;
    if (!systemInstruction) {
      continue;
    }
    const parsed = isRecord(instruction.parsed) ? instruction.parsed : null;
    if (!parsed || parsed.type !== "transfer" || !isRecord(parsed.info)) {
      continue;
    }
    const source = parsed.info.source;
    const destination = parsed.info.destination;
    const lamports = readLamports(parsed.info.lamports);
    if (typeof source !== "string" || typeof destination !== "string" || lamports === null) {
      continue;
    }
    transfers.push({ source, destination, lamports });
  }
  return transfers;
}

function readMemo(instructions: unknown[]): string | null {
  const memos: string[] = [];
  for (const instruction of instructions) {
    if (!isRecord(instruction)) {
      continue;
    }
    const programId = typeof instruction.programId === "string" ? instruction.programId : "";
    const isMemo = instruction.program === "spl-memo" || programId.startsWith("Memo");
    if (!isMemo) {
      continue;
    }
    if (typeof instruction.parsed === "string") {
      memos.push(instruction.parsed);
    } else if (isRecord(instruction.parsed) && typeof instruction.parsed.info === "string") {
      memos.push(instruction.parsed.info);
    }
  }
  return memos.length === 1 ? memos[0] ?? null : null;
}

function readLamports(value: unknown): bigint | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return BigInt(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return BigInt(value);
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
