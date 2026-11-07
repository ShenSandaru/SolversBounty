"use client";

import { useMemo, useState } from "react";
import type { BountyCategory } from "@solversbounty/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/empty-state";
import { categoryLabels } from "@/lib/labels";
import {
  filterMarketplaceBounties,
  type CategoryFilter,
  type MarketplaceSort,
} from "@/data/mock/marketplace";
import type { PreviewBounty } from "@/data/mock/types";
import { BountyCard } from "./bounty-card";

const categories = Object.keys(categoryLabels) as BountyCategory[];

export function MarketplaceBrowser({ bounties }: { bounties: PreviewBounty[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sort, setSort] = useState<MarketplaceSort>("deadline");

  const visible = useMemo(
    () => filterMarketplaceBounties(bounties, { query, category, sort }),
    [bounties, query, category, sort],
  );

  return (
    <div className="mt-6">
      <form
        className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.8fr)]"
        onSubmit={(event) => event.preventDefault()}
      >
        <div>
          <Label htmlFor="bounty-search">Search</Label>
          <Input
            id="bounty-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title, description, or question"
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="bounty-category">Category</Label>
          <Select
            id="bounty-category"
            value={category}
            onChange={(event) => setCategory(event.target.value as CategoryFilter)}
            className="mt-1.5"
          >
            <option value="all">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {categoryLabels[item]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="bounty-sort">Sort</Label>
          <Select
            id="bounty-sort"
            value={sort}
            onChange={(event) => setSort(event.target.value as MarketplaceSort)}
            className="mt-1.5"
          >
            <option value="deadline">Soonest deadline</option>
            <option value="reward">Highest reward</option>
            <option value="title">Title</option>
          </Select>
        </div>
      </form>
      <p className="mt-4 text-sm text-muted-foreground">
        {visible.length} open {visible.length === 1 ? "challenge" : "challenges"}
      </p>
      {visible.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            title="No challenges match"
            description="Search looks at public title, description, question, and instructions. Try another phrase or category."
            action={
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((bounty) => (
            <BountyCard key={bounty.id} bounty={bounty} />
          ))}
        </div>
      )}
    </div>
  );
}
