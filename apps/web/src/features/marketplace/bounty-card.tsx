import { formatLamportsAsSol, principalLamports, type PublicBounty } from "@solversbounty/shared";
import Link from "next/link";
import { CategoryBadge } from "@/components/category-badge";
import { ProgressIndicator } from "@/components/progress-indicator";
import { RewardDisplay } from "@/components/reward-display";
import { formatDeadline } from "@/lib/dates";

export function BountyCard({ bounty }: { bounty: PublicBounty }) {
  const principal = formatLamportsAsSol(
    principalLamports(BigInt(bounty.rewardLamports), bounty.maxRewardedSolvers),
  );

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <CategoryBadge category={bounty.category} />
      </div>
      <h2 className="mt-3 text-lg font-semibold tracking-tight">
        <Link href={`/bounties/${bounty.id}`} className="rounded-sm hover:underline">
          {bounty.title}
        </Link>
      </h2>
      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-6 text-muted-foreground">
        {bounty.description}
      </p>
      <div className="mt-4">
        <RewardDisplay lamports={bounty.rewardLamports} />
        <p className="mt-1 text-xs text-muted-foreground">Pool principal {principal} SOL</p>
      </div>
      <div className="mt-4">
        <ProgressIndicator
          value={bounty.rewardedCount}
          max={bounty.maxRewardedSolvers}
          label="Rewarded solvers"
        />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">Deadline {formatDeadline(bounty.deadline)}</p>
    </article>
  );
}
