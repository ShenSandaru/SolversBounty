const assert = require("node:assert/strict");
const test = require("node:test");
const {
  APP_NAME,
  LAMPORTS_PER_SOL,
  formatLamportsAsSol,
  parseSolToLamports,
  principalLamports,
  publicBountySchema,
} = require("../dist/index.js");

test("shared package exports the app identity and lamport scale", () => {
  assert.equal(APP_NAME, "SolversBounty");
  assert.equal(LAMPORTS_PER_SOL, 1_000_000_000n);
});

test("0.01 SOL for 100 solvers is 1 SOL of principal lamports", () => {
  const reward = parseSolToLamports("0.01");
  assert.equal(reward, 10_000_000n);
  assert.equal(principalLamports(reward, 100), LAMPORTS_PER_SOL);
  assert.equal(formatLamportsAsSol(LAMPORTS_PER_SOL), "1");
  assert.equal(formatLamportsAsSol(reward), "0.01");
});

test("public bounty schema rejects an expected answer field", () => {
  const result = publicBountySchema.safeParse({
    id: "sample",
    title: "Sample",
    description: "A public description.",
    instructions: "",
    prompt: "What is shown to solvers?",
    category: "logic",
    status: "active",
    rewardLamports: "10000000",
    maxRewardedSolvers: 10,
    rewardedCount: 0,
    attemptLimit: 3,
    deadline: "2026-12-01T00:00:00.000Z",
    expectedAnswer: "hidden",
  });
  assert.equal(result.success, false);
});
