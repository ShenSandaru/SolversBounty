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
      <div className="rounded-xl border border-border bg-muted px-4 py-3 text-sm leading-6 text-muted-foreground">
        {researchNotice}
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Demonstration bounty">
        {researchSamples.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === sample.id}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              item.id === sample.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
            }`}
            onClick={() => setSampleId(item.id)}
          >
            {item.bountyTitle}
          </button>
        ))}
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
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">Attempt mix</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {sample.correctAttempts} correct and {sample.incorrectAttempts} incorrect attempts.
        </p>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="flex h-full">
            <div className="bg-primary" style={{ width: `${correctShare}%` }} />
            <div className="bg-accent" style={{ width: `${incorrectShare}%` }} />
          </div>
        </div>
        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <span>Correct {correctShare.toFixed(0)}%</span>
          <span>Incorrect {incorrectShare.toFixed(0)}%</span>
        </div>
      </section>
      <section className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-3">
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
      <h3 className="text-sm text-muted-foreground">{label}</h3>
      <p className="mt-2 font-mono text-xl font-semibold">{value}</p>
    </div>
  );
}
