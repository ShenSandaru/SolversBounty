export function ProgressIndicator({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const safeMax = max > 0 ? max : 1;
  const width = Math.min(100, Math.round((value / safeMax) * 100));

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono">
          {value} / {max}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}