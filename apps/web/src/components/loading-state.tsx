export function LoadingState({ label }: { label: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <p className="sr-only">{label}</p>
      {["one", "two", "three"].map((item) => (
        <div key={item} className="h-52 animate-pulse rounded-xl border border-border bg-card" />
      ))}
    </div>
  );
}