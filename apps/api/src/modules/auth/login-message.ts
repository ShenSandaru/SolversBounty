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
  return [
    "SolversBounty wants you to sign in with your Solana account:",
    input.walletAddress,
    "",
    "This signature does not approve a SOL transfer.",
    "",
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
