import { Keypair } from "@solana/web3.js";
import { canonicalWalletAddress, decodeSignature, verifyWalletSignature } from "./verify-wallet-signature";

describe("verifyWalletSignature", () => {
  it("AUTH-004 accepts a signature for the issued message and rejects a different message, key, or truncated signature", async () => {
    const wallet = await Keypair.generate();
    const message = "SolversBounty login message";
    const signature = await wallet.signBytes(new TextEncoder().encode(message));
    const address = canonicalWalletAddress(wallet.publicKey.toBase58());

    expect(await verifyWalletSignature(address, message, signature)).toBe(true);
    expect(await verifyWalletSignature(address, `${message} tampered`, signature)).toBe(false);

    const other = await Keypair.generate();
    expect(await verifyWalletSignature(other.publicKey.toBase58(), message, signature)).toBe(false);
    expect(await verifyWalletSignature(address, message, signature.subarray(0, 32))).toBe(false);
    expect(() => decodeSignature(Buffer.from(signature.subarray(0, 32)).toString("base64url"))).toThrow();
  });
});
