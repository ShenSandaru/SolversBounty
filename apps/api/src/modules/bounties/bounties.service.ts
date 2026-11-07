import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createBountyInputSchema, parseSolToLamports, principalLamports } from "@solversbounty/shared";
import { ANSWER_KEY_ID, decryptAnswer, encryptAnswer, parseAnswerKey } from "./answer-cipher";
import { BountyFlowError } from "./bounty.errors";
import type { BountyDb, OwnerBounty, PublicBountyRecord } from "./bounty.persistence";
import { PrismaBountyRepository } from "./prisma-bounty.repository";

const MAX_REWARDED_SOLVERS = 100_000;
const MAX_PRINCIPAL = 1_000_000n * 1_000_000_000n;

export type BountyInput = {
  title: string;
  description: string;
  instructions: string;
  prompt: string;
  category: "logic" | "mathematics" | "numerical_patterns" | "ciphers";
  expectedAnswer: string;
  verificationMethod: "exact" | "case_insensitive" | "normalized_text" | "numeric_exact";
  rewardSol: string;
  maxRewardedSolvers: number;
  attemptLimit: number;
  deadline: string;
};

export type PrivateBounty = {
  id: string;
  title: string;
  description: string;
  instructions: string;
  prompt: string;
  category: BountyInput["category"];
  verificationMethod: BountyInput["verificationMethod"];
  expectedAnswer: string;
  rewardLamports: string;
  principalLamports: string;
  commissionLamports: string;
  maxRewardedSolvers: number;
  attemptLimit: number;
  deadline: string;
  status: "draft" | "funding_pending" | "active" | "closed";
  closeReason: string | null;
};

export type PublicBountyView = Omit<PrivateBounty, "expectedAnswer"> & { rewardedCount: number };

@Injectable()
export class BountiesService {
  constructor(
    @Optional() @Inject(PrismaBountyRepository) private readonly store?: BountyDb,
    @Optional() private readonly config?: ConfigService,
  ) {}

  create(creatorId: string, input: unknown): Promise<PrivateBounty> {
    return this.save(creatorId, input, null);
  }

  update(creatorId: string, id: string, input: unknown): Promise<PrivateBounty> {
    return this.save(creatorId, input, id);
  }

  async owned(creatorId: string, id: string): Promise<PrivateBounty> {
    const row = await this.db().findOwned(id, creatorId);
    if (!row) {
      throw new BountyFlowError(404, "NOT_FOUND", "Bounty not found.");
    }
    return this.privateView(row);
  }

  async mine(creatorId: string): Promise<PrivateBounty[]> {
    const rows = await this.db().listOwned(creatorId);
    return rows.map((row) => this.privateView(row));
  }

  async active(): Promise<PublicBountyView[]> {
    const rows = await this.db().listActive();
    return rows.map((row) => this.publicView(row));
  }

  async activate(creatorId: string, id: string): Promise<PrivateBounty> {
    const result = await this.db().activateIfFunded(id, creatorId, this.now());
    if (result === "missing") {
      throw new BountyFlowError(404, "NOT_FOUND", "Bounty not found.");
    }
    if (result === "closed" || result === "incomplete") {
      throw new BountyFlowError(
        409,
        "CONFLICT",
        "Reward-pool funding and the separate 5% commission must both be verified before activation.",
      );
    }
    return this.privateView(result);
  }

  private async save(creatorId: string, input: unknown, id: string | null): Promise<PrivateBounty> {
    const parsed = this.parse(input);
    const reward = parsed.rewardLamports;
    const principal = principalLamports(reward, parsed.maxRewardedSolvers);
    if (principal <= 0n || principal > MAX_PRINCIPAL) {
      throw new BountyFlowError(400, "VALIDATION_ERROR", "The reward pool is outside the supported range.");
    }
    const key = parseAnswerKey(this.config?.get<string>("secrets.answerEncryptionKey") ?? undefined);
    const write = {
      creatorId,
      title: parsed.title,
      description: parsed.description,
      instructions: parsed.instructions,
      category: parsed.category,
      rewardLamports: reward,
      maxRewardedSolvers: parsed.maxRewardedSolvers,
      attemptLimit: parsed.attemptLimit,
      deadline: parsed.deadline,
      prompt: parsed.prompt,
      expectedAnswerCiphertext: encryptAnswer(parsed.expectedAnswer, key),
      encryptionKeyId: ANSWER_KEY_ID,
      verificationMethod: parsed.verificationMethod,
      now: this.now(),
    };
    const saved = id === null ? await this.db().createBounty(write) : await this.db().updateDraft(id, creatorId, write);
    if (saved === "missing") {
      throw new BountyFlowError(404, "NOT_FOUND", "Bounty not found.");
    }
    if (saved === "not_draft") {
      throw new BountyFlowError(409, "CONFLICT", "Only a draft can be edited.");
    }
    return this.privateView(saved);
  }

  private parse(input: unknown): Omit<BountyInput, "rewardSol" | "deadline"> & { rewardLamports: bigint; deadline: Date } {
    const parsed = createBountyInputSchema(this.now()).safeParse(input);
    if (!parsed.success) {
      throw new BountyFlowError(400, "VALIDATION_ERROR", "Request validation failed.");
    }
    if (parsed.data.maxRewardedSolvers > MAX_REWARDED_SOLVERS) {
      throw new BountyFlowError(400, "VALIDATION_ERROR", "Enter 100000 rewarded solvers or fewer.");
    }
    const rewardLamports = parseSolToLamports(parsed.data.rewardSol);
    if (rewardLamports === null || rewardLamports <= 0n) {
      throw new BountyFlowError(400, "VALIDATION_ERROR", "Enter a positive SOL amount with at most 9 decimal places.");
    }
    const deadline = new Date(parsed.data.deadline);
    if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= this.now().getTime()) {
      throw new BountyFlowError(400, "VALIDATION_ERROR", "Choose a deadline in the future.");
    }
    return { ...parsed.data, rewardLamports, deadline };
  }

  private privateView(row: OwnerBounty): PrivateBounty {
    const key = parseAnswerKey(this.config?.get<string>("secrets.answerEncryptionKey") ?? undefined);
    if (row.question.encryptionKeyId !== ANSWER_KEY_ID) {
      throw new BountyFlowError(500, "INTERNAL", "Internal server error");
    }
    const amounts = amountsFor(row.rewardLamports, row.maxRewardedSolvers);
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      instructions: row.instructions,
      prompt: row.question.prompt,
      category: row.category,
      verificationMethod: row.question.verificationMethod,
      expectedAnswer: decryptAnswer(row.question.expectedAnswerCiphertext, key),
      ...amounts,
      maxRewardedSolvers: row.maxRewardedSolvers,
      attemptLimit: row.attemptLimit,
      deadline: row.deadline.toISOString(),
      status: row.status,
      closeReason: row.closeReason,
    };
  }

  private publicView(row: PublicBountyRecord): PublicBountyView {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      instructions: row.instructions,
      prompt: row.prompt,
      category: row.category,
      verificationMethod: row.verificationMethod,
      ...amountsFor(row.rewardLamports, row.maxRewardedSolvers),
      maxRewardedSolvers: row.maxRewardedSolvers,
      attemptLimit: row.attemptLimit,
      deadline: row.deadline.toISOString(),
      status: row.status,
      closeReason: row.closeReason,
      rewardedCount: 0,
    };
  }

  private db(): BountyDb {
    if (!this.store) {
      throw new BountyFlowError(503, "NOT_READY", "Bounty storage is not ready.");
    }
    return this.store;
  }

  protected now(): Date {
    return new Date();
  }
}

export function commissionLamports(principal: bigint): bigint {
  return (principal * 5n) / 100n;
}

function amountsFor(rewardLamports: bigint, maxRewardedSolvers: number): {
  rewardLamports: string;
  principalLamports: string;
  commissionLamports: string;
} {
  const principal = principalLamports(rewardLamports, maxRewardedSolvers);
  return {
    rewardLamports: rewardLamports.toString(),
    principalLamports: principal.toString(),
    commissionLamports: commissionLamports(principal).toString(),
  };
}
