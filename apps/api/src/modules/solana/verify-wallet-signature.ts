import { PublicKey } from "@solana/web3.js";

export class WalletAddressError extends Error {
  constructor() {
    super("Wallet address is not a Solana public key.");
  }
}

export function canonicalWalletAddress(value: string): string {
  try {
    const key = new PublicKey(value);
    const bytes = key.toBytes();
    if (bytes.length !== 32) {
      throw new WalletAddressError();
    }
    return key.toBase58();
  } catch (error) {
    if (error instanceof WalletAddressError) {
      throw error;
    }
    throw new WalletAddressError();
  }
}

export class SignatureError extends Error {
  constructor() {
    super("Signature could not be read.");
  }
}

export function decodeSignature(value: string): Uint8Array {
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== 64 || Buffer.from(bytes).toString("base64url") !== value) {
    throw new SignatureError();
  }
  return bytes;
}

export async function verifyWalletSignature(
  walletAddress: string,
  message: string,
  signature: Uint8Array,
): Promise<boolean> {
  if (signature.length !== 64) {
    return false;
  }
  const key = new PublicKey(walletAddress);
  return key.verifySignature(signature, new TextEncoder().encode(message));
}
