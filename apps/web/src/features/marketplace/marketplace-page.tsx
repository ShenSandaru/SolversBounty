import { Suspense } from "react";
import { LoadingState } from "@/components/loading-state";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import type { PreviewBounty } from "@/data/mock/types";
import { MarketplaceBrowser } from "./marketplace-browser";

export function MarketplacePage({ bounties }: { bounties: PreviewBounty[] }) {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Marketplace"
        title="Open cognitive challenges"
        description="Active Devnet challenges a solver could still join. Rewards are native SOL held by the custodial treasury. This list is sample data."
      />
      <Suspense fallback={<LoadingState label="Loading challenges." />}>
        <MarketplaceBrowser bounties={bounties} />
      </Suspense>
    </PageContainer>
  );
}
