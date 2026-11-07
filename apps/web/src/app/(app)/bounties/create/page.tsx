import type { Metadata } from "next";
import { CreateBountyPage } from "@/features/bounties/create-bounty-page";

export const metadata: Metadata = {
  title: "Create bounty",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const params = await searchParams;
  const from = Array.isArray(params.from) ? params.from[0] : params.from;
  return <CreateBountyPage fromOnboarding={from === "onboarding"} />;
}
