import { difficultyLabels, type DifficultyLevel } from "@/lib/labels";

const tone: Record<DifficultyLevel, string> = {
  introductory: "border-brand-green/40 bg-brand-green/10 text-brand-green",
  intermediate: "border-warning/40 bg-warning/10 text-warning",
  advanced: "border-destructive/40 bg-destructive/10 text-destructive",
};

export function DifficultyBadge({ level }: { level: DifficultyLevel }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tone[level]}`}>
      {difficultyLabels[level]}
    </span>
  );
}