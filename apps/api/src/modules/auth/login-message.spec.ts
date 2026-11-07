import { buildLoginMessage } from "./login-message";

describe("buildLoginMessage", () => {
  it("binds the domain, wallet, nonce, expiry, devnet, and a no-transfer statement", () => {
    const message = buildLoginMessage({
      domain: "localhost:3000",
      uri: "http://localhost:3000",
      walletAddress: "wallet",
      nonce: "nonce-1",
      issuedAt: new Date("2026-11-07T12:00:00.000Z"),
      expiresAt: new Date("2026-11-07T12:10:00.000Z"),
    });

    expect(message).toContain("SolversBounty login");
    expect(message).not.toContain("wants you to sign in with your Solana account");
    expect(message).toContain("This signature does not approve a SOL transfer.");
    expect(message).toContain("Domain: localhost:3000");
    expect(message).toContain("URI: http://localhost:3000");
    expect(message).toContain("wallet");
    expect(message).toContain("Nonce: nonce-1");
    expect(message).toContain("Chain: solana:devnet");
    expect(message).not.toContain("mainnet");
  });
});
