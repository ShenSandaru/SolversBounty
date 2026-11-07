import { z } from "zod";

export { APP_NAME, LAMPORTS_PER_SOL, RESEARCH_CONSENT_VERSION } from "./constants";
export { formatLamportsAsSol, parseSolToLamports, principalLamports } from "./lamports";
export {
  bountyCategorySchema,
  bountyStatusSchema,
  createBountyInputSchema,
  publicBountySchema,
  verificationMethodSchema,
} from "./bounty";
export type {
  BountyCategory,
  BountyStatus,
  CreateBountyInput,
  PublicBounty,
  VerificationMethod,
} from "./bounty";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string().min(1),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
