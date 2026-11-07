import { describe, expect, it } from "vitest";
import { marketingNav } from "./marketing-nav";

describe("marketing navigation", () => {
  it("lists the public marketing links in header order", () => {
    expect(marketingNav.map((item) => item.label)).toEqual([
      "How it works",
      "For Solvers",
      "For Organizations",
      "Explore Challenges",
    ]);
  });
});
