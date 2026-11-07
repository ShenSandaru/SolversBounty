import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readParsedTransaction, type TransferLookup } from "../bounties/observed-transfer";

export const SOLANA_TRANSFER_GATEWAY = Symbol("SOLANA_TRANSFER_GATEWAY");

export interface SolanaTransferGateway {
  lookup(signature: string): Promise<TransferLookup>;
  recentBlockhash(): Promise<string | null>;
  submit(serialized: Uint8Array): Promise<boolean>;
}

@Injectable()
export class RpcSolanaTransferGateway implements SolanaTransferGateway {
  constructor(@Optional() @Inject(ConfigService) private readonly config?: ConfigService) {}

  async lookup(signature: string): Promise<TransferLookup> {
    const rpcUrl = this.config?.get<string>("solana.rpcUrl");
    if (!rpcUrl || !isDevnetRpc(rpcUrl)) {
      return { outcome: "unavailable" };
    }
    try {
      const payload = await rpc(rpcUrl, signature);
      const transfer = readParsedTransaction(payload, "confirmed");
      if (transfer === "not_found") {
        return { outcome: "not_found" };
      }
      return { outcome: "observed", transfer };
    } catch {
      return { outcome: "unavailable" };
    }
  }

  async recentBlockhash(): Promise<string | null> {
    const rpcUrl = this.rpcUrl();
    if (!rpcUrl) {
      return null;
    }
    try {
      const payload = await rpcMethod(rpcUrl, "getLatestBlockhash", [{ commitment: "confirmed" }]);
      if (!isRecord(payload) || !isRecord(payload.result) || typeof payload.result.value !== "object" || payload.result.value === null) {
        return null;
      }
      const blockhash = (payload.result.value as { blockhash?: unknown }).blockhash;
      return typeof blockhash === "string" && blockhash.length > 0 ? blockhash : null;
    } catch {
      return null;
    }
  }

  async submit(serialized: Uint8Array): Promise<boolean> {
    const rpcUrl = this.rpcUrl();
    if (!rpcUrl) {
      return false;
    }
    try {
      const payload = await rpcMethod(rpcUrl, "sendTransaction", [Buffer.from(serialized).toString("base64"), { encoding: "base64", preflightCommitment: "confirmed" }]);
      return isRecord(payload) && typeof payload.result === "string";
    } catch {
      return false;
    }
  }

  private rpcUrl(): string | null {
    const rpcUrl = this.config?.get<string>("solana.rpcUrl");
    return rpcUrl && isDevnetRpc(rpcUrl) ? rpcUrl : null;
  }
}

export function isDevnetRpc(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const text = `${host}${parsed.pathname}${parsed.search}`.toLowerCase();
    return text.includes("devnet") && !text.includes("mainnet");
  } catch {
    return false;
  }
}

async function rpc(url: string, signature: string): Promise<unknown> {
  return rpcMethod(url, "getTransaction", [signature, { commitment: "confirmed", encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
}

async function rpcMethod(url: string, method: string, params: unknown[]): Promise<unknown> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error("Solana RPC request failed.");
  }
  return response.json();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
