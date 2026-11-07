import { randomUUID } from "node:crypto";
import { capacityDecision } from "../rewards/eligibility";
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
  ResearchAggregates,
  StoredAttempt,
  StoredObligation,
  StoredSession,
  SubmitAnswerResult,
  VerificationMethodName,
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
type MutableLedger = { bountyId: string; entryType: string; amountLamports: bigint; fundingId?: string; chainTransactionId?: string; payoutId?: string };
type MutableConsent = { id: string; userId: string; bountyId: string; acceptedAt: Date };
type MutableSession = { id: string; bountyId: string; solverId: string; consentId: string; startedAt: Date; status: "active" | "completed" };
type MutableAttempt = StoredAttempt & { id: string; sessionId: string; answer: string };
type MutableAllocation = { id: string; bountyId: string; solverId: string; attemptId: string; amountLamports: bigint };

export class FakeBountyDb implements BountyDb {
  readonly rows: OwnerBounty[] = [];
  private readonly fundings: MutableFunding[] = [];
  private readonly chains: MutableChain[] = [];
  private readonly ledger: MutableLedger[] = [];
  private readonly consents: MutableConsent[] = [];
  private readonly sessions: MutableSession[] = [];
  private readonly attempts: MutableAttempt[] = [];
  private readonly allocations: MutableAllocation[] = [];
  private readonly payouts: { allocationId: string; idempotencyKey: string }[] = [];
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

  async listActive(now: Date): Promise<PublicBountyRecord[]> {
    this.closeExpired(now);
    return this.rows.filter((item) => item.status === "active" && item.deadline.getTime() > now.getTime()).map((item) => this.publicOf(item));
  }

  async findPublic(id: string, now: Date): Promise<PublicBountyRecord | null> {
    this.closeExpired(now);
    const row = this.rows.find((item) => item.id === id);
    if (!row || row.status === "draft" || row.status === "funding_pending") {
      return null;
    }
    return this.publicOf(row);
  }

  async recordConsent(bountyId: string, userId: string, now: Date): Promise<{ id: string; policyVersion: string; acceptedAt: Date } | "missing" | "inactive"> {
    return this.exclusive(async () => {
      const bounty = this.rows.find((item) => item.id === bountyId);
      if (!bounty || bounty.status === "draft" || bounty.status === "funding_pending") {
        return "missing";
      }
      if (bounty.status !== "active" || bounty.deadline.getTime() <= now.getTime()) {
        if (bounty.status === "active") {
          this.closeExpired(now);
        }
        return "inactive";
      }
      const existing = this.consents.find((item) => item.bountyId === bountyId && item.userId === userId);
      if (existing) {
        return { id: existing.id, policyVersion: "research-consent-v1", acceptedAt: existing.acceptedAt };
      }
      const created = { id: randomUUID(), userId, bountyId, acceptedAt: now };
      this.consents.push(created);
      return { id: created.id, policyVersion: "research-consent-v1", acceptedAt: created.acceptedAt };
    });
  }

  async startSession(bountyId: string, solverId: string, now: Date): Promise<StoredSession | "missing" | "no_consent" | "inactive" | "full"> {
    return this.exclusive(async () => {
      const bounty = this.rows.find((item) => item.id === bountyId);
      if (!bounty || bounty.status === "draft" || bounty.status === "funding_pending") {
        return "missing";
      }
      this.closeExpired(now);
      if (bounty.status !== "active") {
        return bounty.closeReason === "fully_allocated" ? "full" : "inactive";
      }
      if (this.allocations.filter((item) => item.bountyId === bountyId).length >= bounty.maxRewardedSolvers) {
        bounty.status = "closed";
        bounty.closeReason = "fully_allocated";
        bounty.updatedAt = now;
        return "full";
      }
      const consent = this.consents.find((item) => item.bountyId === bountyId && item.userId === solverId);
      if (!consent) {
        return "no_consent";
      }
      const existing = this.sessions.find((item) => item.bountyId === bountyId && item.solverId === solverId);
      if (existing) {
        return this.sessionOf(existing);
      }
      const created: MutableSession = { id: randomUUID(), bountyId, solverId, consentId: consent.id, startedAt: now, status: "active" };
      this.sessions.push(created);
      return this.sessionOf(created);
    });
  }

  async readSession(sessionId: string, solverId: string): Promise<StoredSession | null> {
    const session = this.sessions.find((item) => item.id === sessionId && item.solverId === solverId);
    return session ? this.sessionOf(session) : null;
  }

  async submitAnswer(sessionId: string, solverId: string, answer: string, now: Date, decide: (input: { ciphertext: string; method: VerificationMethodName }) => boolean): Promise<SubmitAnswerResult> {
    return this.exclusive(async () => {
      const session = this.sessions.find((item) => item.id === sessionId && item.solverId === solverId);
      if (!session) {
        return { kind: "missing" };
      }
      const bounty = this.rows.find((item) => item.id === session.bountyId);
      if (!bounty) {
        return { kind: "missing" };
      }
      this.closeExpired(now);
      if (session.status === "completed") {
        return { kind: "completed" };
      }
      if (bounty.status !== "active" || bounty.deadline.getTime() <= now.getTime()) {
        return { kind: "inactive" };
      }
      const prior = this.attempts.filter((item) => item.sessionId === session.id);
      if (prior.length >= bounty.attemptLimit) {
        session.status = "completed";
        return { kind: "limit" };
      }
      const correct = decide({ ciphertext: bounty.question.expectedAnswerCiphertext, method: bounty.question.verificationMethod });
      const buckets = bucketsFromEntries(this.ledger.filter((item) => item.bountyId === bounty.id));
      const allocationCount = this.allocations.filter((item) => item.bountyId === bounty.id).length;
      const capacity = correct ? capacityDecision({ allocationCount, maxRewardedSolvers: bounty.maxRewardedSolvers, refundable: buckets.refundable, rewardLamports: bounty.rewardLamports }) : null;
      const stored: MutableAttempt = {
        id: randomUUID(),
        sessionId: session.id,
        answer,
        attemptNumber: prior.length + 1,
        isCorrect: correct,
        ineligibilityReason: capacity && !capacity.reserve ? capacity.reason : null,
        submittedAt: now,
        rewardReserved: Boolean(capacity?.reserve),
      };
      this.attempts.push(stored);
      if (capacity?.reserve) {
        const allocation = { id: randomUUID(), bountyId: bounty.id, solverId, attemptId: stored.id, amountLamports: bounty.rewardLamports };
        this.allocations.push(allocation);
        this.payouts.push({ allocationId: allocation.id, idempotencyKey: `payout:${bounty.id}:${solverId}` });
        this.ledger.push({ bountyId: bounty.id, entryType: "reserve", amountLamports: bounty.rewardLamports, payoutId: allocation.id });
        if (this.allocations.filter((item) => item.bountyId === bounty.id).length >= bounty.maxRewardedSolvers) {
          bounty.status = "closed";
          bounty.closeReason = "fully_allocated";
          bounty.updatedAt = now;
        }
        session.status = "completed";
      } else if (correct || stored.attemptNumber >= bounty.attemptLimit) {
        session.status = "completed";
      }
      return { kind: "stored", session: this.sessionOf(session) };
    });
  }

  async creatorAnalytics(bountyId: string, creatorId: string): Promise<ResearchAggregates | "missing"> {
    const bounty = this.rows.find((item) => item.id === bountyId && item.creatorId === creatorId);
    if (!bounty) {
      return "missing";
    }
    const sessions = this.sessions.filter((item) => item.bountyId === bountyId);
    const attempts = this.attempts.filter((item) => sessions.some((session) => session.id === item.sessionId));
    const durations = sessions.flatMap((session) => {
      const first = attempts.filter((item) => item.sessionId === session.id && item.isCorrect).sort((left, right) => left.attemptNumber - right.attemptNumber)[0];
      return first ? [first.submittedAt.getTime() - session.startedAt.getTime()] : [];
    });
    return {
      participantCount: sessions.length,
      correctCount: attempts.filter((item) => item.isCorrect).length,
      incorrectCount: attempts.filter((item) => !item.isCorrect).length,
      attemptCount: attempts.length,
      averageCompletionTimeMs: durations.length === 0 ? null : Math.floor(durations.reduce((sum, value) => sum + value, 0) / durations.length),
    };
  }

  depositReward(bountyId: string, amount: bigint): void {
    this.ledger.push({ bountyId, entryType: "deposit", amountLamports: amount, chainTransactionId: randomUUID() });
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

  private closeExpired(now: Date): void {
    for (const bounty of this.rows) {
      if (bounty.status === "active" && bounty.deadline.getTime() <= now.getTime()) {
        bounty.status = "closed";
        bounty.closeReason = "deadline";
        bounty.updatedAt = now;
      }
    }
  }

  private publicOf(item: OwnerBounty): PublicBountyRecord {
    return {
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
      rewardedCount: this.allocations.filter((allocation) => allocation.bountyId === item.id).length,
    };
  }

  private sessionOf(session: MutableSession): StoredSession {
    const bounty = this.rows.find((item) => item.id === session.bountyId);
    if (!bounty) {
      throw new Error("Solving session is missing its bounty.");
    }
    const attempts = this.attempts
      .filter((item) => item.sessionId === session.id)
      .sort((left, right) => left.attemptNumber - right.attemptNumber)
      .map((item) => ({
        attemptNumber: item.attemptNumber,
        isCorrect: item.isCorrect,
        ineligibilityReason: item.ineligibilityReason,
        submittedAt: item.submittedAt,
        rewardReserved: item.rewardReserved,
      }));
    return {
      id: session.id,
      bountyId: session.bountyId,
      solverId: session.solverId,
      status: session.status,
      startedAt: session.startedAt,
      attemptLimit: bounty.attemptLimit,
      title: bounty.title,
      prompt: bounty.question.prompt,
      instructions: bounty.instructions,
      verificationMethod: bounty.question.verificationMethod,
      rewardLamports: bounty.rewardLamports,
      deadline: bounty.deadline,
      attempts,
    };
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
