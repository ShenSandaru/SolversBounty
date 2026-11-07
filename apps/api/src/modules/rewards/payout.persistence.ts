export type PayoutStatusName = "pending" | "submitted" | "confirmed" | "failed" | "retryable";

export type PayoutSignature = {
  signature: string;
  createdAt: Date;
  commitment: string;
};

export type PayoutSnapshot = {
  id: string;
  bountyId: string;
  amountLamports: bigint;
  solverWallet: string;
  status: PayoutStatusName;
  sendCount: number;
  signatures: PayoutSignature[];
  reservedLamports: bigint;
  settled: boolean;
};

export type PayoutBuckets = {
  funded: string;
  reserved: string;
  paid: string;
  refundable: string;
  refunded: string;
};

export type CreatorPayoutSummary = {
  bountyId: string;
  counts: Record<PayoutStatusName, number>;
  lamportsByStatus: Record<PayoutStatusName, string>;
  buckets: PayoutBuckets;
};

export type SolverPayoutView = {
  id: string;
  bountyId: string;
  amountLamports: string;
  status: PayoutStatusName;
  signature: string | null;
};

export type AdminPayoutView = SolverPayoutView & {
  destination: string;
  sendCount: number;
  lastError: string | null;
};

export type RecordSendResult = "recorded" | "blocked";
export type SettleResult = "settled" | "blocked";

export interface PayoutStore {
  listActionable(limit: number): Promise<string[]>;
  read(id: string): Promise<PayoutSnapshot | null>;
  recordSend(input: { id: string; signature: string; source: string; destination: string; amountLamports: bigint; now: Date }): Promise<RecordSendResult>;
  noteRetryable(id: string, signature: string, commitment: "failed" | "expired"): Promise<void>;
  settle(input: { id: string; signature: string; commitment: "confirmed" | "finalized"; now: Date }): Promise<SettleResult>;
  note(id: string, message: string): Promise<void>;
  creatorSummary(bountyId: string, creatorId: string): Promise<CreatorPayoutSummary | "missing">;
  solverPayouts(solverId: string): Promise<SolverPayoutView[]>;
  adminPayouts(): Promise<AdminPayoutView[]>;
}
