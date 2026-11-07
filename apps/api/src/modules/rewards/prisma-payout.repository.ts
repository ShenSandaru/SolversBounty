import { Inject, Injectable, Optional } from "@nestjs/common";
import { DatabaseService, type ConnectedClient } from "../../database/database.service";
import { BountyFlowError } from "../bounties/bounty.errors";
import { bucketsFromEntries } from "../bounties/funding-ledger";
import type {
  AdminPayoutView,
  CreatorPayoutSummary,
  PayoutSnapshot,
  PayoutStatusName,
  PayoutStore,
  RecordSendResult,
  SettleResult,
  SolverPayoutView,
} from "./payout.persistence";

type Delegate = {
  findMany(args: unknown): Promise<unknown>;
  findUnique(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  create(args: unknown): Promise<unknown>;
};

type PrismaLike = {
  $transaction<T>(fn: (tx: PrismaLike) => Promise<T>): Promise<T>;
  $queryRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
  payout: Delegate;
  rewardAllocation: Delegate;
  bountyLedgerEntry: Delegate;
  chainTransaction: Delegate;
  bounty: { findUnique(args: unknown): Promise<unknown> };
};

@Injectable()
export class PrismaPayoutRepository implements PayoutStore {
  constructor(@Optional() @Inject(DatabaseService) private readonly database?: DatabaseService) {}

  async listActionable(limit: number): Promise<string[]> {
    const rows = await this.client().payout.findMany({
      where: { status: { in: ["pending", "submitted", "retryable"] } },
      orderBy: { createdAt: "asc" },
      take: limit,
      select: { id: true },
    });
    return Array.isArray(rows) ? rows.filter(isRecord).map((row) => readString(row.id)) : [];
  }

  async read(id: string): Promise<PayoutSnapshot | null> {
    const found = await this.client().payout.findUnique({ where: { id }, include: payoutInclude() });
    return isRecord(found) ? snapshot(found) : null;
  }

  async recordSend(input: { id: string; signature: string; source: string; destination: string; amountLamports: bigint; now: Date }): Promise<RecordSendResult> {
    return this.client().$transaction(async (tx) => {
      await tx.$queryRawUnsafe("select id from payouts where id = $1::uuid for update", input.id);
      const found = await tx.payout.findUnique({ where: { id: input.id }, include: payoutInclude() });
      if (!isRecord(found)) {
        return "blocked";
      }
      const current = snapshot(found);
      const terminal = current.signatures.length > 0 && current.signatures.every((item) => item.commitment === "failed");
      const open = current.status === "pending" ? current.signatures.length === 0 : current.status === "retryable" && terminal;
      if (!open || current.amountLamports !== input.amountLamports) {
        return "blocked";
      }
      await tx.chainTransaction.create({
        data: {
          signature: input.signature,
          kind: "payout",
          amountLamports: input.amountLamports,
          sourceAddress: input.source,
          destinationAddress: input.destination,
          commitment: "submitted",
          payoutId: input.id,
        },
      });
      await tx.payout.update({ where: { id: input.id }, data: { status: "submitted", sendCount: { increment: 1 }, lastError: null } });
      return "recorded";
    });
  }

  async noteRetryable(id: string, signature: string): Promise<void> {
    await this.client().$transaction(async (tx) => {
      await tx.$queryRawUnsafe("select id from payouts where id = $1::uuid for update", id);
      const found = await tx.payout.findUnique({ where: { id }, include: payoutInclude() });
      if (!isRecord(found)) {
        return;
      }
      const current = snapshot(found);
      const chain = current.signatures.find((item) => item.signature === signature);
      if (!chain || current.settled || (current.status !== "submitted" && current.status !== "retryable")) {
        return;
      }
      await tx.chainTransaction.update({ where: { signature }, data: { commitment: "failed" } });
      await tx.payout.update({ where: { id }, data: { status: "retryable", lastError: "The transfer failed on Devnet." } });
    });
  }

  async settle(input: { id: string; signature: string; commitment: "confirmed" | "finalized"; now: Date }): Promise<SettleResult> {
    return this.client().$transaction(async (tx) => {
      await tx.$queryRawUnsafe("select id from payouts where id = $1::uuid for update", input.id);
      const found = await tx.payout.findUnique({ where: { id: input.id }, include: payoutInclude() });
      if (!isRecord(found) || !isRecord(found.allocation)) {
        return "blocked";
      }
      const current = snapshot(found);
      if (current.status === "confirmed") {
        return "settled";
      }
      const chain = Array.isArray(found.chainTransactions) ? found.chainTransactions.filter(isRecord).find((item) => item.signature === input.signature) : undefined;
      if (!chain) {
        return "blocked";
      }
      const entries = Array.isArray(found.ledgerEntries) ? found.ledgerEntries.filter(isRecord) : [];
      const posted = entries.some((entry) => entry.entryType === "settle" && isRecord(entry.chainTransaction) && entry.chainTransaction.signature === input.signature);
      if (!posted) {
        await tx.bountyLedgerEntry.create({
          data: { bountyId: current.bountyId, entryType: "settle", amountLamports: current.amountLamports, payoutId: input.id, chainTransactionId: readString(chain.id) },
        });
      }
      await tx.chainTransaction.update({ where: { signature: input.signature }, data: { commitment: input.commitment, confirmedAt: input.now } });
      await tx.rewardAllocation.update({ where: { id: readString(found.allocation.id) }, data: { status: "paid" } });
      await tx.payout.update({ where: { id: input.id }, data: { status: "confirmed", lastError: null } });
      return "settled";
    });
  }

  async note(id: string, message: string): Promise<void> {
    await this.client().payout.update({ where: { id }, data: { lastError: message } });
  }

  async creatorSummary(bountyId: string, creatorId: string): Promise<CreatorPayoutSummary | "missing"> {
    const bounty = await this.client().bounty.findUnique({ where: { id: bountyId }, include: { ledgerEntries: true, allocations: { include: { payout: true } } } });
    if (!isRecord(bounty) || bounty.creatorId !== creatorId) {
      return "missing";
    }
    const allocations = Array.isArray(bounty.allocations) ? bounty.allocations.filter(isRecord) : [];
    const counts = { pending: 0, submitted: 0, confirmed: 0, failed: 0, retryable: 0 };
    const lamports = { pending: 0n, submitted: 0n, confirmed: 0n, failed: 0n, retryable: 0n };
    for (const allocation of allocations) {
      const payout = isRecord(allocation.payout) ? allocation.payout : null;
      const status = payout ? readStatus(payout.status) : null;
      if (!status) {
        continue;
      }
      counts[status] += 1;
      lamports[status] += readBigint(allocation.amountLamports);
    }
    const entries = Array.isArray(bounty.ledgerEntries) ? bounty.ledgerEntries.filter(isRecord) : [];
    const buckets = bucketsFromEntries(entries.map((entry) => ({ entryType: readString(entry.entryType), amountLamports: readBigint(entry.amountLamports) })));
    return {
      bountyId,
      counts,
      lamportsByStatus: {
        pending: lamports.pending.toString(),
        submitted: lamports.submitted.toString(),
        confirmed: lamports.confirmed.toString(),
        failed: lamports.failed.toString(),
        retryable: lamports.retryable.toString(),
      },
      buckets: {
        funded: buckets.funded.toString(),
        reserved: buckets.reserved.toString(),
        paid: buckets.paid.toString(),
        refundable: buckets.refundable.toString(),
        refunded: buckets.refunded.toString(),
      },
    };
  }

  async solverPayouts(solverId: string): Promise<SolverPayoutView[]> {
    const rows = await this.client().payout.findMany({ where: { allocation: { solverId } }, include: payoutInclude() });
    return Array.isArray(rows) ? rows.filter(isRecord).map(solverView) : [];
  }

  async adminPayouts(): Promise<AdminPayoutView[]> {
    const rows = await this.client().payout.findMany({ include: payoutInclude(), orderBy: { createdAt: "asc" } });
    return Array.isArray(rows) ? rows.filter(isRecord).map(adminView) : [];
  }

  private client(): PrismaLike {
    const client = this.database?.activeClient;
    if (!client || !isPrismaLike(client)) {
      throw new BountyFlowError(503, "NOT_READY", "Payout storage is not ready.");
    }
    return client;
  }
}

function payoutInclude(): Record<string, unknown> {
  return {
    allocation: { include: { solver: true, bounty: true } },
    ledgerEntries: { include: { chainTransaction: true } },
    chainTransactions: true,
  };
}

function snapshot(value: Record<string, unknown>): PayoutSnapshot {
  const allocation = isRecord(value.allocation) ? value.allocation : null;
  const solver = allocation && isRecord(allocation.solver) ? allocation.solver : null;
  const bounty = allocation && isRecord(allocation.bounty) ? allocation.bounty : null;
  if (!allocation || !solver || !bounty) {
    throw new BountyFlowError(500, "INTERNAL", "Internal server error");
  }
  const chains = Array.isArray(value.chainTransactions) ? value.chainTransactions.filter(isRecord) : [];
  const entries = Array.isArray(value.ledgerEntries) ? value.ledgerEntries.filter(isRecord) : [];
  const reserved = entries.filter((entry) => entry.entryType === "reserve").reduce((sum, entry) => sum + readBigint(entry.amountLamports), 0n);
  const settled = entries.some((entry) => entry.entryType === "settle");
  const settledAmount = entries.filter((entry) => entry.entryType === "settle").reduce((sum, entry) => sum + readBigint(entry.amountLamports), 0n);
  return {
    id: readString(value.id),
    bountyId: readString(bounty.id),
    amountLamports: readBigint(allocation.amountLamports),
    solverWallet: readString(solver.walletAddress),
    status: readStatus(value.status),
    sendCount: readInt(value.sendCount),
    signatures: chains.map((chain) => ({ signature: readString(chain.signature), createdAt: readDate(chain.createdAt), commitment: readString(chain.commitment) })),
    reservedLamports: reserved - settledAmount,
    settled,
  };
}

function solverView(value: Record<string, unknown>): SolverPayoutView {
  const current = snapshot(value);
  return {
    id: current.id,
    bountyId: current.bountyId,
    amountLamports: current.amountLamports.toString(),
    status: current.status,
    signature: current.status === "confirmed" ? current.signatures.at(-1)?.signature ?? null : null,
  };
}

function adminView(value: Record<string, unknown>): AdminPayoutView {
  const current = snapshot(value);
  return {
    ...solverView(value),
    destination: current.solverWallet,
    sendCount: current.sendCount,
    lastError: typeof value.lastError === "string" ? value.lastError : null,
    signature: current.signatures.at(-1)?.signature ?? null,
  };
}

function isPrismaLike(value: ConnectedClient): value is ConnectedClient & PrismaLike {
  return "payout" in value && "rewardAllocation" in value && "bountyLedgerEntry" in value && "chainTransaction" in value && "bounty" in value && "$transaction" in value;
}

function readStatus(value: unknown): PayoutStatusName {
  if (value === "pending" || value === "submitted" || value === "confirmed" || value === "failed" || value === "retryable") {
    return value;
  }
  throw new BountyFlowError(500, "INTERNAL", "Internal server error");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new BountyFlowError(500, "INTERNAL", "Internal server error");
  }
  return value;
}

function readInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new BountyFlowError(500, "INTERNAL", "Internal server error");
  }
  return value;
}

function readBigint(value: unknown): bigint {
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number" && Number.isSafeInteger(value)) {
    return BigInt(value);
  }
  throw new BountyFlowError(500, "INTERNAL", "Internal server error");
}

function readDate(value: unknown): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  throw new BountyFlowError(500, "INTERNAL", "Internal server error");
}
