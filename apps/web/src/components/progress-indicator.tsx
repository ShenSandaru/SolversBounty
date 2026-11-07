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
        <span>
          {value} / {max}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}
