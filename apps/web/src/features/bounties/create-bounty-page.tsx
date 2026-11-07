import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { CreateBountyForm } from "./create-bounty-form";

export function CreateBountyPage({ fromOnboarding = false }: { fromOnboarding?: boolean }) {
  return (
    <PageContainer>
      {fromOnboarding ? (
        <p className="mb-6 rounded-xl border border-brand-purple/40 bg-brand-purple/10 px-4 py-3 text-sm leading-6 text-muted-foreground">
          Creator path. Save a draft here, then fund the reward pool and the separate 5% commission
          from the funding screen. Phantom sign-in is required before a draft can be stored. This
          does not send SOL.
        </p>
      ) : null}
      <PageHeader
        eyebrow="Create bounty"
        title="Define a challenge"
        description="Set the public question, the protected answer, and the Devnet reward terms. Saving creates a draft. It does not fund or activate the bounty."
      />
      <CreateBountyForm />
    </PageContainer>
  );
}
