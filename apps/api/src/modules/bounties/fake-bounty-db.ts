import { randomUUID } from "node:crypto";
import type {
  ActivateFundingResult,
  ApplyFundingInput,
  ApplyFundingResult,
  BountyDb,
  BountyWrite,
  FundingPurposeName,
  FundingSnapshot,
  OwnerBounty,
  PublicBountyRecord,
  StoredObligation,
} from "./bounty.persistence";
import { bucketsFromEntries, depositReference } from "./funding-ledger";

type MutableFunding = StoredObligation & { id: string; bountyId: string; chainTransactionId: string | null };
type MutableChain = {
  id: string;
  signature: string;
  amountLamports: bigint;
  sourceAddress: string;
  destinationAddress: string;
  commitment: string;
};
type MutableLedger = { bountyId: string; entryType: string; amountLamports: bigint; fundingId: string; chainTransactionId: string };

export class FakeBountyDb implements BountyDb {
  readonly rows: OwnerBounty[] = [];
  private readonly fundings: MutableFunding[] = [];
  private readonly chains: MutableChain[] = [];
  private readonly ledger: MutableLedger[] = [];
  private readonly consumed = new Map<string, { bountyId: string; purpose: FundingPurposeName }>();
  private tail: Promise<void> = Promise.resolve();

  async $transaction<T>(fn: (tx: BountyDb) => Promise<T>): Promise<T> {
    return this.exclusive(() => fn(this));
  }

  async createBounty(input: BountyWrite): Promise<OwnerBounty> {
    const row = rowFrom(randomUUID(), input);
    this.rows.push(row);
    return clone(row);
  }

  async updateDraft(id: string, creatorId: string, input: BountyWrite): Promise<OwnerBounty | "missing" | "not_draft"> {
    const row = this.rows.find((item) => item.id === id && item.creatorId === creatorId);
    if (!row) {
      return "missing";
    }
    if (row.status !== "draft") {
      return "not_draft";
    }
    const next = rowFrom(id, input);
    next.createdAt = row.createdAt;
    Object.assign(row, next);
    return clone(row);
  }

  async findOwned(id: string, creatorId: string): Promise<OwnerBounty | null> {
    const row = this.rows.find((item) => item.id === id && item.creatorId === creatorId);
    return row ? clone(row) : null;
  }

  async listOwned(creatorId: string): Promise<OwnerBounty[]> {
    return this.rows
      .filter((item) => item.creatorId === creatorId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map(clone);
  }

  async listActive(): Promise<PublicBountyRecord[]> {
    return this.rows
      .filter((item) => item.status === "active")
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        instructions: item.instructions,
        prompt: item.question.prompt,
        category: item.category,
        verificationMethod: item.question.verificationMethod,
        status: item.status,
        rewardLamports: item.rewardLamports,
        maxRewardedSolvers: item.maxRewardedSolvers,
        attemptLimit: item.attemptLimit,
        deadline: item.deadline,
        closeReason: item.closeReason,
      }));
  }

  async ensureFunding(bountyId: string, creatorId: string, expected: Record<FundingPurposeName, bigint>, now: Date): Promise<FundingSnapshot | "missing" | "closed"> {
    return this.exclusive(async () => {
      const bounty = this.rows.find((item) => item.id === bountyId && item.creatorId === creatorId);
      if (!bounty) {
        return "missing";
      }
      if (bounty.status === "closed") {
        return "closed";
      }
      for (const purpose of ["reward_pool", "commission"] as const) {
        const current = this.fundings.find((item) => item.bountyId === bountyId && item.purpose === purpose);
        if (!current) {
          this.fundings.push({
            id: randomUUID(),
            bountyId,
            purpose,
            depositReference: depositReference(bountyId, purpose),
            expectedLamports: expected[purpose],
            observedLamports: null,
            status: "pending",
            signature: null,
            commitment: null,
            chainTransactionId: null,
          });
          continue;
        }
        if (current.chainTransactionId === null && current.status === "pending") {
          current.expectedLamports = expected[purpose];
        }
      }
      void now;
      return this.snapshot(bounty);
    });
  }

  async findSignature(signature: string): Promise<{ bountyId: string; purpose: FundingPurposeName } | null> {
    return this.consumed.get(signature) ?? null;
  }

  async applyFunding(input: ApplyFundingInput): Promise<ApplyFundingResult> {
    return this.exclusive(async () => {
      const bounty = this.rows.find((item) => item.id === input.bountyId && item.creatorId === input.creatorId);
      if (!bounty || bounty.status === "closed" || bounty.status === "active") {
        return { kind: "missing" };
      }
      const obligation = this.fundings.find((item) => item.bountyId === input.bountyId && item.purpose === input.purpose);
      if (!obligation) {
        return { kind: "missing" };
      }
      const existing = this.chains.find((item) => item.signature === input.signature);
      const existingFunding = existing ? this.fundings.find((item) => item.chainTransactionId === existing.id) : undefined;
      if (existingFunding && (existingFunding.bountyId !== input.bountyId || existingFunding.purpose !== input.purpose)) {
        return { kind: "signature_in_use" };
      }
      if (obligation.status === "confirmed" && obligation.signature === input.signature) {
        return { kind: "applied", snapshot: this.snapshot(bounty) };
      }
      if (obligation.status === "confirmed") {
        return { kind: "already_confirmed" };
      }
      const chain = existing ?? {
        id: randomUUID(),
        signature: input.signature,
        amountLamports: input.amountLamports,
        sourceAddress: input.sourceAddress,
        destinationAddress: input.destinationAddress,
        commitment: input.commitment,
      };
      if (!existing) {
        this.chains.push(chain);
      }
      this.consumed.set(input.signature, { bountyId: input.bountyId, purpose: input.purpose });
      obligation.chainTransactionId = chain.id;
      obligation.signature = input.signature;
      obligation.commitment = input.commitment;
      obligation.observedLamports = input.amountLamports;
      obligation.status = input.rejected ? "rejected" : "confirmed";
      if (!input.rejected && input.purpose === "reward_pool" && !this.ledger.some((item) => item.chainTransactionId === chain.id && item.entryType === "deposit")) {
        this.ledger.push({
          bountyId: input.bountyId,
          entryType: "deposit",
          amountLamports: input.amountLamports,
          fundingId: obligation.id,
          chainTransactionId: chain.id,
        });
      }
      if (bounty.status === "draft") {
        bounty.status = "funding_pending";
        bounty.updatedAt = input.now;
      }
      return { kind: "applied", snapshot: this.snapshot(bounty) };
    });
  }

  async activateIfFunded(bountyId: string, creatorId: string, now: Date): Promise<ActivateFundingResult> {
    return this.exclusive(async () => {
      const bounty = this.rows.find((item) => item.id === bountyId && item.creatorId === creatorId);
      if (!bounty) {
        return "missing";
      }
      if (bounty.status === "closed") {
        return "closed";
      }
      if (bounty.status === "active") {
        return clone(bounty);
      }
      const pool = this.fundings.find((item) => item.bountyId === bountyId && item.purpose === "reward_pool");
      const commission = this.fundings.find((item) => item.bountyId === bountyId && item.purpose === "commission");
      if (!pool || !commission || pool.status !== "confirmed" || commission.status !== "confirmed") {
        return "incomplete";
      }
      bounty.status = "active";
      bounty.updatedAt = now;
      return clone(bounty);
    });
  }

  private snapshot(bounty: OwnerBounty): FundingSnapshot {
    const obligations = this.fundings
      .filter((item) => item.bountyId === bounty.id)
      .map((item) => ({
        purpose: item.purpose,
        depositReference: item.depositReference,
        expectedLamports: item.expectedLamports,
        observedLamports: item.observedLamports,
        status: item.status,
        signature: item.signature,
        commitment: item.commitment,
      }));
    return {
      bounty: clone(bounty),
      obligations,
      buckets: bucketsFromEntries(this.ledger.filter((item) => item.bountyId === bounty.id)),
    };
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

function rowFrom(id: string, input: BountyWrite): OwnerBounty {
  return {
    id,
    creatorId: input.creatorId,
    title: input.title,
    description: input.description,
    instructions: input.instructions,
    category: input.category,
    rewardLamports: input.rewardLamports,
    maxRewardedSolvers: input.maxRewardedSolvers,
    attemptLimit: input.attemptLimit,
    deadline: input.deadline,
    status: "draft",
    closeReason: null,
    createdAt: input.now,
    updatedAt: input.now,
    question: {
      bountyId: id,
      prompt: input.prompt,
      expectedAnswerCiphertext: input.expectedAnswerCiphertext,
      encryptionKeyId: input.encryptionKeyId,
      verificationMethod: input.verificationMethod,
    },
  };
}

function clone(row: OwnerBounty): OwnerBounty {
  return {
    ...row,
    question: { ...row.question },
  };
}
