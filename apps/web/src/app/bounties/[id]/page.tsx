import type { Metadata } from "next";
import { Suspense } from "react";
import { SolveBountyPage } from "@/features/bounties/solve-bounty-page";

export const metadata: Metadata = {
  title: "Challenge",
};

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="px-6 py-10 text-sm text-muted-foreground">Loading the challenge.</p>}>
      <ChallengeRoute params={params} />
    </Suspense>
  );
}

async function ChallengeRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SolveBountyPage id={id} />;
}
