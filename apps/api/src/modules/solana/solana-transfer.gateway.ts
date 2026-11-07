import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { readParsedTransaction, type TransferLookup } from "../bounties/observed-transfer";

export const SOLANA_TRANSFER_GATEWAY = Symbol("SOLANA_TRANSFER_GATEWAY");

export interface SolanaTransferGateway {
  lookup(signature: string): Promise<TransferLookup>;
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
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getTransaction",
      params: [signature, { commitment: "confirmed", encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error("Solana RPC request failed.");
  }
  return response.json();
}
