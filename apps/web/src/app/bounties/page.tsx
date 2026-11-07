import type { Metadata } from "next";
import { marketplaceBounties } from "@/data/mock/bounties";
import { MarketplacePage } from "@/features/marketplace/marketplace-page";

export const metadata: Metadata = {
  title: "Marketplace",
};

export default function Page() {
  return <MarketplacePage bounties={marketplaceBounties} />;
}
