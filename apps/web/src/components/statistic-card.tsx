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
    <article className="surface gradient-border relative overflow-hidden p-5">
      <h3 className="text-xs font-medium tracking-[0.1em] text-muted-foreground uppercase">{label}</h3>
      <p className="mt-3 font-mono text-3xl font-semibold tracking-normal tabular-nums">{value}</p>
      {detail ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p> : null}
    </article>
  );
}