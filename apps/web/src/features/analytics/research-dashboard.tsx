"use client";

import { useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { StatisticCard } from "@/components/statistic-card";
import {
  accuracyPercent,
  completionRatePercent,
  researchNotice,
  researchSamples,
  type ResearchSample,
} from "@/data/mock/research";

export function ResearchDashboard() {
  const [sampleId, setSampleId] = useState(researchSamples[0]?.id ?? "");
  const sample = researchSamples.find((item) => item.id === sampleId) ?? researchSamples[0];

  if (!sample) {
    return (
      <EmptyState
        title="No demonstration set"
        description="Add a sample bounty before reviewing the research layout."
      />
    );
  }

  const accuracy = accuracyPercent(sample);
  const completion = completionRatePercent(sample);
  const attempts = sample.correctAttempts + sample.incorrectAttempts;

  return (
    <div className="mt-6 grid gap-6">
      <div className="rounded-xl border border-warning/30 bg-warning/[0.07] px-4 py-3 text-sm leading-6 text-muted-foreground" role="note">
        {researchNotice}
      </div>
      <div>
        <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">Demonstration bounty</p>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Demonstration bounty">
        {researchSamples.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === sample.id}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              item.id === sample.id
                ? "border-brand-purple bg-brand-purple/20 font-medium text-foreground"
                : "border-border bg-card text-muted-foreground hover:border-brand-purple/60 hover:text-foreground"
            }`}
            onClick={() => setSampleId(item.id)}
          >
            {item.bountyTitle}
          </button>
        ))}
        </div>
      </div>
      {sample.participants === 0 ? (
        <EmptyState
          title="No solving sessions"
          description="Participants, accuracy, and completion time appear after solvers start sessions on this bounty. This empty sample is not an error."
        />
      ) : (
        <ResearchFigures sample={sample} accuracy={accuracy} completion={completion} attempts={attempts} />
      )}
    </div>
  );
}

function ResearchFigures({
  sample,
  accuracy,
  completion,
  attempts,
}: {
  sample: ResearchSample;
  accuracy: number | null;
  completion: number | null;
  attempts: number;
}) {
  const incorrectShare = attempts === 0 ? 0 : (sample.incorrectAttempts / attempts) * 100;
  const correctShare = attempts === 0 ? 0 : (sample.correctAttempts / attempts) * 100;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatisticCard label="Participants" value={sample.participants} detail="Solving sessions started." />
        <StatisticCard
          label="Overall accuracy"
          value={accuracy === null ? "—" : `${accuracy.toFixed(1)}%`}
          detail="Correct attempts divided by all attempts."
        />
        <StatisticCard
          label="Completion rate"
          value={completion === null ? "—" : `${completion.toFixed(1)}%`}
          detail="Correct solvers divided by participants."
        />
        <StatisticCard
          label="Average completion time"
          value={sample.averageCompletionTime}
          detail="Mean time to the first correct attempt."
        />
      </div>
      <section className="surface p-6">
        <h2 className="text-lg font-semibold">Attempt mix</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {sample.correctAttempts} correct and {sample.incorrectAttempts} incorrect attempts.
        </p>
        <div className="mt-5 h-4 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
          <div className="flex h-full">
            <div className="bg-brand-green" style={{ width: `${correctShare}%` }} />
            <div className="bg-brand-purple" style={{ width: `${incorrectShare}%` }} />
          </div>
        </div>
        <div className="mt-3 flex gap-5 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-brand-green" aria-hidden="true" />Correct {correctShare.toFixed(0)}%</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-brand-purple" aria-hidden="true" />Incorrect {incorrectShare.toFixed(0)}%</span>
        </div>
      </section>
      <section className="surface grid gap-5 p-6 sm:grid-cols-3">
        <Metric label="Median completion time" value={sample.medianCompletionTime} />
        <Metric label="Average attempts" value={sample.averageAttempts} />
        <Metric label="Average attempts before success" value={sample.averageAttemptsBeforeSuccess} />
      </section>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <h3 className="text-xs tracking-[0.1em] text-muted-foreground uppercase">{label}</h3>
      <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
    </div>
  );
}
