"use client";

import { useEffect, useState } from "react";
import type { PublicBounty } from "@solversbounty/shared";
import { LoadingState } from "@/components/loading-state";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { apiBaseUrl } from "@/features/auth/auth-client";
import { BountyClientError, listPublicBounties } from "@/features/bounties/bounty-api";
import { MarketplaceBrowser } from "./marketplace-browser";

export function MarketplacePage() {
  const [bounties, setBounties] = useState<PublicBounty[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listPublicBounties(apiBaseUrl(), {})
      .then((rows) => {
        if (active) {
          setBounties(rows);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof BountyClientError ? caught.message : "Active challenges could not be loaded.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Marketplace"
        title="Open cognitive challenges"
        description="Active Devnet challenges a solver can still join. Rewards are native SOL held by the custodial treasury."
      />
      {error ? <p className="mt-6 text-sm text-destructive" role="alert">{error}</p> : null}
      {bounties ? <MarketplaceBrowser bounties={bounties} /> : error ? null : <LoadingState label="Loading challenges." />}
    </PageContainer>
  );
}
