import Link from "next/link";
import { ErrorState } from "@/components/error-state";
import { PageContainer } from "@/components/page-container";
import { Button } from "@/components/ui/button";
import { MarketingShell } from "@/features/marketing/marketing-shell";

export default function NotFound() {
  return (
    <MarketingShell>
      <PageContainer>
        <ErrorState
          title="Page not found"
          description="That route is not part of this preview."
          action={
            <Button asChild>
              <Link href="/">Go to the home page</Link>
            </Button>
          }
        />
      </PageContainer>
    </MarketingShell>
  );
}
