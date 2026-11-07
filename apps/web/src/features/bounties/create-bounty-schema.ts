import { createBountyInputSchema } from "@solversbounty/shared";
import { z } from "zod";
import { difficultyLevels } from "@/lib/labels";

export const difficultyLevelSchema = z.enum(difficultyLevels);

export function createBountyFormSchema(now: Date) {
  return createBountyInputSchema(now).extend({
    difficulty: difficultyLevelSchema,
    consentAcknowledged: z.boolean().refine((value) => value, {
      message: "Acknowledge that a solver must accept research consent before a session starts.",
    }),
  });
}

export type CreateBountyFormValues = z.input<ReturnType<typeof createBountyFormSchema>>;
