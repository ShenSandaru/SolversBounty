import { formatLamportsAsSol } from "@solversbounty/shared";
import Link from "next/link";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { StatisticCard } from "@/components/statistic-card";
import { creatorBounties } from "@/data/mock/bounties";
import { dashboardSample } from "@/data/mock/dashboard";
import { CreatorDraftList } from "./creator-draft-list";
import { closeReasonLabels, statusLabels } from "@/lib/labels";
import { formatDeadline } from "@/lib/dates";

export function DashboardPage() {
  const earned = formatLamportsAsSol(BigInt(dashboardSample.rewardsEarnedLamports));
  const activeBounties = creatorBounties.filter((bounty) => bounty.status === "active").length;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Dashboard"
        title="Creator and solver overview"
        description={dashboardSample.notice}
      />
      <section className="mt-6" aria-labelledby="creator-overview">
        <h2 id="creator-overview" className="text-lg font-semibold">
          Your drafts
        </h2>
        <CreatorDraftList />
        <h3 className="mt-8 text-base font-semibold">Sample preview</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <StatisticCard label="Created bounties" value={creatorBounties.length} />
          <StatisticCard label="Active bounties" value={activeBounties} />
        </div>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="sr-only">Sample bounties created in this preview</caption>
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {creatorBounties.map((bounty) => (
                <tr key={bounty.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <Link href={`/bounties/${bounty.id}`} className="font-medium hover:underline">
                      {bounty.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {bounty.closeReason ? closeReasonLabels[bounty.closeReason] : statusLabels[bounty.status]}
                  </td>
                  <td className="px-4 py-3">{formatDeadline(bounty.deadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-10" aria-labelledby="solver-overview">
        <h2 id="solver-overview" className="text-lg font-semibold">
          Solver
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <StatisticCard
            label="Completed challenges"
            value={dashboardSample.completedChallenges}
            detail="Sample sessions that reached a stored result."
          />
          <StatisticCard
            label="Rewards earned"
            value={`${earned} SOL`}
            detail="Sample confirmed rewards. Pending payouts are separate."
          />
        </div>
        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <h3 className="font-medium">Solver activity summary</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">Sessions started</dt>
              <dd className="mt-1 font-mono text-lg">{dashboardSample.solverSummary.sessionsStarted}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Correct attempts</dt>
              <dd className="mt-1 font-mono text-lg">{dashboardSample.solverSummary.correctAttempts}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Incorrect attempts</dt>
              <dd className="mt-1 font-mono text-lg">{dashboardSample.solverSummary.incorrectAttempts}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Rewards pending</dt>
              <dd className="mt-1 font-mono text-lg">{dashboardSample.solverSummary.rewardsPending}</dd>
            </div>
          </dl>
        </div>
      </section>
      <section className="mt-10" aria-labelledby="recent-activity">
        <h2 id="recent-activity" className="text-lg font-semibold">
          Recent activity
        </h2>
        <ol className="mt-3 grid gap-3">
          {dashboardSample.activity.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{item.title}</p>
                <p className="text-xs tracking-[0.12em] text-muted-foreground uppercase">
                  {item.audience} · {item.when}
                </p>
              </div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
            </li>
          ))}
        </ol>
      </section>
    </PageContainer>
  );
}
