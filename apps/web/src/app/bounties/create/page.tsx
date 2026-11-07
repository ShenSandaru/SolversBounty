import type { Metadata } from "next";
import { CreateBountyPage } from "@/features/bounties/create-bounty-page";

export const metadata: Metadata = {
  title: "Create bounty",
};

export default function Page() {
  return <CreateBountyPage />;
}
