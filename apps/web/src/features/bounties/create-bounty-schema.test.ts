import { principalLamports, parseSolToLamports } from "@solversbounty/shared";
import { expect, test } from "vitest";
import { createBountyFormSchema } from "./create-bounty-schema";

const now = new Date("2026-11-07T00:00:00.000Z");

const valid = {
  title: "The archive door",
  description: "Three labels, one of them true.",
  instructions: "Submit the door letter.",
  prompt: "Which door leads to the archive?",
  category: "logic" as const,
  expectedAnswer: "A",
  verificationMethod: "exact" as const,
  rewardSol: "0.01",
  maxRewardedSolvers: 100,
  attemptLimit: 3,
  deadline: "2026-12-01T12:00",
  difficulty: "introductory" as const,
  consentAcknowledged: true,
};

test("a complete preview passes and computes principal in lamports", () => {
  const parsed = createBountyFormSchema(now).safeParse(valid);
  expect(parsed.success).toBe(true);
  const reward = parseSolToLamports(valid.rewardSol);
  expect(reward).toBe(BigInt(10_000_000));
  expect(principalLamports(reward ?? BigInt(0), valid.maxRewardedSolvers)).toBe(BigInt(1_000_000_000));
});

test("missing consent, a past deadline, and too many attempts fail", () => {
  const parsed = createBountyFormSchema(now).safeParse({
    ...valid,
    expectedAnswer: " ",
    deadline: "2020-01-01T00:00",
    attemptLimit: 11,
    consentAcknowledged: false,
    rewardSol: "0",
  });
  expect(parsed.success).toBe(false);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(
      expect.arrayContaining(["expectedAnswer", "deadline", "attemptLimit", "consentAcknowledged", "rewardSol"]),
    );
  }
});
