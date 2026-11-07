import { randomUUID } from "node:crypto";
import type { BountyDb, BountyWrite, OwnerBounty, PublicBountyRecord } from "./bounty.persistence";

export class FakeBountyDb implements BountyDb {
  readonly rows: OwnerBounty[] = [];

  async $transaction<T>(fn: (tx: BountyDb) => Promise<T>): Promise<T> {
    return fn(this);
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
