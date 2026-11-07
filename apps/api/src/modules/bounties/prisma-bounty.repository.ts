import { Inject, Injectable, Optional } from "@nestjs/common";
import { DatabaseService, type ConnectedClient } from "../../database/database.service";
import { BountyFlowError } from "./bounty.errors";
import type { BountyDb, BountyWrite, OwnerBounty, PublicBountyRecord } from "./bounty.persistence";

type PrismaLike = {
  $transaction<T>(fn: (tx: PrismaLike) => Promise<T>): Promise<T>;
  bounty: {
    create(args: unknown): Promise<unknown>;
    update(args: unknown): Promise<unknown>;
    findUnique(args: unknown): Promise<unknown>;
    findMany(args: unknown): Promise<unknown>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
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

  async listActive(): Promise<PublicBountyRecord[]> {
    const rows = await this.client().bounty.findMany({
      where: { status: "active" },
      orderBy: { deadline: "asc" },
      select: {
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
      },
    });
    if (!Array.isArray(rows)) {
      throw new BountyFlowError(500, "INTERNAL", "Internal server error");
    }
    return rows.map(readPublic);
  }

  private client(): PrismaLike {
    const client = this.database?.activeClient;
    if (!client || !isPrismaLike(client)) {
      throw new BountyFlowError(503, "NOT_READY", "Bounty storage is not ready.");
    }
    return client;
  }
}

function isPrismaLike(value: ConnectedClient): value is ConnectedClient & PrismaLike {
  return "bounty" in value && "auditLog" in value && "$transaction" in value;
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
  const bounty = readBounty(value);
  return {
    id: bounty.id,
    title: bounty.title,
    description: bounty.description,
    instructions: bounty.instructions,
    prompt: readString(value.question.prompt),
    category: bounty.category,
    verificationMethod: readVerification(value.question.verificationMethod),
    status: bounty.status,
    rewardLamports: bounty.rewardLamports,
    maxRewardedSolvers: bounty.maxRewardedSolvers,
    attemptLimit: bounty.attemptLimit,
    deadline: bounty.deadline,
    closeReason: bounty.closeReason,
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
