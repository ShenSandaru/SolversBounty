import type { Metadata } from "next";
import { EditBountyPage } from "@/features/bounties/edit-bounty-page";

export const metadata: Metadata = {
  title: "Edit draft",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditBountyPage id={id} />;
}
