import Link from "next/link";
import { ErrorState } from "@/components/error-state";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <PageContainer>
      <ErrorState
        title="This challenge is not in the preview"
        description="The sample set has no bounty with that id. Marketplace cards link to the fixtures that do exist."
        action={
          <Button asChild>
            <Link href="/bounties">Return to the marketplace</Link>
          </Button>
        }
      />
    </PageContainer>
  );
}
