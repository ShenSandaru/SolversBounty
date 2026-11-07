import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { ResearchDashboard } from "./research-dashboard";

export function ResearchPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Research analytics"
        title="How a challenge was attempted"
        description="Creators will see aggregated activity for bounties they own. The numbers on this page are a demonstration, not a study result."
      />
      <ResearchDashboard />
    </PageContainer>
  );
}
