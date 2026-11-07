import type { BountyCategory } from "@solversbounty/shared";
import { categoryLabels } from "@/lib/labels";

export function CategoryBadge({ category }: { category: BountyCategory }) {
  return (
    <span className="inline-flex items-center rounded-full border border-brand-purple/40 bg-brand-purple/15 px-2.5 py-1 text-xs font-medium text-[#d4b8ff]">
      {categoryLabels[category]}
    </span>
  );
}