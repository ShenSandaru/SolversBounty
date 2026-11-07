const assert = require("node:assert/strict");
const test = require("node:test");
const { APP_NAME, LAMPORTS_PER_SOL } = require("../dist/index.js");

test("shared package exports the app identity and lamport scale", () => {
  assert.equal(APP_NAME, "SolversBounty");
  assert.equal(LAMPORTS_PER_SOL, 1_000_000_000n);
});
