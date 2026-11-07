import type { Metadata } from "next";
import { Suspense } from "react";
import { FundBountyPage } from "@/features/bounties/fund-bounty-page";

export const metadata: Metadata = {
  title: "Fund bounty",
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-6 py-10 text-sm text-muted-foreground">Loading funding requirements.</p>}>
      <FundRoute params={params} />
    </Suspense>
  );
}

async function FundRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FundBountyPage id={id} />;
}
