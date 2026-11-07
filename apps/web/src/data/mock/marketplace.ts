import type { BountyCategory, PublicBounty } from "@solversbounty/shared";

export type CategoryFilter = BountyCategory | "all";
export type MarketplaceSort = "deadline" | "reward" | "title";

export function filterMarketplaceBounties(
  bounties: readonly PublicBounty[],
  options: {
    query: string;
    category: CategoryFilter;
    sort: MarketplaceSort;
  },
): PublicBounty[] {
  const needle = options.query.trim().toLowerCase();
  const filtered = bounties.filter((bounty) => {
    if (options.category !== "all" && bounty.category !== options.category) {
      return false;
    }
    if (needle.length === 0) {
      return true;
    }
    const haystack = [bounty.title, bounty.description, bounty.prompt, bounty.instructions]
      .join("\n")
      .toLowerCase();
    return haystack.includes(needle);
  });

  return [...filtered].sort((left, right) => compareBounties(left, right, options.sort));
}

function compareBounties(left: PublicBounty, right: PublicBounty, sort: MarketplaceSort): number {
  if (sort === "title") {
    return left.title.localeCompare(right.title);
  }
  if (sort === "reward") {
    const rewardOrder = BigInt(right.rewardLamports) - BigInt(left.rewardLamports);
    if (rewardOrder > 0n) {
      return 1;
    }
    if (rewardOrder < 0n) {
      return -1;
    }
    return left.title.localeCompare(right.title);
  }
  const deadlineOrder = new Date(left.deadline).getTime() - new Date(right.deadline).getTime();
  if (deadlineOrder !== 0) {
    return deadlineOrder;
  }
  return left.title.localeCompare(right.title);
}
