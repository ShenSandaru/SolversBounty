import { formatLamportsAsSol } from "@solversbounty/shared";

export function RewardDisplay({
  lamports,
  label = "Reward per solver",
  size = "md",
}: {
  lamports: string;
  label?: string;
  size?: "md" | "lg";
}) {
  const amount = formatLamportsAsSol(BigInt(lamports));

  return (
    <p>
      <span className="text-xs tracking-[0.12em] text-muted-foreground uppercase">{label}</span>
      <span
        className={`mt-1 block font-mono font-semibold text-reward ${size === "lg" ? "text-3xl" : "text-xl"}`}
      >
        {amount} <span className="text-sm font-medium text-reward/80">SOL</span>
      </span>
    </p>
  );
}