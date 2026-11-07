import { bucketsFromEntries } from "../bounties/funding-ledger";
import type {
  AdminPayoutView,
  CreatorPayoutSummary,
  PayoutSignature,
  PayoutSnapshot,
  PayoutStatusName,
  PayoutStore,
  RecordSendResult,
  SettleResult,
  SolverPayoutView,
} from "./payout.persistence";

type Chain = PayoutSignature & { source: string; destination: string; amountLamports: bigint };
type Ledger = { entryType: string; amountLamports: bigint; signature?: string };
type Row = {
  id: string;
  bountyId: string;
  creatorId: string;
  solverId: string;
  solverWallet: string;
  amountLamports: bigint;
  status: PayoutStatusName;
  sendCount: number;
  lastError: string | null;
  fundedLamports: bigint;
  chains: Chain[];
  ledger: Ledger[];
};

const emptyCounts = (): Record<PayoutStatusName, number> => ({ pending: 0, submitted: 0, confirmed: 0, failed: 0, retryable: 0 });

export class FakePayoutDb implements PayoutStore {
  readonly rows: Row[] = [];
  private tail: Promise<void> = Promise.resolve();

  seed(input: Omit<Row, "chains" | "ledger" | "sendCount" | "lastError" | "status"> & { status?: PayoutStatusName }): Row {
    const row: Row = {
      ...input,
      status: input.status ?? "pending",
      sendCount: 0,
      lastError: null,
      chains: [],
      ledger: [
        { entryType: "deposit", amountLamports: input.fundedLamports },
        { entryType: "reserve", amountLamports: input.amountLamports },
      ],
    };
    this.rows.push(row);
    return row;
  }

  async listActionable(limit: number): Promise<string[]> {
    return this.rows
      .filter((row) => row.status === "pending" || row.status === "submitted" || row.status === "retryable")
      .slice(0, limit)
      .map((row) => row.id);
  }

  async read(id: string): Promise<PayoutSnapshot | null> {
    const row = this.rows.find((item) => item.id === id);
    return row ? snapshot(row) : null;
  }

  async recordSend(input: { id: string; signature: string; source: string; destination: string; amountLamports: bigint; now: Date }): Promise<RecordSendResult> {
    return this.exclusive(async () => {
      const row = this.rows.find((item) => item.id === input.id);
      if (!row || input.amountLamports !== row.amountLamports || !canSign(row)) {
        return "blocked";
      }
      if (this.rows.some((item) => item.chains.some((chain) => chain.signature === input.signature))) {
        return "blocked";
      }
      row.chains.push({
        signature: input.signature,
        createdAt: input.now,
        commitment: "submitted",
        source: input.source,
        destination: input.destination,
        amountLamports: input.amountLamports,
      });
      row.status = "submitted";
      row.sendCount += 1;
      row.lastError = null;
      return "recorded";
    });
  }

  async noteRetryable(id: string, signature: string, commitment: "failed" | "expired"): Promise<void> {
    await this.exclusive(async () => {
      const row = this.rows.find((item) => item.id === id);
      const chain = row?.chains.find((item) => item.signature === signature);
      if (!row || !chain || row.status === "confirmed") {
        return;
      }
      chain.commitment = commitment;
      row.status = "retryable";
      row.lastError = commitment === "failed" ? "The transfer failed on Devnet." : "The transfer expired before confirmation.";
    });
  }

  async settle(input: { id: string; signature: string; commitment: "confirmed" | "finalized"; now: Date }): Promise<SettleResult> {
    return this.exclusive(async () => {
      const row = this.rows.find((item) => item.id === input.id);
      const chain = row?.chains.find((item) => item.signature === input.signature);
      if (!row || !chain || row.status === "confirmed") {
        return row?.status === "confirmed" ? "settled" : "blocked";
      }
      chain.commitment = input.commitment;
      if (!row.ledger.some((entry) => entry.entryType === "settle" && entry.signature === input.signature)) {
        row.ledger.push({ entryType: "settle", amountLamports: row.amountLamports, signature: input.signature });
      }
      row.status = "confirmed";
      row.lastError = null;
      return "settled";
    });
  }

  async note(id: string, message: string): Promise<void> {
    const row = this.rows.find((item) => item.id === id);
    if (row && row.status !== "confirmed") {
      row.lastError = message;
    }
  }

  async creatorSummary(bountyId: string, creatorId: string): Promise<CreatorPayoutSummary | "missing"> {
    const owned = this.rows.filter((row) => row.bountyId === bountyId && row.creatorId === creatorId);
    if (owned.length === 0 && !this.rows.some((row) => row.bountyId === bountyId)) {
      return "missing";
    }
    if (this.rows.some((row) => row.bountyId === bountyId && row.creatorId !== creatorId)) {
      return "missing";
    }
    return summary(bountyId, owned);
  }

  async solverPayouts(solverId: string): Promise<SolverPayoutView[]> {
    return this.rows.filter((row) => row.solverId === solverId).map(solverView);
  }

  async adminPayouts(): Promise<AdminPayoutView[]> {
    return this.rows.map(adminView);
  }

  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const run = this.tail.then(work, work);
    this.tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

function canSign(row: Row): boolean {
  if (row.status === "pending") {
    return row.chains.length === 0;
  }
  if (row.status !== "retryable") {
    return false;
  }
  return row.chains.every((chain) => chain.commitment === "failed" || chain.commitment === "expired");
}

function snapshot(row: Row): PayoutSnapshot {
  const buckets = bucketsFromEntries(row.ledger);
  return {
    id: row.id,
    bountyId: row.bountyId,
    amountLamports: row.amountLamports,
    solverWallet: row.solverWallet,
    status: row.status,
    sendCount: row.sendCount,
    signatures: row.chains.map((chain) => ({ signature: chain.signature, createdAt: chain.createdAt, commitment: chain.commitment })),
    reservedLamports: buckets.reserved,
    settled: row.ledger.some((entry) => entry.entryType === "settle"),
  };
}

function summary(bountyId: string, rows: Row[]): CreatorPayoutSummary {
  const counts = emptyCounts();
  const lamportsByStatus = { pending: 0n, submitted: 0n, confirmed: 0n, failed: 0n, retryable: 0n };
  for (const row of rows) {
    counts[row.status] += 1;
    lamportsByStatus[row.status] += row.amountLamports;
  }
  const buckets = bucketsFromEntries(rows.flatMap((row) => row.ledger));
  return {
    bountyId,
    counts,
    lamportsByStatus: {
      pending: lamportsByStatus.pending.toString(),
      submitted: lamportsByStatus.submitted.toString(),
      confirmed: lamportsByStatus.confirmed.toString(),
      failed: lamportsByStatus.failed.toString(),
      retryable: lamportsByStatus.retryable.toString(),
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

function solverView(row: Row): SolverPayoutView {
  return {
    id: row.id,
    bountyId: row.bountyId,
    amountLamports: row.amountLamports.toString(),
    status: row.status,
    signature: row.status === "confirmed" ? row.chains.at(-1)?.signature ?? null : null,
  };
}

function adminView(row: Row): AdminPayoutView {
  return { ...solverView(row), destination: row.solverWallet, sendCount: row.sendCount, lastError: row.lastError, signature: row.chains.at(-1)?.signature ?? null };
}
