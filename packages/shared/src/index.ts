import { z } from "zod";

export const APP_NAME = "SolversBounty";

export const LAMPORTS_PER_SOL = 1_000_000_000n;

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string().min(1),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
