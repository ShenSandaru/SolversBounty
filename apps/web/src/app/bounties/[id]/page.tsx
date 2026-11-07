import type { Metadata } from "next";
import { BountyDetailsPage } from "@/features/bounties/bounty-details-page";

export const metadata: Metadata = {
  title: "Challenge",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BountyDetailsPage id={id} />;
}
