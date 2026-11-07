import { clusterApiUrl } from "@solana/web3.js";

export function resolveSolanaRpcUrl(): string {
  const configured = process.env.SOLANA_RPC_URL?.trim();
  if (configured) {
    return configured;
  }
  return clusterApiUrl("devnet");
}
