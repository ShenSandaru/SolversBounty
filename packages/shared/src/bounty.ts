import { z } from "zod";
import { parseSolToLamports } from "./lamports";

export const bountyCategorySchema = z.enum([
  "logic",
  "mathematics",
  "numerical_patterns",
  "ciphers",
]);

export const verificationMethodSchema = z.enum([
  "exact",
  "case_insensitive",
  "normalized_text",
  "numeric_exact",
]);

export const bountyStatusSchema = z.enum([
  "draft",
  "funding_pending",
  "active",
  "closed",
]);

export const publicBountySchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    description: z.string().min(1),
    instructions: z.string(),
    prompt: z.string().min(1),
    category: bountyCategorySchema,
    status: bountyStatusSchema,
    rewardLamports: z.string().regex(/^[0-9]+$/),
    maxRewardedSolvers: z.number().int().positive(),
    rewardedCount: z.number().int().nonnegative(),
    attemptLimit: z.number().int().positive(),
    deadline: z.string().datetime(),
  })
  .strict();

export const createBountyInputSchema = (now: Date) =>
  z
    .object({
      title: z.string().trim().min(1, "Enter a title.").max(140),
      description: z.string().trim().min(1, "Enter a description.").max(5000),
      instructions: z.string().trim().max(5000),
      prompt: z.string().trim().min(1, "Enter the challenge question.").max(5000),
      category: bountyCategorySchema,
      expectedAnswer: z.string().trim().min(1, "Enter the expected answer.").max(500),
      verificationMethod: verificationMethodSchema,
      rewardSol: z.string().trim().min(1, "Enter a reward."),
      maxRewardedSolvers: z
        .number({ error: "Enter the maximum number of rewarded solvers." })
        .int("Enter a whole number of solvers.")
        .positive("Enter at least one rewarded solver."),
      attemptLimit: z
        .number({ error: "Enter an attempt limit." })
        .int("Enter a whole number of attempts.")
        .positive("Enter at least one attempt.")
        .max(10, "The proposed maximum is 10 attempts."),
      deadline: z.string().min(1, "Choose a deadline."),
    })
    .superRefine((value, context) => {
      const rewardLamports = parseSolToLamports(value.rewardSol);
      if (rewardLamports === null || rewardLamports <= 0n) {
        context.addIssue({
          code: "custom",
          path: ["rewardSol"],
          message: "Enter a positive SOL amount with at most 9 decimal places.",
        });
      }

      const deadline = new Date(value.deadline);
      if (Number.isNaN(deadline.getTime()) || deadline.getTime() <= now.getTime()) {
        context.addIssue({
          code: "custom",
          path: ["deadline"],
          message: "Choose a deadline in the future. The server clock is authoritative later.",
        });
      }
    });

export type BountyCategory = z.infer<typeof bountyCategorySchema>;
export type VerificationMethod = z.infer<typeof verificationMethodSchema>;
export type BountyStatus = z.infer<typeof bountyStatusSchema>;
export type PublicBounty = z.infer<typeof publicBountySchema>;
export type CreateBountyInput = z.input<ReturnType<typeof createBountyInputSchema>>;
