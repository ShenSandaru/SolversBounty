import type { ReactNode } from "react";

export function StatisticCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm text-muted-foreground">{label}</h3>
      <p className="mt-2 font-mono text-2xl font-semibold tracking-tight">{value}</p>
      {detail ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p> : null}
    </article>
  );
}
