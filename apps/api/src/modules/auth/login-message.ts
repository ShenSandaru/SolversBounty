import { LOGIN_CHAIN } from "./auth.constants";

export type LoginMessageInput = {
  domain: string;
  uri: string;
  walletAddress: string;
  nonce: string;
  issuedAt: Date;
  expiresAt: Date;
};

export function buildLoginMessage(input: LoginMessageInput): string {
  // Keep this a plain message. The "wants you to sign in with your Solana account"
  // preamble makes Phantom parse it as Sign In With Solana and reject the popup.
  return [
    "SolversBounty login",
    `Wallet: ${input.walletAddress}`,
    "This signature does not approve a SOL transfer.",
    `Domain: ${input.domain}`,
    `URI: ${input.uri}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt.toISOString()}`,
    `Expiration Time: ${input.expiresAt.toISOString()}`,
    `Chain: ${LOGIN_CHAIN}`,
  ].join("\n");
}

export function loginOrigin(configuredOrigin: string): { domain: string; uri: string } {
  const url = new URL(configuredOrigin);
  return { domain: url.host, uri: url.origin };
}
