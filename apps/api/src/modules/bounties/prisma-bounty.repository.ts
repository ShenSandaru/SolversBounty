import { Inject, Injectable, Optional } from "@nestjs/common";
import { DatabaseService, type ConnectedClient } from "../../database/database.service";
import { BountyFlowError } from "./bounty.errors";
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
import { capacityDecision } from "../rewards/eligibility";
import { bucketsFromEntries, depositReference } from "./funding-ledger";
import type { ResearchAggregates, StoredSession, SubmitAnswerResult, VerificationMethodName } from "./bounty.persistence";

type RowDelegate = {
  findUnique(args: unknown): Promise<unknown>;
  findFirst(args: unknown): Promise<unknown>;
  findMany(args: unknown): Promise<unknown>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  count(args: unknown): Promise<unknown>;
};

type PrismaLike = {
  $transaction<T>(fn: (tx: PrismaLike) => Promise<T>): Promise<T>;
  bounty: {
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
    updateMany(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<unknown>;
  };
  consentRecord: RowDelegate;
  solvingSession: RowDelegate;
  submissionAttempt: RowDelegate;
  rewardAllocation: RowDelegate;
  payout: RowDelegate;
  bountyFunding: {
    findMany(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
  };
  chainTransaction: {
    findUnique(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
  };
  bountyLedgerEntry: {
    findMany(args: unknown): Promise<unknown>;
    create(args: unknown): Promise<unknown>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
  $queryRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
};

@Injectable()
export class PrismaBountyRepository implements BountyDb {
  constructor(@Optional() @Inject(DatabaseService) private readonly database?: DatabaseService) {}

  async $transaction<T>(fn: (tx: BountyDb) => Promise<T>): Promise<T> {
    return fn(this);
  }

  async createBounty(input: BountyWrite): Promise<OwnerBounty> {
    const client = this.client();
    return client.$transaction(async (tx) => {
      const created = readOwner(
        await tx.bounty.create({
          data: bountyData(input),
          include: { question: true },
        }),
      );
      await tx.auditLog.create({
        data: {
          actorUserId: input.creatorId,
          action: "bounty.draft_saved",
          entityType: "bounty",
          entityId: created.id,
          metadata: {},
        },
      });
      return created;
    });
  }

  async updateDraft(id: string, creatorId: string, input: BountyWrite): Promise<OwnerBounty | "missing" | "not_draft"> {
    const client = this.client();
    return client.$transaction(async (tx) => {
      const existing = await tx.bounty.findUnique({
        where: { id },
        select: { creatorId: true, status: true },
      });
      if (!isRecord(existing) || existing.creatorId !== creatorId) {
        return "missing";
      }
      if (existing.status !== "draft") {
        return "not_draft";
      }
      const updated = readOwner(
        await tx.bounty.update({
          where: { id },
          data: {
            ...bountyFields(input),
            question: {
              update: {
                prompt: input.prompt,
                expectedAnswerCiphertext: input.expectedAnswerCiphertext,
                encryptionKeyId: input.encryptionKeyId,
                verificationMethod: input.verificationMethod,
              },
            },
          },
          include: { question: true },
        }),
      );
      await tx.auditLog.create({
        data: {
          actorUserId: creatorId,
          action: "bounty.draft_updated",
          entityType: "bounty",
          entityId: id,
          metadata: {},
        },
      });
      return updated;
    });
  }

  async findOwned(id: string, creatorId: string): Promise<OwnerBounty | null> {
    const found = await this.client().bounty.findUnique({
      where: { id },
      include: { question: true },
    });
    if (!isRecord(found) || found.creatorId !== creatorId) {
      return null;
    }
    return readOwner(found);
  }

  async listOwned(creatorId: string): Promise<OwnerBounty[]> {
    const rows = await this.client().bounty.findMany({
      where: { creatorId },
      include: { question: true },
      orderBy: { createdAt: "desc" },
    });
    if (!Array.isArray(rows)) {
      throw new BountyFlowError(500, "INTERNAL", "Internal server error");
    }
    return rows.map(readOwner);
  }

  async ensureFunding(bountyId: string, creatorId: string, expected: Record<FundingPurposeName, bigint>, now: Date): Promise<FundingSnapshot | "missing" | "closed"> {
    return this.client().$transaction((tx) => this.writeFunding(tx, bountyId, creatorId, expected, now));
  }

  async findSignature(signature: string): Promise<{ bountyId: string; purpose: FundingPurposeName } | null> {
    const chain = await this.client().chainTransaction.findUnique({ where: { signature }, include: { fundings: true } });
    if (!isRecord(chain)) {
      return null;
    }
    if (!Array.isArray(chain.fundings) || !isRecord(chain.fundings[0])) {
      return { bountyId: "", purpose: "reward_pool" };
    }
    const purpose = chain.fundings[0].purpose;
    if (purpose !== "reward_pool" && purpose !== "commission") {
      return null;
    }
    return { bountyId: readString(chain.fundings[0].bountyId), purpose };
  }

  async applyFunding(input: ApplyFundingInput): Promise<ApplyFundingResult> {
    return this.client().$transaction((tx) => this.persistFunding(tx, input));
  }

  async activateIfFunded(bountyId: string, creatorId: string, now: Date): Promise<ActivateFundingResult> {
    return this.client().$transaction(async (tx) => {
      await tx.$queryRawUnsafe("select id from bounties where id = $1::uuid for update", bountyId);
      const found = await tx.bounty.findUnique({ where: { id: bountyId }, include: { question: true, fundings: true } });
      if (!isRecord(found) || found.creatorId !== creatorId) {
        return "missing";
      }
      if (found.status === "closed") {
        return "closed";
      }
      if (found.status === "active") {
        return readOwner(found);
      }
      const fundings = Array.isArray(found.fundings) ? found.fundings.filter(isRecord) : [];
      const pool = fundings.find((item) => item.purpose === "reward_pool");
      const commission = fundings.find((item) => item.purpose === "commission");
      if (!pool || !commission || pool.status !== "confirmed" || commission.status !== "confirmed") {
        return "incomplete";
      }
      const updated = await tx.bounty.update({
        where: { id: bountyId },
        data: { status: "active", publishedAt: now },
        include: { question: true },
      });
      await tx.auditLog.create({
        data: { actorUserId: creatorId, action: "bounty.activated", entityType: "bounty", entityId: bountyId, metadata: {} },
      });
      return readOwner(updated);
    });
  }

  async listActive(now: Date): Promise<PublicBountyRecord[]> {
    const client = this.client();
    await client.bounty.updateMany({
      where: { status: "active", deadline: { lte: now } },
      data: { status: "closed", closeReason: "deadline", closedAt: now },
    });
    const rows = await client.bounty.findMany({
      where: { status: "active", deadline: { gt: now } },
      orderBy: { deadline: "asc" },
      select: publicSelect(),
    });
    if (!Array.isArray(rows)) {
      throw new BountyFlowError(500, "INTERNAL", "Internal server error");
    }
    return rows.map(readPublic);
  }

  private async writeFunding(tx: PrismaLike, bountyId: string, creatorId: string, expected: Record<FundingPurposeName, bigint>, now: Date): Promise<FundingSnapshot | "missing" | "closed"> {
    await tx.$queryRawUnsafe("select id from bounties where id = $1::uuid for update", bountyId);
    const found = await tx.bounty.findUnique({ where: { id: bountyId }, include: { question: true, fundings: { include: { chainTransaction: true } }, ledgerEntries: true } });
    if (!isRecord(found) || found.creatorId !== creatorId) {
      return "missing";
    }
    if (found.status === "closed") {
      return "closed";
    }
    const fundings = Array.isArray(found.fundings) ? found.fundings.filter(isRecord) : [];
    for (const purpose of ["reward_pool", "commission"] as const) {
      const current = fundings.find((item) => item.purpose === purpose);
      if (!current) {
        await tx.bountyFunding.create({
          data: {
            bountyId,
            purpose,
            depositReference: depositReference(bountyId, purpose),
            expectedLamports: expected[purpose],
            status: "pending",
          },
        });
        continue;
      }
      if (current.chainTransactionId === null && current.status === "pending" && readBigint(current.expectedLamports) !== expected[purpose]) {
        await tx.bountyFunding.update({ where: { id: readString(current.id) }, data: { expectedLamports: expected[purpose] } });
      }
    }
    void now;
    const reread = await tx.bounty.findUnique({ where: { id: bountyId }, include: { question: true, fundings: { include: { chainTransaction: true } }, ledgerEntries: true } });
    return snapshotOf(reread);
  }

  private async persistFunding(tx: PrismaLike, input: ApplyFundingInput): Promise<ApplyFundingResult> {
    await tx.$queryRawUnsafe("select id from bounties where id = $1::uuid for update", input.bountyId);
    const found = await tx.bounty.findUnique({ where: { id: input.bountyId }, include: { question: true, fundings: { include: { chainTransaction: true } }, ledgerEntries: true } });
    if (!isRecord(found) || found.creatorId !== input.creatorId || found.status === "closed" || found.status === "active") {
      return { kind: "missing" };
    }
    const fundings = Array.isArray(found.fundings) ? found.fundings.filter(isRecord) : [];
    const obligation = fundings.find((item) => item.purpose === input.purpose);
    if (!obligation) {
      return { kind: "missing" };
    }
    const existing = await tx.chainTransaction.findUnique({ where: { signature: input.signature }, include: { fundings: true } });
    if (isRecord(existing) && Array.isArray(existing.fundings)) {
      const other = existing.fundings.filter(isRecord).find((item) => item.bountyId !== input.bountyId || item.purpose !== input.purpose);
      if (other) {
        return { kind: "signature_in_use" };
      }
    }
    if (obligation.status === "confirmed" && readSignature(obligation) === input.signature) {
      return { kind: "applied", snapshot: snapshotOf(found) };
    }
    if (obligation.status === "confirmed") {
      return { kind: "already_confirmed" };
    }
    const chain = isRecord(existing)
      ? existing
      : await tx.chainTransaction.create({
          data: {
            signature: input.signature,
            kind: "deposit",
            amountLamports: input.amountLamports,
            sourceAddress: input.sourceAddress,
            destinationAddress: input.destinationAddress,
            commitment: input.commitment,
            confirmedAt: input.rejected ? null : input.now,
          },
        });
    if (!isRecord(chain)) {
      throw new BountyFlowError(500, "INTERNAL", "Internal server error");
    }
    await tx.bountyFunding.update({
      where: { id: readString(obligation.id) },
      data: {
        chainTransactionId: readString(chain.id),
        observedLamports: input.amountLamports,
        status: input.rejected ? "rejected" : "confirmed",
        confirmedAt: input.rejected ? null : input.now,
      },
    });
    if (!input.rejected && input.purpose === "reward_pool") {
      const entries = Array.isArray(found.ledgerEntries) ? found.ledgerEntries.filter(isRecord) : [];
      const posted = entries.some((item) => item.chainTransactionId === chain.id && item.entryType === "deposit");
      if (!posted) {
        await tx.bountyLedgerEntry.create({
          data: {
            bountyId: input.bountyId,
            entryType: "deposit",
            amountLamports: input.amountLamports,
            fundingId: readString(obligation.id),
            chainTransactionId: readString(chain.id),
          },
        });
      }
    }
    if (found.status === "draft") {
      await tx.bounty.update({ where: { id: input.bountyId }, data: { status: "funding_pending" } });
    }
    await tx.auditLog.create({
      data: {
        actorUserId: input.creatorId,
        action: input.rejected ? "funding.rejected" : `funding.${input.purpose}_confirmed`,
        entityType: "bounty",
        entityId: input.bountyId,
        metadata: {},
      },
    });
    const reread = await tx.bounty.findUnique({ where: { id: input.bountyId }, include: { question: true, fundings: { include: { chainTransaction: true } }, ledgerEntries: true } });
    return { kind: "applied", snapshot: snapshotOf(reread) };
  }

  async findPublic(id: string, now: Date): Promise<PublicBountyRecord | null> {
    const client = this.client();
    await client.bounty.updateMany({ where: { id, status: "active", deadline: { lte: now } }, data: { status: "closed", closeReason: "deadline", closedAt: now } });
    const found = await client.bounty.findUnique({ where: { id }, select: publicSelect() });
    if (!isRecord(found) || found.status === "draft" || found.status === "funding_pending") {
      return null;
    }
    return readPublic(found);
  }

  async recordConsent(bountyId: string, userId: string, now: Date): Promise<{ id: string; policyVersion: string; acceptedAt: Date } | "missing" | "inactive"> {
    return this.client().$transaction(async (tx) => {
      await tx.$queryRawUnsafe("select id from bounties where id = $1::uuid for update", bountyId);
      const bounty = await tx.bounty.findUnique({ where: { id: bountyId } });
      if (!isRecord(bounty) || bounty.status === "draft" || bounty.status === "funding_pending") {
        return "missing";
      }
      if (bounty.status !== "active" || readDate(bounty.deadline).getTime() <= now.getTime()) {
        if (bounty.status === "active") {
          await tx.bounty.update({ where: { id: bountyId }, data: { status: "closed", closeReason: "deadline", closedAt: now } });
        }
        return "inactive";
      }
      const existing = await tx.consentRecord.findFirst({ where: { bountyId, userId } });
      if (isRecord(existing)) {
        return { id: readString(existing.id), policyVersion: "research-consent-v1", acceptedAt: readDate(existing.acceptedAt) };
      }
      const created = await tx.consentRecord.create({ data: { bountyId, userId, policyVersion: "research-consent-v1", acceptedAt: now } });
      if (!isRecord(created)) {
        throw new BountyFlowError(500, "INTERNAL", "Internal server error");
      }
      return { id: readString(created.id), policyVersion: "research-consent-v1", acceptedAt: now };
    });
  }

  async startSession(bountyId: string, solverId: string, now: Date): Promise<StoredSession | "missing" | "no_consent" | "inactive" | "full"> {
    return this.client().$transaction(async (tx) => {
      await tx.$queryRawUnsafe("select id from bounties where id = $1::uuid for update", bountyId);
      const bounty = await tx.bounty.findUnique({ where: { id: bountyId }, include: { question: true } });
      if (!isRecord(bounty) || bounty.status === "draft" || bounty.status === "funding_pending") {
        return "missing";
      }
      if (bounty.status === "active" && readDate(bounty.deadline).getTime() <= now.getTime()) {
        await tx.bounty.update({ where: { id: bountyId }, data: { status: "closed", closeReason: "deadline", closedAt: now } });
        return "inactive";
      }
      if (bounty.status !== "active") {
        return bounty.closeReason === "fully_allocated" ? "full" : "inactive";
      }
      const allocationCount = await tx.rewardAllocation.count({ where: { bountyId } });
      if (readInt(allocationCount) >= readInt(bounty.maxRewardedSolvers)) {
        await tx.bounty.update({ where: { id: bountyId }, data: { status: "closed", closeReason: "fully_allocated", closedAt: now } });
        return "full";
      }
      const consent = await tx.consentRecord.findFirst({ where: { bountyId, userId: solverId } });
      if (!isRecord(consent)) {
        return "no_consent";
      }
      const existing = await tx.solvingSession.findFirst({ where: { bountyId, solverId }, include: sessionInclude() });
      if (isRecord(existing)) {
        return readSession(existing);
      }
      const created = await tx.solvingSession.create({
        data: { bountyId, solverId, consentId: readString(consent.id), startedAt: now, status: "active" },
        include: sessionInclude(),
      });
      return readSession(created);
    });
  }

  async readSession(sessionId: string, solverId: string): Promise<StoredSession | null> {
    const found = await this.client().solvingSession.findFirst({ where: { id: sessionId, solverId }, include: sessionInclude() });
    return isRecord(found) ? readSession(found) : null;
  }

  async submitAnswer(sessionId: string, solverId: string, answer: string, now: Date, decide: (input: { ciphertext: string; method: VerificationMethodName }) => boolean): Promise<SubmitAnswerResult> {
    return this.client().$transaction(async (tx) => {
      const session = await tx.solvingSession.findFirst({ where: { id: sessionId, solverId } });
      if (!isRecord(session)) {
        return { kind: "missing" };
      }
      const bountyId = readString(session.bountyId);
      await tx.$queryRawUnsafe("select id from bounties where id = $1::uuid for update", bountyId);
      const bounty = await tx.bounty.findUnique({ where: { id: bountyId }, include: { question: true, ledgerEntries: true } });
      const current = await tx.solvingSession.findFirst({ where: { id: sessionId, solverId }, include: sessionInclude() });
      if (!isRecord(bounty) || !isRecord(bounty.question) || !isRecord(current)) {
        return { kind: "missing" };
      }
      if (current.status === "completed") {
        return { kind: "completed" };
      }
      if (bounty.status === "active" && readDate(bounty.deadline).getTime() <= now.getTime()) {
        await tx.bounty.update({ where: { id: bountyId }, data: { status: "closed", closeReason: "deadline", closedAt: now } });
        return { kind: "inactive" };
      }
      if (bounty.status !== "active") {
        return { kind: "inactive" };
      }
      const prior = Array.isArray(current.attempts) ? current.attempts.length : 0;
      if (prior >= readInt(bounty.attemptLimit)) {
        await tx.solvingSession.update({ where: { id: sessionId }, data: { status: "completed" } });
        return { kind: "limit" };
      }
      const correct = decide({ ciphertext: readString(bounty.question.expectedAnswerCiphertext), method: readVerification(bounty.question.verificationMethod) });
      const entries = Array.isArray(bounty.ledgerEntries) ? bounty.ledgerEntries.filter(isRecord) : [];
      const buckets = bucketsFromEntries(entries.map((entry) => ({ entryType: readString(entry.entryType), amountLamports: readBigint(entry.amountLamports) })));
      const allocationCount = readInt(await tx.rewardAllocation.count({ where: { bountyId } }));
      const capacity = correct
        ? capacityDecision({ allocationCount, maxRewardedSolvers: readInt(bounty.maxRewardedSolvers), refundable: buckets.refundable, rewardLamports: readBigint(bounty.rewardLamports) })
        : null;
      const attempt = await tx.submissionAttempt.create({
        data: {
          sessionId,
          attemptNumber: prior + 1,
          submittedAnswer: answer,
          isCorrect: correct,
          ineligibilityReason: capacity && !capacity.reserve ? capacity.reason : null,
          submittedAt: now,
        },
      });
      if (!isRecord(attempt)) {
        throw new BountyFlowError(500, "INTERNAL", "Internal server error");
      }
      if (capacity?.reserve) {
        const allocation = await tx.rewardAllocation.create({
          data: { bountyId, solverId, attemptId: readString(attempt.id), amountLamports: readBigint(bounty.rewardLamports), status: "reserved" },
        });
        if (!isRecord(allocation)) {
          throw new BountyFlowError(500, "INTERNAL", "Internal server error");
        }
        const payout = await tx.payout.create({
          data: { allocationId: readString(allocation.id), idempotencyKey: `payout:${bountyId}:${solverId}`, status: "pending" },
        });
        if (!isRecord(payout)) {
          throw new BountyFlowError(500, "INTERNAL", "Internal server error");
        }
        await tx.bountyLedgerEntry.create({
          data: { bountyId, entryType: "reserve", amountLamports: readBigint(bounty.rewardLamports), payoutId: readString(payout.id) },
        });
        if (allocationCount + 1 >= readInt(bounty.maxRewardedSolvers)) {
          await tx.bounty.update({ where: { id: bountyId }, data: { status: "closed", closeReason: "fully_allocated", closedAt: now } });
        }
        await tx.solvingSession.update({ where: { id: sessionId }, data: { status: "completed" } });
      } else if (correct || prior + 1 >= readInt(bounty.attemptLimit)) {
        await tx.solvingSession.update({ where: { id: sessionId }, data: { status: "completed" } });
      }
      await tx.auditLog.create({ data: { actorUserId: solverId, action: "submission.recorded", entityType: "solving_session", entityId: sessionId, metadata: { correct, attemptNumber: prior + 1 } } });
      const reread = await tx.solvingSession.findFirst({ where: { id: sessionId, solverId }, include: sessionInclude() });
      return { kind: "stored", session: readSession(reread) };
    });
  }

  async creatorAnalytics(bountyId: string, creatorId: string): Promise<ResearchAggregates | "missing"> {
    const bounty = await this.client().bounty.findUnique({ where: { id: bountyId } });
    if (!isRecord(bounty) || bounty.creatorId !== creatorId) {
      return "missing";
    }
    const sessions = await this.client().solvingSession.findMany({
      where: { bountyId },
      select: { startedAt: true, attempts: { select: { isCorrect: true, submittedAt: true, attemptNumber: true } } },
    });
    if (!Array.isArray(sessions)) {
      throw new BountyFlowError(500, "INTERNAL", "Internal server error");
    }
    let correctCount = 0;
    let incorrectCount = 0;
    const durations: number[] = [];
    for (const session of sessions.filter(isRecord)) {
      const attempts = Array.isArray(session.attempts) ? session.attempts.filter(isRecord) : [];
      const first = attempts.filter((item) => item.isCorrect === true).sort((left, right) => readInt(left.attemptNumber) - readInt(right.attemptNumber))[0];
      if (first) {
        durations.push(readDate(first.submittedAt).getTime() - readDate(session.startedAt).getTime());
      }
      correctCount += attempts.filter((item) => item.isCorrect === true).length;
      incorrectCount += attempts.filter((item) => item.isCorrect === false).length;
    }
    return {
      participantCount: sessions.length,
      correctCount,
      incorrectCount,
      attemptCount: correctCount + incorrectCount,
      averageCompletionTimeMs: durations.length === 0 ? null : Math.floor(durations.reduce((sum, value) => sum + value, 0) / durations.length),
    };
  }

  private client(): PrismaLike {
    const client = this.database?.activeClient;
    if (!client || !isPrismaLike(client)) {
      throw new BountyFlowError(503, "NOT_READY", "Bounty storage is not ready.");
    }
    return client;
  }
}

function snapshotOf(value: unknown): FundingSnapshot {
  if (!isRecord(value)) {
    throw new BountyFlowError(500, "INTERNAL", "Internal server error");
  }
  const fundings = Array.isArray(value.fundings) ? value.fundings.filter(isRecord) : [];
  const entries = Array.isArray(value.ledgerEntries) ? value.ledgerEntries.filter(isRecord) : [];
  return {
    bounty: readOwner(value),
    obligations: fundings.map(readObligation),
    buckets: bucketsFromEntries(entries.map((entry) => ({ entryType: readString(entry.entryType), amountLamports: readBigint(entry.amountLamports) }))),
  };
}

function readObligation(value: Record<string, unknown>): StoredObligation {
  const purpose = value.purpose;
  if (purpose !== "reward_pool" && purpose !== "commission") {
    throw new BountyFlowError(500, "INTERNAL", "Internal server error");
  }
  const status = value.status;
  if (status !== "pending" && status !== "confirmed" && status !== "rejected") {
    throw new BountyFlowError(500, "INTERNAL", "Internal server error");
  }
  const chain = isRecord(value.chainTransaction) ? value.chainTransaction : null;
  return {
    purpose,
    depositReference: readString(value.depositReference),
    expectedLamports: readBigint(value.expectedLamports),
    observedLamports: value.observedLamports === null || value.observedLamports === undefined ? null : readBigint(value.observedLamports),
    status,
    signature: chain ? readString(chain.signature) : null,
    commitment: chain ? readString(chain.commitment) : null,
  };
}

function readSignature(value: Record<string, unknown>): string | null {
  return isRecord(value.chainTransaction) ? readString(value.chainTransaction.signature) : null;
}

function isPrismaLike(value: ConnectedClient): value is ConnectedClient & PrismaLike {
  return "bounty" in value && "bountyFunding" in value && "chainTransaction" in value && "bountyLedgerEntry" in value && "auditLog" in value && "consentRecord" in value && "solvingSession" in value && "submissionAttempt" in value && "rewardAllocation" in value && "payout" in value && "$transaction" in value;
}

function bountyData(input: BountyWrite): Record<string, unknown> {
  return {
    ...bountyFields(input),
    creatorId: input.creatorId,
    status: "draft",
    question: {
      create: {
        prompt: input.prompt,
        expectedAnswerCiphertext: input.expectedAnswerCiphertext,
        encryptionKeyId: input.encryptionKeyId,
        verificationMethod: input.verificationMethod,
      },
    },
  };
}

function bountyFields(input: BountyWrite): Record<string, unknown> {
  return {
    title: input.title,
    description: input.description,
    instructions: input.instructions,
    category: input.category,
    rewardLamports: input.rewardLamports,
    maxRewardedSolvers: input.maxRewardedSolvers,
    attemptLimit: input.attemptLimit,
    deadline: input.deadline,
  };
}

function readOwner(value: unknown): OwnerBounty {
  if (!isRecord(value) || !isRecord(value.question)) {
    throw new BountyFlowError(500, "INTERNAL", "Internal server error");
  }
  return {
    ...readBounty(value),
    question: {
      bountyId: readString(value.question.bountyId),
      prompt: readString(value.question.prompt),
      expectedAnswerCiphertext: readString(value.question.expectedAnswerCiphertext),
      encryptionKeyId: readString(value.question.encryptionKeyId),
      verificationMethod: readVerification(value.question.verificationMethod),
    },
  };
}

function readPublic(value: unknown): PublicBountyRecord {
  if (!isRecord(value) || !isRecord(value.question)) {
    throw new BountyFlowError(500, "INTERNAL", "Internal server error");
  }
  return {
    id: readString(value.id),
    title: readString(value.title),
    description: readString(value.description),
    instructions: readString(value.instructions),
    prompt: readString(value.question.prompt),
    category: readCategory(value.category),
    verificationMethod: readVerification(value.question.verificationMethod),
    status: readStatus(value.status),
    rewardLamports: readBigint(value.rewardLamports),
    maxRewardedSolvers: readInt(value.maxRewardedSolvers),
    attemptLimit: readInt(value.attemptLimit),
    deadline: readDate(value.deadline),
    closeReason: value.closeReason === null || value.closeReason === undefined ? null : readString(value.closeReason),
    rewardedCount: isRecord(value._count) ? readInt(value._count.allocations) : 0,
  };
}

function publicSelect(): Record<string, unknown> {
  return {
    id: true,
    title: true,
    description: true,
    instructions: true,
    category: true,
    status: true,
    rewardLamports: true,
    maxRewardedSolvers: true,
    attemptLimit: true,
    deadline: true,
    closeReason: true,
    question: { select: { prompt: true, verificationMethod: true } },
    _count: { select: { allocations: true } },
  };
}

function sessionInclude(): Record<string, unknown> {
  return {
    bounty: { include: { question: true } },
    attempts: { select: { attemptNumber: true, isCorrect: true, ineligibilityReason: true, submittedAt: true, allocation: { select: { id: true } } }, orderBy: { attemptNumber: "asc" } },
  };
}

function readSession(value: unknown): StoredSession {
  if (!isRecord(value) || !isRecord(value.bounty) || !isRecord(value.bounty.question)) {
    throw new BountyFlowError(500, "INTERNAL", "Internal server error");
  }
  const attempts = Array.isArray(value.attempts) ? value.attempts.filter(isRecord) : [];
  return {
    id: readString(value.id),
    bountyId: readString(value.bountyId),
    solverId: readString(value.solverId),
    status: value.status === "completed" ? "completed" : "active",
    startedAt: readDate(value.startedAt),
    attemptLimit: readInt(value.bounty.attemptLimit),
    title: readString(value.bounty.title),
    prompt: readString(value.bounty.question.prompt),
    instructions: readString(value.bounty.instructions),
    verificationMethod: readVerification(value.bounty.question.verificationMethod),
    rewardLamports: readBigint(value.bounty.rewardLamports),
    deadline: readDate(value.bounty.deadline),
    attempts: attempts.map((item) => ({
      attemptNumber: readInt(item.attemptNumber),
      isCorrect: item.isCorrect === true,
      ineligibilityReason: item.ineligibilityReason === "pool_exhausted" || item.ineligibilityReason === "insufficient_refundable" ? item.ineligibilityReason : null,
      submittedAt: readDate(item.submittedAt),
      rewardReserved: isRecord(item.allocation),
    })),
  };
}

function readBounty(value: Record<string, unknown>): Omit<OwnerBounty, "question"> {
  return {
    id: readString(value.id),
    creatorId: readString(value.creatorId),
    title: readString(value.title),
    description: readString(value.description),
    instructions: readString(value.instructions),
    category: readCategory(value.category),
    rewardLamports: readBigint(value.rewardLamports),
    maxRewardedSolvers: readInt(value.maxRewardedSolvers),
    attemptLimit: readInt(value.attemptLimit),
    deadline: readDate(value.deadline),
    status: readStatus(value.status),
    closeReason: value.closeReason === null || value.closeReason === undefined ? null : readString(value.closeReason),
    createdAt: readDate(value.createdAt),
    updatedAt: readDate(value.updatedAt),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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
  throw new BountyFlowError(500, "INTERNAL", "Internal server error");
}

function readDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  throw new BountyFlowError(500, "INTERNAL", "Internal server error");
}

function readCategory(value: unknown): OwnerBounty["category"] {
  if (value === "logic" || value === "mathematics" || value === "numerical_patterns" || value === "ciphers") {
    return value;
  }
  throw new BountyFlowError(500, "INTERNAL", "Internal server error");
}

function readStatus(value: unknown): OwnerBounty["status"] {
  if (value === "draft" || value === "funding_pending" || value === "active" || value === "closed") {
    return value;
  }
  throw new BountyFlowError(500, "INTERNAL", "Internal server error");
}

function readVerification(value: unknown): OwnerBounty["question"]["verificationMethod"] {
  if (value === "exact" || value === "case_insensitive" || value === "normalized_text" || value === "numeric_exact") {
    return value;
  }
  throw new BountyFlowError(500, "INTERNAL", "Internal server error");
}
