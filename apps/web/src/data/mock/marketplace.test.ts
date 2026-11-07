import { expect, test } from "vitest";
import { marketplaceBounties } from "@/data/mock/bounties";
import { filterMarketplaceBounties } from "@/data/mock/marketplace";

test("marketplace fixtures stay public and joinable", () => {
  expect(marketplaceBounties.length).toBeGreaterThan(0);
  for (const bounty of marketplaceBounties) {
    expect(bounty).not.toHaveProperty("expectedAnswer");
    expect(bounty.status).toBe("active");
    expect(bounty.rewardedCount).toBeLessThan(bounty.maxRewardedSolvers);
  }
});

test("search and category apply together", () => {
  const ciphers = filterMarketplaceBounties(marketplaceBounties, {
    query: "",
    category: "ciphers",
    sort: "title",
  });
  expect(ciphers.length).toBeGreaterThan(0);
  expect(ciphers.every((bounty) => bounty.category === "ciphers")).toBe(true);

  const narrowed = filterMarketplaceBounties(marketplaceBounties, {
    query: "notebook",
    category: "ciphers",
    sort: "reward",
  });
  expect(narrowed.map((bounty) => bounty.id)).toEqual(["night-desk"]);
});

test("an empty search returns the open list", () => {
  const visible = filterMarketplaceBounties(marketplaceBounties, {
    query: "   ",
    category: "all",
    sort: "deadline",
  });
  expect(visible).toHaveLength(marketplaceBounties.length);
});
