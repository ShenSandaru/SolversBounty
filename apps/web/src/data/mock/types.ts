import type { PublicBounty } from "@solversbounty/shared";
import type { DifficultyLevel } from "@/lib/labels";

export type CloseReason = "creator" | "deadline" | "fully_allocated" | "admin";

export type PreviewBounty = PublicBounty & {
  difficulty: DifficultyLevel;
  closeReason?: CloseReason;
};
