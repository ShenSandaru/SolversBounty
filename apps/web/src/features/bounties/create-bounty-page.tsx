import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { CreateBountyForm } from "./create-bounty-form";

export function CreateBountyPage() {
  return (
    <PageContainer>
      <PageHeader
        eyebrow="Create bounty"
        title="Define a challenge"
        description="Set the public question, the protected answer, and the Devnet reward terms. Saving creates a draft. It does not fund or activate the bounty."
      />
      <CreateBountyForm />
    </PageContainer>
  );
}
