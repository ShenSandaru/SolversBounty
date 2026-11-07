import type { BountyCategory } from "@solversbounty/shared";
import { categoryLabels } from "@/lib/labels";

export function CategoryBadge({ category }: { category: BountyCategory }) {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
      {categoryLabels[category]}
    </span>
  );
}
