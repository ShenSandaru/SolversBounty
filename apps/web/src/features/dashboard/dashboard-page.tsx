import { formatLamportsAsSol } from "@solversbounty/shared";
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
        <h2 id="creator-overview" className="flex items-center gap-2 text-xl font-semibold">
          <span className="rounded-full border border-brand-purple/40 bg-brand-purple/15 px-2.5 py-0.5 text-xs font-medium text-[#d4b8ff]">Creator</span>
          Your drafts
        </h2>
        <CreatorDraftList />
        <h3 className="mt-8 text-sm font-semibold tracking-wider text-muted-foreground uppercase">Sample preview</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <StatisticCard label="Created bounties" value={creatorBounties.length} />
          <StatisticCard label="Active bounties" value={activeBounties} />
        </div>
        <div className="mt-4 surface overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <caption className="px-4 py-3 text-left text-xs text-muted-foreground">
              Layout fixtures. These rows are not live bounties.
            </caption>
            <thead className="bg-secondary/60 text-xs tracking-wider text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Deadline</th>
              </tr>
            </thead>
            <tbody>
              {creatorBounties.map((bounty) => (
                <tr key={bounty.id} className="border-t border-border transition-colors hover:bg-card-elevated">
                  <td className="px-4 py-3">
                    <span className="font-medium">{bounty.title}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-input bg-secondary px-2.5 py-1 text-xs font-medium">
                      {bounty.closeReason ? closeReasonLabels[bounty.closeReason] : statusLabels[bounty.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">{formatDeadline(bounty.deadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="mt-10" aria-labelledby="solver-overview">
        <h2 id="solver-overview" className="flex items-center gap-2 text-xl font-semibold">
          <span className="rounded-full border border-brand-green/40 bg-brand-green/10 px-2.5 py-0.5 text-xs font-medium text-brand-green">Sample</span>
          Solver activity preview
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
        <div className="surface mt-4 p-5">
          <h3 className="font-medium">Sample solver activity summary</h3>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
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
        <h2 id="recent-activity" className="text-xl font-semibold">
          Sample recent activity
        </h2>
        <ol className="mt-3 grid gap-3">
          {dashboardSample.activity.map((item) => (
            <li key={item.id} className="surface border-l-2 border-l-brand-purple px-4 py-3">
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
