import type { Metadata } from "next";
import { ResearchPage } from "@/features/analytics/research-page";

export const metadata: Metadata = {
  title: "Research analytics",
};

export default function Page() {
  return <ResearchPage />;
}
