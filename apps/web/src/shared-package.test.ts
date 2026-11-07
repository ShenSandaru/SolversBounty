import { APP_NAME, LAMPORTS_PER_SOL } from "@solversbounty/shared";
import { expect, test } from "vitest";

test("web app can import the shared package", () => {
  expect(APP_NAME).toBe("SolversBounty");
  expect(LAMPORTS_PER_SOL).toBe(BigInt(1_000_000_000));
});
