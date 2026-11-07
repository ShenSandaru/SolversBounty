import { InMemoryRateLimit } from "./in-memory-rate-limit";

describe("InMemoryRateLimit", () => {
  it("allows calls inside the window and blocks the next one", () => {
    let now = 1_000;
    const limiter = new InMemoryRateLimit(() => now);
    expect(limiter.allow("wallet", 2, 60_000)).toBe(true);
    expect(limiter.allow("wallet", 2, 60_000)).toBe(true);
    expect(limiter.allow("wallet", 2, 60_000)).toBe(false);
    now += 60_001;
    expect(limiter.allow("wallet", 2, 60_000)).toBe(true);
  });
});
