import { ConfigService } from "@nestjs/config";
import { Keypair } from "@solana/web3.js";
import { bucketsFromEntries, bucketsBalance } from "../bounties/funding-ledger";
import type { TransferLookup } from "../bounties/observed-transfer";
import type { SolanaTransferGateway } from "../solana/solana-transfer.gateway";
import { FakePayoutDb } from "./fake-payout-db";
import { PayoutWorker } from "./payout-worker";

class ScriptedGateway implements SolanaTransferGateway {
  submits = 0;
  blockhashReads = 0;
  private blockhashes = 0;
  lookupResult: TransferLookup = { outcome: "not_found" };

  recentBlockhash(): Promise<string | null> {
    this.blockhashReads += 1;
    this.blockhashes += 1;
    return Promise.resolve(`${this.blockhashes}1111111111111111111111111111111`.slice(0, 32));
  }

  submit(): Promise<boolean> {
    this.submits += 1;
    return Promise.resolve(true);
  }

  lookup(): Promise<TransferLookup> {
    return Promise.resolve(this.lookupResult);
  }
}

describe("payout worker", () => {
  let treasury: Keypair;
  let solver: Keypair;
  let db: FakePayoutDb;
  let gateway: ScriptedGateway;
  let secret = "";

  beforeEach(async () => {
    treasury = await Keypair.generate();
    solver = await Keypair.generate();
    secret = Buffer.from(treasury.secretKey).toString("base64");
    db = new FakePayoutDb();
    gateway = new ScriptedGateway();
  });

  function worker(options?: { treasuryPublicKey?: string | null; broadcast?: boolean }): PayoutWorker {
    const treasuryPublicKey = options && "treasuryPublicKey" in options ? options.treasuryPublicKey : treasury.publicKey.toBase58();
    const broadcast = options?.broadcast ?? true;
    const config = {
      get: (key: string) => {
        if (key === "secrets.treasurySecretKey") {
          return secret;
        }
        if (key === "solana.treasuryPublicKey") {
          return treasuryPublicKey;
        }
        if (key === "solana.payoutBroadcastEnabled") {
          return broadcast;
        }
        return null;
      },
    } as ConfigService;
    return new PayoutWorker(db, gateway, config);
  }

  function seed(wallet = solver.publicKey.toBase58()) {
    return db.seed({
      id: "11111111-1111-4111-8111-111111111111",
      bountyId: "22222222-2222-4222-8222-222222222222",
      creatorId: "33333333-3333-4333-8333-333333333333",
      solverId: "44444444-4444-4444-8444-444444444444",
      solverWallet: wallet,
      amountLamports: 10_000_000n,
      fundedLamports: 20_000_000n,
    });
  }

  function observed(commitment: "processed" | "confirmed" | "finalized", failed = false): TransferLookup {
    return {
      outcome: "observed",
      transfer: {
        cluster: "devnet",
        commitment,
        failed,
        feePayer: treasury.publicKey.toBase58(),
        memo: "sb:payout:11111111-1111-4111-8111-111111111111",
        transfers: [{ source: treasury.publicKey.toBase58(), destination: solver.publicKey.toBase58(), lamports: 10_000_000n }],
      },
    };
  }

  it("settles a confirmed payout exactly once", async () => {
    seed();
    gateway.lookupResult = observed("confirmed");
    const first = worker();
    await first.nudge();
    expect(gateway.submits).toBe(1);
    expect(db.rows[0]?.status).toBe("submitted");
    await first.nudge();
    expect(gateway.submits).toBe(1);
    expect(db.rows[0]?.status).toBe("confirmed");
    const buckets = bucketsFromEntries(db.rows[0]?.ledger ?? []);
    expect(buckets.reserved).toBe(0n);
    expect(buckets.paid).toBe(10_000_000n);
    expect(buckets.funded).toBe(buckets.reserved + buckets.paid + buckets.refundable + buckets.refunded);
    expect(bucketsBalance(buckets)).toBe(true);
    expect(db.rows[0]?.ledger.filter((entry) => entry.entryType === "settle")).toHaveLength(1);
    const signature = db.rows[0]?.chains[0]?.signature ?? "";
    await db.settle({ id: db.rows[0]!.id, signature, commitment: "confirmed", now: new Date() });
    await db.noteRetryable(db.rows[0]!.id, signature);
    const restarted = worker();
    await restarted.nudge();
    expect(gateway.submits).toBe(1);
    expect(db.rows[0]?.status).toBe("confirmed");
    expect(db.rows[0]?.ledger.filter((entry) => entry.entryType === "settle")).toHaveLength(1);
    expect(bucketsFromEntries(db.rows[0]?.ledger ?? []).paid).toBe(10_000_000n);
    expect(JSON.stringify(await db.creatorSummary(db.rows[0]!.bountyId, db.rows[0]!.creatorId))).not.toContain(solver.publicKey.toBase58());
  });

  it("settles a finalized payout", async () => {
    seed();
    await worker().nudge();
    gateway.lookupResult = observed("finalized");
    await worker().nudge();
    expect(db.rows[0]?.status).toBe("confirmed");
    expect(gateway.submits).toBe(1);
    expect(db.rows[0]?.ledger.filter((entry) => entry.entryType === "settle")).toHaveLength(1);
  });

  it("leaves a processed transaction submitted", async () => {
    seed();
    gateway.lookupResult = observed("processed");
    await worker().nudge();
    await worker().nudge();
    expect(db.rows[0]?.status).toBe("submitted");
    expect(gateway.submits).toBe(1);
    expect(bucketsFromEntries(db.rows[0]?.ledger ?? []).reserved).toBe(10_000_000n);
  });

  it("leaves the payout submitted when RPC is unavailable", async () => {
    seed();
    gateway.lookupResult = { outcome: "unavailable" };
    await worker().nudge();
    await worker().nudge();
    expect(gateway.submits).toBe(1);
    expect(db.rows[0]?.status).toBe("submitted");
    expect(bucketsFromEntries(db.rows[0]?.ledger ?? []).reserved).toBe(10_000_000n);
  });

  it("leaves a missing transaction submitted after 180 seconds", async () => {
    seed();
    await worker().nudge();
    const chain = db.rows[0]?.chains[0];
    expect(chain).toBeDefined();
    chain!.createdAt = new Date(Date.now() - 180_000 - 5_000);
    gateway.lookupResult = { outcome: "not_found" };
    await worker().nudge();
    expect(db.rows[0]?.status).toBe("submitted");
    expect(db.rows[0]?.chains).toHaveLength(1);
    expect(gateway.submits).toBe(1);
    expect(bucketsFromEntries(db.rows[0]?.ledger ?? []).reserved).toBe(10_000_000n);
  });

  it("becomes retryable only after a confirmed execution failure", async () => {
    seed();
    await worker().nudge();
    gateway.lookupResult = observed("confirmed", true);
    await worker().nudge();
    expect(db.rows[0]?.status).toBe("retryable");
    expect(db.rows[0]?.chains[0]?.commitment).toBe("failed");
    expect(bucketsFromEntries(db.rows[0]?.ledger ?? []).reserved).toBe(10_000_000n);
    expect(db.rows[0]?.ledger.filter((entry) => entry.entryType === "settle")).toHaveLength(0);
  });

  it("signs a new transfer after a confirmed failure and keeps the old signature", async () => {
    seed();
    const active = worker();
    await active.nudge();
    const firstSignature = db.rows[0]?.chains[0]?.signature;
    gateway.lookupResult = observed("confirmed", true);
    await active.nudge();
    gateway.lookupResult = { outcome: "not_found" };
    await active.nudge();
    expect(gateway.submits).toBe(2);
    expect(db.rows[0]?.chains).toHaveLength(2);
    expect(db.rows[0]?.chains[0]?.signature).toBe(firstSignature);
    expect(db.rows[0]?.chains[0]?.commitment).toBe("failed");
    expect(db.rows[0]?.status).toBe("submitted");
    expect(bucketsFromEntries(db.rows[0]?.ledger ?? []).reserved).toBe(10_000_000n);
  });

  it("does not sign when the treasury public key is missing", async () => {
    seed();
    await worker({ treasuryPublicKey: null }).nudge();
    expect(gateway.submits).toBe(0);
    expect(gateway.blockhashReads).toBe(0);
    expect(db.rows[0]?.status).toBe("pending");
    expect(db.rows[0]?.lastError).toBe("Treasury identity is not configured.");
  });

  it("does not settle a submitted payout when the treasury public key is missing", async () => {
    seed();
    await worker().nudge();
    gateway.lookupResult = observed("confirmed");
    await worker({ treasuryPublicKey: null, broadcast: false }).nudge();
    expect(db.rows[0]?.status).toBe("submitted");
    expect(db.rows[0]?.lastError).toBe("Treasury identity is not configured.");
    expect(bucketsFromEntries(db.rows[0]?.ledger ?? []).reserved).toBe(10_000_000n);
    expect(gateway.submits).toBe(1);
  });

  it("does not sign when the treasury public key does not match the secret", async () => {
    seed();
    const other = await Keypair.generate();
    await worker({ treasuryPublicKey: other.publicKey.toBase58() }).nudge();
    expect(gateway.submits).toBe(0);
    expect(db.rows[0]?.status).toBe("pending");
    expect(db.rows[0]?.lastError).toBe("The payout could not be signed.");
  });

  it("does not sign or broadcast when broadcasting is disabled", async () => {
    seed();
    await worker({ broadcast: false }).nudge();
    expect(gateway.submits).toBe(0);
    expect(gateway.blockhashReads).toBe(0);
    expect(db.rows[0]?.status).toBe("pending");
    expect(db.rows[0]?.chains).toHaveLength(0);
  });

  it("reconciles an existing submitted signature when broadcasting is disabled", async () => {
    seed();
    await worker({ broadcast: true }).nudge();
    gateway.lookupResult = observed("confirmed");
    await worker({ broadcast: false }).nudge();
    expect(gateway.submits).toBe(1);
    expect(db.rows[0]?.status).toBe("confirmed");
    expect(bucketsFromEntries(db.rows[0]?.ledger ?? []).paid).toBe(10_000_000n);
  });

  it("lets only one of two workers broadcast", async () => {
    seed();
    let release = (): void => undefined;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    gateway.submit = () => {
      gateway.submits += 1;
      return hold.then(() => true);
    };
    const both = Promise.all([worker().nudge(), worker().nudge()]);
    await new Promise((resolve) => setTimeout(resolve, 20));
    release();
    await both;
    expect(gateway.submits).toBe(1);
    expect(db.rows[0]?.sendCount).toBe(1);
    expect(db.rows[0]?.chains).toHaveLength(1);
  });

  it("does not sign when the treasury secret or the reservation is not usable", async () => {
    secret = "";
    seed();
    await worker().nudge();
    expect(gateway.submits).toBe(0);
    expect(db.rows[0]?.status).toBe("pending");
    secret = Buffer.from(treasury.secretKey).toString("base64");
    db.rows[0]!.solverWallet = "not-a-wallet";
    await worker().nudge();
    expect(gateway.submits).toBe(0);
    db.rows[0]!.solverWallet = solver.publicKey.toBase58();
    db.rows[0]!.ledger = db.rows[0]!.ledger.filter((entry) => entry.entryType !== "reserve");
    await worker().nudge();
    expect(gateway.submits).toBe(0);
    expect(db.rows[0]?.lastError).toBe("The reserved balance does not match the allocation.");
  });
});
