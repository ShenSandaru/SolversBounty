// Disposable local Postgres only. Start apps/api/docker-compose.payout-test.yml
// and set PAYOUT_INTEGRATION_DATABASE_URL to postgresql://sbpayout:sbpayout@127.0.0.1:55432/sbpayout.
// The spec refuses Neon and any host other than localhost. It does not read DATABASE_URL or DIRECT_URL.
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import pg from "pg";
import { Keypair } from "@solana/web3.js";
import { bucketsBalance, bucketsFromEntries } from "../bounties/funding-ledger";
import type { TransferLookup } from "../bounties/observed-transfer";
import { DatabaseService } from "../../database/database.service";
import { PrismaClient } from "../../generated/prisma/client";
import type { SolanaTransferGateway } from "../solana/solana-transfer.gateway";
import { PayoutWorker } from "./payout-worker";
import { PrismaPayoutRepository } from "./prisma-payout.repository";

const REWARD = 10_000_000n;
const databaseUrl = process.env.PAYOUT_INTEGRATION_DATABASE_URL;
const describeLocal = databaseUrl ? describe : describe.skip;

type LedgerRow = { entryType: string; amountLamports: bigint };
type ChainRow = { signature: string; commitment: string; amountLamports: bigint; createdAt: Date };

class MockGateway implements SolanaTransferGateway {
  submits = 0;
  blockhashReads = 0;
  lookupResult: TransferLookup = { outcome: "not_found" };
  private blockhashes = 0;

  async recentBlockhash(): Promise<string | null> {
    this.blockhashReads += 1;
    this.blockhashes += 1;
    return `${this.blockhashes}1111111111111111111111111111111`.slice(0, 32);
  }

  async submit(): Promise<boolean> {
    this.submits += 1;
    return true;
  }

  async lookup(): Promise<TransferLookup> {
    return this.lookupResult;
  }
}

let overlappingQueries = 0;
const queryableClient = pg.Client.prototype as unknown as { query: (this: pg.Client, ...args: unknown[]) => unknown };
const originalQuery = queryableClient.query;
queryableClient.query = function (this: pg.Client, ...args: unknown[]) {
  const queued = (this as { _queryQueue?: unknown[] })._queryQueue;
  if (queued && queued.length > 0) {
    overlappingQueries += 1;
  }
  return originalQuery.apply(this, args);
};

function assertLocalDatabase(url: string): void {
  const parsed = new URL(url);
  const host = parsed.hostname;
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error("Payout integration refuses a non-local database host.");
  }
  if (url.toLowerCase().includes("neon.tech") || host.includes("neon")) {
    throw new Error("Payout integration refuses Neon.");
  }
  if (parsed.pathname !== "/sbpayout") {
    throw new Error("Payout integration refuses a database other than the disposable sbpayout database.");
  }
}

function clientOf(database: DatabaseService): PrismaClient {
  const client = database.activeClient;
  if (!client) {
    throw new Error("Disposable payout database is not connected.");
  }
  return client as PrismaClient;
}

describeLocal("payout concurrency on disposable Postgres", () => {
  let treasury: Keypair;
  let secret = "";
  let leftDatabase: DatabaseService;
  let rightDatabase: DatabaseService;
  let observerDatabase: DatabaseService;
  let left: PrismaClient;
  let observer: PrismaClient;
  let gateway: MockGateway;

  beforeAll(async () => {
    if (!databaseUrl) {
      throw new Error("PAYOUT_INTEGRATION_DATABASE_URL is not set.");
    }
    assertLocalDatabase(databaseUrl);
    treasury = await Keypair.generate();
    secret = Buffer.from(treasury.secretKey).toString("base64");
    leftDatabase = new DatabaseService({ url: databaseUrl });
    rightDatabase = new DatabaseService({ url: databaseUrl });
    observerDatabase = new DatabaseService({ url: databaseUrl });
    await leftDatabase.onModuleInit();
    await rightDatabase.onModuleInit();
    await observerDatabase.onModuleInit();
    left = clientOf(leftDatabase);
    observer = clientOf(observerDatabase);
    const rows = await left.$queryRawUnsafe<Array<{ name: string }>>("select current_database() as name");
    const name = rows[0]?.name;
    if (name !== "sbpayout") {
      throw new Error("Refusing payout integration because the connected database is not the disposable sbpayout database.");
    }
  }, 30_000);

  afterAll(async () => {
    expect(overlappingQueries).toBe(0);
    queryableClient.query = originalQuery;
    await leftDatabase?.onModuleDestroy();
    await rightDatabase?.onModuleDestroy();
    await observerDatabase?.onModuleDestroy();
  });

  beforeEach(async () => {
    gateway = new MockGateway();
    await left.$executeRawUnsafe(`
      truncate table
        audit_logs,
        bounty_ledger_entries,
        bounty_fundings,
        chain_transactions,
        payouts,
        reward_allocations,
        submission_attempts,
        solving_sessions,
        consent_records,
        bounty_questions,
        bounties,
        auth_sessions,
        auth_nonces,
        users
      restart identity cascade
    `);
  });

  function workers(broadcast: boolean): [PayoutWorker, PayoutWorker] {
    const config = {
      get: (key: string) => {
        if (key === "secrets.treasurySecretKey") {
          return secret;
        }
        if (key === "solana.treasuryPublicKey") {
          return treasury.publicKey.toBase58();
        }
        if (key === "solana.payoutBroadcastEnabled") {
          return broadcast;
        }
        return null;
      },
    } as ConfigService;
    return [
      new PayoutWorker(new PrismaPayoutRepository(leftDatabase), gateway, config),
      new PayoutWorker(new PrismaPayoutRepository(rightDatabase), gateway, config),
    ];
  }

  function observed(solverWallet: string, payoutId: string, failed: boolean): TransferLookup {
    const treasuryAddress = treasury.publicKey.toBase58();
    return {
      outcome: "observed",
      transfer: {
        cluster: "devnet",
        commitment: "confirmed",
        failed,
        feePayer: treasuryAddress,
        memo: `sb:payout:${payoutId}`,
        transfers: [{ source: treasuryAddress, destination: solverWallet, lamports: REWARD }],
      },
    };
  }

  async function seed(input: { status?: "pending" | "submitted" | "retryable"; fundedLamports?: bigint; signature?: string; commitment?: string; createdAt?: Date }): Promise<{ bountyId: string; payoutId: string; solverWallet: string; signature: string | null }> {
    const creatorWallet = (await Keypair.generate()).publicKey.toBase58();
    const solverWallet = (await Keypair.generate()).publicKey.toBase58();
    const creator = await left.user.create({ data: { walletAddress: creatorWallet } });
    const solver = await left.user.create({ data: { walletAddress: solverWallet } });
    const bounty = await left.bounty.create({
      data: {
        creatorId: creator.id,
        title: "Concurrency payout",
        description: "Disposable payout concurrency fixture.",
        category: "logic",
        rewardLamports: REWARD,
        maxRewardedSolvers: 1,
        attemptLimit: 1,
        deadline: new Date("2026-12-31T00:00:00.000Z"),
        status: "active",
      },
    });
    const consent = await left.consentRecord.create({
      data: { userId: solver.id, bountyId: bounty.id, policyVersion: "research-consent-v1", acceptedAt: new Date() },
    });
    const session = await left.solvingSession.create({
      data: { bountyId: bounty.id, solverId: solver.id, consentId: consent.id, startedAt: new Date(), status: "completed" },
    });
    const attempt = await left.submissionAttempt.create({
      data: { sessionId: session.id, attemptNumber: 1, submittedAnswer: "fixture", isCorrect: true, submittedAt: new Date() },
    });
    const allocation = await left.rewardAllocation.create({
      data: { bountyId: bounty.id, solverId: solver.id, attemptId: attempt.id, amountLamports: REWARD, status: "reserved" },
    });
    const payout = await left.payout.create({
      data: {
        allocationId: allocation.id,
        idempotencyKey: `payout:${bounty.id}:${solver.id}`,
        status: input.status ?? "pending",
        sendCount: input.signature ? 1 : 0,
      },
    });
    await left.bountyLedgerEntry.create({ data: { bountyId: bounty.id, entryType: "deposit", amountLamports: input.fundedLamports ?? 20_000_000n } });
    await left.bountyLedgerEntry.create({ data: { bountyId: bounty.id, entryType: "reserve", amountLamports: REWARD, payoutId: payout.id } });
    if (input.signature) {
      await left.chainTransaction.create({
        data: {
          signature: input.signature,
          kind: "payout",
          amountLamports: REWARD,
          sourceAddress: treasury.publicKey.toBase58(),
          destinationAddress: solverWallet,
          commitment: input.commitment ?? "submitted",
          payoutId: payout.id,
          ...(input.createdAt ? { createdAt: input.createdAt } : {}),
        },
      });
    }
    return { bountyId: bounty.id, payoutId: payout.id, solverWallet, signature: input.signature ?? null };
  }

  async function ledger(bountyId: string): Promise<LedgerRow[]> {
    const rows = await left.bountyLedgerEntry.findMany({ where: { bountyId }, select: { entryType: true, amountLamports: true } });
    return rows.map((row) => ({ entryType: row.entryType, amountLamports: row.amountLamports }));
  }

  async function chains(payoutId: string): Promise<ChainRow[]> {
    const rows = await left.chainTransaction.findMany({ where: { payoutId }, orderBy: { createdAt: "asc" } });
    return rows.map((row) => ({ signature: row.signature, commitment: row.commitment, amountLamports: row.amountLamports, createdAt: row.createdAt }));
  }

  async function expectIdentity(bountyId: string, expected: { reserved: bigint; paid: bigint; refundable: bigint }): Promise<void> {
    const entries = await ledger(bountyId);
    const buckets = bucketsFromEntries(entries);
    expect(bucketsBalance(buckets)).toBe(true);
    expect(buckets.funded).toBe(buckets.reserved + buckets.paid + buckets.refundable + buckets.refunded);
    expect(buckets.reserved).toBe(expected.reserved);
    expect(buckets.paid).toBe(expected.paid);
    expect(buckets.refundable).toBe(expected.refundable);
    expect(buckets.refunded).toBe(0n);
    expect(entries.every((entry) => typeof entry.amountLamports === "bigint")).toBe(true);
    expect(await left.bountyFunding.count({ where: { bountyId } })).toBe(0);
  }

  async function withCompetingLocks(payoutId: string, run: () => Promise<void>): Promise<void> {
    if (!databaseUrl) {
      throw new Error("PAYOUT_INTEGRATION_DATABASE_URL is not set.");
    }
    const holderDatabase = new DatabaseService({ url: databaseUrl });
    await holderDatabase.onModuleInit();
    const holder = clientOf(holderDatabase);
    let release = (): void => undefined;
    const opened = new Promise<void>((resolve) => {
      release = resolve;
    });
    let holderPid = 0;
    const holding = holder.$transaction(async (tx) => {
      await tx.$queryRawUnsafe("select id from payouts where id = $1::uuid for update", payoutId);
      const rows = await tx.$queryRawUnsafe<Array<{ pid: number }>>("select pg_backend_pid() as pid");
      holderPid = Number(rows[0]?.pid ?? 0);
      await opened;
    }, { timeout: 15_000 });
    let running: Promise<void> = Promise.resolve();
    try {
      const started = Date.now() + 2_000;
      while (holderPid === 0) {
        if (Date.now() > started) {
          throw new Error("The lock holder did not start.");
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      running = run();
      const deadline = Date.now() + 4_000;
      let waiters: number[] = [];
      while (Date.now() < deadline) {
        const rows = await observer.$queryRawUnsafe<Array<{ pid: number }>>(
          "select pid from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and query ilike '%for update%'",
        );
        waiters = [...new Set(rows.map((row) => Number(row.pid)).filter((pid) => pid !== holderPid))];
        if (waiters.length >= 2) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
      expect(waiters).toHaveLength(2);
      release();
      await Promise.all([holding, running]);
    } catch (error) {
      release();
      await Promise.allSettled([holding, running]);
      throw error;
    } finally {
      await holderDatabase.onModuleDestroy();
    }
  }

  it("lets only one of two workers record and broadcast a pending payout", async () => {
    const seeded = await seed({});
    await withCompetingLocks(seeded.payoutId, async () => {
      const [first, second] = workers(true);
      await Promise.all([first.nudge(), second.nudge()]);
    });
    const stored = await chains(seeded.payoutId);
    const payout = await left.payout.findUniqueOrThrow({ where: { id: seeded.payoutId } });
    expect(gateway.submits).toBe(1);
    expect(stored).toHaveLength(1);
    expect(payout.sendCount).toBe(1);
    expect(payout.status).toBe("submitted");
    expect(stored[0]?.amountLamports).toBe(REWARD);
    const allocation = await left.rewardAllocation.findFirstOrThrow({ where: { payout: { id: seeded.payoutId } } });
    expect(allocation.status).toBe("reserved");
    await expectIdentity(seeded.bountyId, { reserved: REWARD, paid: 0n, refundable: 10_000_000n });
  });

  it("settles one confirmed signature once when two workers reconcile it", async () => {
    const signature = `sig-${randomUUID()}`;
    const seeded = await seed({ status: "submitted", signature });
    gateway.lookupResult = observed(seeded.solverWallet, seeded.payoutId, false);
    await withCompetingLocks(seeded.payoutId, async () => {
      const [first, second] = workers(false);
      await Promise.all([first.nudge(), second.nudge()]);
    });
    const payout = await left.payout.findUniqueOrThrow({ where: { id: seeded.payoutId } });
    const allocation = await left.rewardAllocation.findFirstOrThrow({ where: { payout: { id: seeded.payoutId } } });
    const entries = await ledger(seeded.bountyId);
    expect(payout.status).toBe("confirmed");
    expect(allocation.status).toBe("paid");
    expect(entries.filter((entry) => entry.entryType === "settle")).toHaveLength(1);
    expect(gateway.submits).toBe(0);
    expect(await chains(seeded.payoutId)).toHaveLength(1);
    await expectIdentity(seeded.bountyId, { reserved: 0n, paid: REWARD, refundable: 10_000_000n });
  });

  it("does not let a failed observation replace a settled payout", async () => {
    const signature = `sig-${randomUUID()}`;
    const seeded = await seed({ status: "submitted", signature });
    const success = new MockGateway();
    const failure = new MockGateway();
    success.lookupResult = observed(seeded.solverWallet, seeded.payoutId, false);
    failure.lookupResult = observed(seeded.solverWallet, seeded.payoutId, true);
    const config = {
      get: (key: string) => {
        if (key === "solana.treasuryPublicKey") {
          return treasury.publicKey.toBase58();
        }
        if (key === "solana.payoutBroadcastEnabled") {
          return false;
        }
        return null;
      },
    } as ConfigService;
    const successWorker = new PayoutWorker(new PrismaPayoutRepository(leftDatabase), success, config);
    const failureWorker = new PayoutWorker(new PrismaPayoutRepository(rightDatabase), failure, config);
    await withCompetingLocks(seeded.payoutId, () => Promise.all([successWorker.nudge(), failureWorker.nudge()]).then(() => undefined));
    const payout = await left.payout.findUniqueOrThrow({ where: { id: seeded.payoutId } });
    const allocation = await left.rewardAllocation.findFirstOrThrow({ where: { payout: { id: seeded.payoutId } } });
    const stored = await chains(seeded.payoutId);
    const entries = await ledger(seeded.bountyId);
    expect(payout.status).toBe("confirmed");
    expect(allocation.status).toBe("paid");
    expect(entries.filter((entry) => entry.entryType === "settle")).toHaveLength(1);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.signature).toBe(signature);
    expect(stored[0]?.commitment === "confirmed" || stored[0]?.commitment === "finalized").toBe(true);
    expect(success.submits + failure.submits).toBe(0);
    await expectIdentity(seeded.bountyId, { reserved: 0n, paid: REWARD, refundable: 10_000_000n });
  });

  it("reconciles a stored signature while broadcast is disabled and does not sign new payouts", async () => {
    const pending = await seed({});
    const retryableSignature = `sig-${randomUUID()}`;
    const retryable = await seed({ status: "retryable", signature: retryableSignature, commitment: "failed" });
    const submittedSignature = `sig-${randomUUID()}`;
    const submitted = await seed({ status: "submitted", signature: submittedSignature });
    gateway.lookupResult = observed(submitted.solverWallet, submitted.payoutId, false);
    const [first, second] = workers(false);
    await Promise.all([first.nudge(), second.nudge()]);
    const pendingRow = await left.payout.findUniqueOrThrow({ where: { id: pending.payoutId } });
    const retryableRow = await left.payout.findUniqueOrThrow({ where: { id: retryable.payoutId } });
    const submittedRow = await left.payout.findUniqueOrThrow({ where: { id: submitted.payoutId } });
    expect(pendingRow.status).toBe("pending");
    expect(await chains(pending.payoutId)).toHaveLength(0);
    expect(retryableRow.status).toBe("retryable");
    expect(await chains(retryable.payoutId)).toEqual([expect.objectContaining({ signature: retryableSignature, commitment: "failed", amountLamports: REWARD })]);
    expect(submittedRow.status).toBe("confirmed");
    expect(gateway.submits).toBe(0);
    expect(gateway.blockhashReads).toBe(0);
    await expectIdentity(pending.bountyId, { reserved: REWARD, paid: 0n, refundable: 10_000_000n });
    await expectIdentity(retryable.bountyId, { reserved: REWARD, paid: 0n, refundable: 10_000_000n });
    await expectIdentity(submitted.bountyId, { reserved: 0n, paid: REWARD, refundable: 10_000_000n });
  });

  it("leaves a missing transaction submitted after 180 seconds", async () => {
    const signature = `sig-${randomUUID()}`;
    const seeded = await seed({ status: "submitted", signature, createdAt: new Date(Date.now() - 180_000 - 5_000) });
    gateway.lookupResult = { outcome: "not_found" };
    const [worker] = workers(true);
    await worker.nudge();
    await worker.nudge();
    const payout = await left.payout.findUniqueOrThrow({ where: { id: seeded.payoutId } });
    const stored = await chains(seeded.payoutId);
    expect(payout.status).toBe("submitted");
    expect(stored).toHaveLength(1);
    expect(stored[0]?.signature).toBe(signature);
    expect(gateway.submits).toBe(0);
    expect(gateway.blockhashReads).toBe(0);
    const allocation = await left.rewardAllocation.findFirstOrThrow({ where: { payout: { id: seeded.payoutId } } });
    expect(allocation.status).toBe("reserved");
    await expectIdentity(seeded.bountyId, { reserved: REWARD, paid: 0n, refundable: 10_000_000n });
  });

  it("keeps a failed signature and records one new signature after a confirmed failure", async () => {
    const signature = `sig-${randomUUID()}`;
    const seeded = await seed({ status: "submitted", signature });
    gateway.lookupResult = observed(seeded.solverWallet, seeded.payoutId, true);
    const [worker] = workers(true);
    await worker.nudge();
    const failed = await chains(seeded.payoutId);
    const afterFailure = await left.payout.findUniqueOrThrow({ where: { id: seeded.payoutId } });
    expect(afterFailure.status).toBe("retryable");
    expect(failed).toHaveLength(1);
    expect(failed[0]?.signature).toBe(signature);
    expect(failed[0]?.commitment).toBe("failed");
    gateway.lookupResult = { outcome: "not_found" };
    await worker.nudge();
    const stored = await chains(seeded.payoutId);
    const payout = await left.payout.findUniqueOrThrow({ where: { id: seeded.payoutId } });
    expect(gateway.submits).toBe(1);
    expect(stored).toHaveLength(2);
    expect(stored[0]?.signature).toBe(signature);
    expect(stored[0]?.commitment).toBe("failed");
    expect(stored[1]?.signature).not.toBe(signature);
    expect(stored[1]?.commitment).toBe("submitted");
    expect(stored[1]?.amountLamports).toBe(REWARD);
    expect(payout.status).toBe("submitted");
    expect(payout.sendCount).toBe(2);
    const allocation = await left.rewardAllocation.findFirstOrThrow({ where: { payout: { id: seeded.payoutId } } });
    expect(allocation.status).toBe("reserved");
    await expectIdentity(seeded.bountyId, { reserved: REWARD, paid: 0n, refundable: 10_000_000n });
  });

  it("lets only one of two workers record a replacement signature after a confirmed failure", async () => {
    const signature = `sig-${randomUUID()}`;
    const seeded = await seed({ status: "retryable", signature, commitment: "failed" });
    gateway.lookupResult = { outcome: "not_found" };
    await withCompetingLocks(seeded.payoutId, async () => {
      const [first, second] = workers(true);
      await Promise.all([first.nudge(), second.nudge()]);
    });
    const stored = await chains(seeded.payoutId);
    const payout = await left.payout.findUniqueOrThrow({ where: { id: seeded.payoutId } });
    expect(gateway.submits).toBe(1);
    expect(stored).toHaveLength(2);
    expect(stored[0]?.signature).toBe(signature);
    expect(stored[0]?.commitment).toBe("failed");
    expect(stored[1]?.signature).not.toBe(signature);
    expect(stored[1]?.commitment).toBe("submitted");
    expect(stored[1]?.amountLamports).toBe(REWARD);
    expect(payout.sendCount).toBe(2);
    expect(payout.status).toBe("submitted");
    await expectIdentity(seeded.bountyId, { reserved: REWARD, paid: 0n, refundable: 10_000_000n });
  });
});
