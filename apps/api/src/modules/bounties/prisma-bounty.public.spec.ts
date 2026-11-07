import { DatabaseService } from "../../database/database.service";
import { PrismaBountyRepository } from "./prisma-bounty.repository";

const bountyId = "2b156408-e26a-4662-9c5e-0a8f6dd5791a";
const deadline = new Date("2026-12-01T00:00:00.000Z");

function publicRow() {
  return {
    id: bountyId,
    title: "Demo challenge",
    description: "A public challenge",
    instructions: "Submit the answer in the app.",
    category: "logic",
    status: "active",
    rewardLamports: 10_000_000n,
    maxRewardedSolvers: 1,
    attemptLimit: 1,
    deadline,
    closeReason: null,
    question: { prompt: "A public prompt", verificationMethod: "numeric_exact" },
    _count: { allocations: 0 },
  };
}

function repository(row: unknown): PrismaBountyRepository {
  const client = {
    bounty: {
      updateMany: async () => ({ count: 0 }),
      findMany: async () => [row],
      findUnique: async () => row,
    },
    bountyFunding: {},
    chainTransaction: {},
    bountyLedgerEntry: {},
    auditLog: {},
    consentRecord: {},
    solvingSession: {},
    submissionAttempt: {},
    rewardAllocation: {},
    payout: {},
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(client),
    $connect: async () => undefined,
    $disconnect: async () => undefined,
    $queryRawUnsafe: async () => [],
  };
  return new PrismaBountyRepository({ activeClient: client } as unknown as DatabaseService);
}

describe("public bounty reads", () => {
  it("lists an active bounty without creator or answer fields", async () => {
    const listed = await repository(publicRow()).listActive(new Date("2026-11-08T00:00:00.000Z"));
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      id: bountyId,
      status: "active",
      rewardLamports: 10_000_000n,
      maxRewardedSolvers: 1,
      attemptLimit: 1,
      prompt: "A public prompt",
      rewardedCount: 0,
    });
    expect(listed[0]).not.toHaveProperty("creatorId");
    expect(listed[0]).not.toHaveProperty("expectedAnswer");
    expect(listed[0]).not.toHaveProperty("expectedAnswerCiphertext");
  });

  it("returns the same public challenge by id", async () => {
    const found = await repository(publicRow()).findPublic(bountyId, new Date("2026-11-08T00:00:00.000Z"));
    expect(found?.id).toBe(bountyId);
    expect(found?.verificationMethod).toBe("numeric_exact");
    expect(found).not.toHaveProperty("expectedAnswer");
    expect(found).not.toHaveProperty("expectedAnswerCiphertext");
  });

  it("omits drafts from the public detail", async () => {
    const found = await repository({ ...publicRow(), status: "draft" }).findPublic(bountyId, new Date("2026-11-08T00:00:00.000Z"));
    expect(found).toBeNull();
  });
});
