import type { Metadata } from "next";
import { GetStartedPage } from "@/features/marketing/get-started-page";

export const metadata: Metadata = {
  title: "Get started",
};

export default function Page() {
  return <GetStartedPage />;
}
