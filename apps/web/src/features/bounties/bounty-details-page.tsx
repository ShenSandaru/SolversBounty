import { formatLamportsAsSol, principalLamports } from "@solversbounty/shared";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CategoryBadge } from "@/components/category-badge";
import { DifficultyBadge } from "@/components/difficulty-badge";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { ProgressIndicator } from "@/components/progress-indicator";
import { RewardDisplay } from "@/components/reward-display";
import { findPreviewBounty } from "@/data/mock/bounties";
import { formatDeadline } from "@/lib/dates";
import { closeReasonLabels, statusLabels } from "@/lib/labels";

export function BountyDetailsPage({ id }: { id: string }) {
  const bounty = findPreviewBounty(id);
  if (!bounty) {
    notFound();
  }

  const principal = formatLamportsAsSol(
    principalLamports(BigInt(bounty.rewardLamports), bounty.maxRewardedSolvers),
  );
  const closedLabel = bounty.closeReason ? closeReasonLabels[bounty.closeReason] : null;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Challenge"
        title={bounty.title}
        description={bounty.description}
        actions={
          <Button variant="outline" asChild>
            <Link href="/bounties">Back to marketplace</Link>
          </Button>
        }
      />
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <CategoryBadge category={bounty.category} />
        <DifficultyBadge level={bounty.difficulty} />
        <span className="rounded-full border border-input bg-secondary px-2.5 py-1 text-xs font-medium">
          {closedLabel ?? statusLabels[bounty.status]}
        </span>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
        <div className="grid gap-6">
          <section className="surface p-6">
            <h2 className="text-lg font-semibold">Question</h2>
            <p className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-background px-4 py-3 text-base leading-8">{bounty.prompt}</p>
            {bounty.instructions ? (
              <>
                <h3 className="mt-6 text-sm font-semibold">Instructions</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{bounty.instructions}</p>
              </>
            ) : null}
          </section>
          <section className="surface p-6">
            <h2 className="text-lg font-semibold">Challenge rules</h2>
            <ul className="mt-3 grid gap-2 text-sm leading-6 text-muted-foreground">
              <li>Attempt limit: {bounty.attemptLimit} stored attempts for each solver.</li>
              <li>One reward per wallet on this bounty.</li>
              <li>The reward asset is native SOL on Devnet.</li>
              <li>The backend verifies the answer. This page does not.</li>
              <li>Funds sit in a custodial Devnet treasury until a later payout phase.</li>
              <li>Deadline is {formatDeadline(bounty.deadline)}.</li>
            </ul>
          </section>
          <section className="surface p-6">
            <h2 className="text-lg font-semibold">Answer submission</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Placeholder. Submitting an answer, checking it, and deciding a reward are not
              available in this preview.
            </p>
            <Textarea
              className="mt-4"
              disabled
              aria-disabled="true"
              placeholder="Answer field"
              value=""
              readOnly
            />
            <Button type="button" className="mt-3" disabled>
              Submit answer
            </Button>
          </section>
          <section className="surface p-6">
            <h2 className="text-lg font-semibold">Research participation</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              A session starts only after consent to policy research-consent-v1. The record can
              include wallet address, attempts, times, submitted answers, and public chain
              transfers. Measurement is observable activity and self-report. It does not read
              private thoughts. Identity here is pseudonymous.
            </p>
          </section>
        </div>
        <aside className="surface gradient-border relative grid h-fit gap-4 overflow-hidden p-6 lg:sticky lg:top-24">
          <RewardDisplay lamports={bounty.rewardLamports} size="lg" />
          <p className="text-sm text-muted-foreground">Pool principal {principal} SOL</p>
          <ProgressIndicator
            value={bounty.rewardedCount}
            max={bounty.maxRewardedSolvers}
            label="Rewarded solvers"
          />
          <p className="text-sm text-muted-foreground">Deadline {formatDeadline(bounty.deadline)}</p>
          <p className="text-sm text-muted-foreground">
            Verification is configured by the creator and applied on the server. This page does not
            show an answer key.
          </p>
        </aside>
      </div>
    </PageContainer>
  );
}
