import { LoadingState } from "@/components/loading-state";
import { PageContainer } from "@/components/page-container";

export default function Loading() {
  return (
    <PageContainer>
      <LoadingState label="Loading this page." />
    </PageContainer>
  );
}
