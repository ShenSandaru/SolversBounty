import { difficultyLabels, type DifficultyLevel } from "@/lib/labels";

const tone: Record<DifficultyLevel, string> = {
  introductory: "bg-accent text-accent-foreground",
  intermediate: "bg-secondary text-secondary-foreground",
  advanced: "bg-primary text-primary-foreground",
};

export function DifficultyBadge({ level }: { level: DifficultyLevel }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${tone[level]}`}>
      {difficultyLabels[level]}
    </span>
  );
}
