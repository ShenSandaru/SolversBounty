import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RESEARCH_CONSENT_VERSION } from "@solversbounty/shared";
import { InMemoryRateLimit } from "../anti-abuse/in-memory-rate-limit";
import { decryptAnswer, parseAnswerKey } from "../bounties/answer-cipher";
import { BountyFlowError } from "../bounties/bounty.errors";
import type { ResearchAggregates, StoredSession } from "../bounties/bounty.persistence";
import { PrismaBountyRepository } from "../bounties/prisma-bounty.repository";
import { answersMatch } from "../verification/compare-answer";

export type SessionView = {
  id: string;
  bountyId: string;
  status: "active" | "completed";
  startedAt: string;
  attemptLimit: number;
  attemptsUsed: number;
  remainingAttempts: number;
  title: string;
  prompt: string;
  instructions: string;
  verificationMethod: StoredSession["verificationMethod"];
  rewardLamports: string;
  deadline: string;
  latest: {
    attemptNumber: number;
    isCorrect: boolean;
    ineligibilityReason: "pool_exhausted" | "insufficient_refundable" | null;
    rewardStatus: "pending" | null;
  } | null;
};

export type AnalyticsView = ResearchAggregates & { accuracy: string | null };

@Injectable()
export class SubmissionsService {
  constructor(
    @Optional() @Inject(PrismaBountyRepository) private readonly store?: PrismaBountyRepository,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly limits?: InMemoryRateLimit,
  ) {}

  async consent(userId: string, bountyId: string): Promise<{ policyVersion: string; acceptedAt: string }> {
    const saved = await this.db().recordConsent(bountyId, userId, new Date());
    if (saved === "missing") {
      throw new BountyFlowError(404, "NOT_FOUND", "Bounty not found.");
    }
    if (saved === "inactive") {
      throw new BountyFlowError(409, "CONFLICT", "This bounty is not open for new solvers.");
    }
    return { policyVersion: saved.policyVersion, acceptedAt: saved.acceptedAt.toISOString() };
  }

  async start(userId: string, bountyId: string): Promise<SessionView> {
    const started = await this.db().startSession(bountyId, userId, new Date());
    if (started === "missing") {
      throw new BountyFlowError(404, "NOT_FOUND", "Bounty not found.");
    }
    if (started === "no_consent") {
      throw new BountyFlowError(409, "CONFLICT", "Research consent is required before a solving session.");
    }
    if (started === "full") {
      throw new BountyFlowError(409, "CONFLICT", "This bounty has reached its rewarded solver cap.");
    }
    if (started === "inactive") {
      throw new BountyFlowError(409, "CONFLICT", "This bounty is not open for new solvers.");
    }
    return view(started);
  }

  async read(userId: string, sessionId: string): Promise<SessionView> {
    const session = await this.db().readSession(sessionId, userId);
    if (!session) {
      throw new BountyFlowError(404, "NOT_FOUND", "Solving session not found.");
    }
    return view(session);
  }

  async submit(userId: string, sessionId: string, answer: string): Promise<SessionView> {
    if (this.limits && !this.limits.allow(`submit:${userId}`, 30, 60_000)) {
      throw new BountyFlowError(429, "RATE_LIMITED", "Too many submissions. Try again in a minute.");
    }
    const key = parseAnswerKey(this.config?.get<string>("secrets.answerEncryptionKey") ?? undefined);
    const saved = await this.db().submitAnswer(sessionId, userId, answer, new Date(), ({ ciphertext, method }) => answersMatch(method, decryptAnswer(ciphertext, key), answer));
    if (saved.kind === "missing") {
      throw new BountyFlowError(404, "NOT_FOUND", "Solving session not found.");
    }
    if (saved.kind === "inactive") {
      throw new BountyFlowError(409, "CONFLICT", "This bounty is not open for another attempt.");
    }
    if (saved.kind === "limit" || saved.kind === "completed") {
      throw new BountyFlowError(409, "CONFLICT", "This solving session is complete.");
    }
    return view(saved.session);
  }

  async analytics(userId: string, bountyId: string): Promise<AnalyticsView> {
    const aggregates = await this.db().creatorAnalytics(bountyId, userId);
    if (aggregates === "missing") {
      throw new BountyFlowError(404, "NOT_FOUND", "Bounty not found.");
    }
    return {
      ...aggregates,
      accuracy: aggregates.attemptCount === 0 ? null : accuracyText(aggregates.correctCount, aggregates.attemptCount),
    };
  }

  policyVersion(): string {
    return RESEARCH_CONSENT_VERSION;
  }

  private db(): PrismaBountyRepository {
    if (!this.store) {
      throw new BountyFlowError(503, "NOT_READY", "Bounty storage is not ready.");
    }
    return this.store;
  }
}

function view(session: StoredSession): SessionView {
  const latest = session.attempts.at(-1) ?? null;
  return {
    id: session.id,
    bountyId: session.bountyId,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    attemptLimit: session.attemptLimit,
    attemptsUsed: session.attempts.length,
    remainingAttempts: Math.max(0, session.attemptLimit - session.attempts.length),
    title: session.title,
    prompt: session.prompt,
    instructions: session.instructions,
    verificationMethod: session.verificationMethod,
    rewardLamports: session.rewardLamports.toString(),
    deadline: session.deadline.toISOString(),
    latest: latest
      ? {
          attemptNumber: latest.attemptNumber,
          isCorrect: latest.isCorrect,
          ineligibilityReason: latest.ineligibilityReason,
          rewardStatus: latest.rewardReserved ? "pending" : null,
        }
      : null,
  };
}

function accuracyText(correct: number, total: number): string {
  const scaled = Math.floor((correct * 10_000) / total);
  return `${Math.floor(scaled / 10_000)}.${String(scaled % 10_000).padStart(4, "0")}`;
}
