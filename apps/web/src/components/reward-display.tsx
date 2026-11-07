import { formatLamportsAsSol } from "@solversbounty/shared";

export function RewardDisplay({
  lamports,
  label = "Reward per solver",
}: {
  lamports: string;
  label?: string;
}) {
  const amount = formatLamportsAsSol(BigInt(lamports));

  return (
    <p>
      <span className="text-xs tracking-[0.12em] text-muted-foreground uppercase">{label}</span>
      <span className="mt-1 block font-mono text-xl font-semibold text-reward">{amount} SOL</span>
    </p>
  );
}
