export type BountyStatusName = "draft" | "funding_pending" | "active" | "closed";
export type BountyCategoryName = "logic" | "mathematics" | "numerical_patterns" | "ciphers";
export type VerificationMethodName = "exact" | "case_insensitive" | "normalized_text" | "numeric_exact";

export type StoredBounty = {
  id: string;
  creatorId: string;
  title: string;
  description: string;
  instructions: string;
  category: BountyCategoryName;
  rewardLamports: bigint;
  maxRewardedSolvers: number;
  attemptLimit: number;
  deadline: Date;
  status: BountyStatusName;
  closeReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredQuestion = {
  bountyId: string;
  prompt: string;
  expectedAnswerCiphertext: string;
  encryptionKeyId: string;
  verificationMethod: VerificationMethodName;
};

export type OwnerBounty = StoredBounty & { question: StoredQuestion };

export type PublicBountyRecord = {
  id: string;
  title: string;
  description: string;
  instructions: string;
  prompt: string;
  category: BountyCategoryName;
  verificationMethod: VerificationMethodName;
  status: BountyStatusName;
  rewardLamports: bigint;
  maxRewardedSolvers: number;
  attemptLimit: number;
  deadline: Date;
  closeReason: string | null;
  rewardedCount: number;
};

export type BountyWrite = {
  creatorId: string;
  title: string;
  description: string;
  instructions: string;
  category: BountyCategoryName;
  rewardLamports: bigint;
  maxRewardedSolvers: number;
  attemptLimit: number;
  deadline: Date;
  prompt: string;
  expectedAnswerCiphertext: string;
  encryptionKeyId: string;
  verificationMethod: VerificationMethodName;
  now: Date;
};

export type FundingPurposeName = "reward_pool" | "commission";

export type StoredObligation = {
  purpose: FundingPurposeName;
  depositReference: string;
  expectedLamports: bigint;
  observedLamports: bigint | null;
  status: "pending" | "confirmed" | "rejected";
  signature: string | null;
  commitment: string | null;
};

export type LedgerBuckets = {
  funded: bigint;
  reserved: bigint;
  paid: bigint;
  refundable: bigint;
  refunded: bigint;
};

export type FundingSnapshot = {
  bounty: OwnerBounty;
  obligations: StoredObligation[];
  buckets: LedgerBuckets;
};

export type ApplyFundingInput = {
  bountyId: string;
  creatorId: string;
  purpose: FundingPurposeName;
  signature: string;
  sourceAddress: string;
  destinationAddress: string;
  amountLamports: bigint;
  commitment: "confirmed" | "finalized";
  rejected: boolean;
  now: Date;
};

export type ApplyFundingResult = { kind: "applied"; snapshot: FundingSnapshot } | { kind: "missing" } | { kind: "signature_in_use" } | { kind: "already_confirmed" };

export type ActivateFundingResult = OwnerBounty | "missing" | "incomplete" | "closed";

export type StoredAttempt = {
  attemptNumber: number;
  isCorrect: boolean;
  ineligibilityReason: "pool_exhausted" | "insufficient_refundable" | null;
  submittedAt: Date;
  rewardReserved: boolean;
};

export type StoredSession = {
  id: string;
  bountyId: string;
  solverId: string;
  status: "active" | "completed";
  startedAt: Date;
  attemptLimit: number;
  title: string;
  prompt: string;
  instructions: string;
  verificationMethod: VerificationMethodName;
  rewardLamports: bigint;
  deadline: Date;
  attempts: StoredAttempt[];
};

export type SubmitAnswerResult =
  | { kind: "stored"; session: StoredSession }
  | { kind: "missing" }
  | { kind: "inactive" }
  | { kind: "limit" }
  | { kind: "completed" };

export type ResearchAggregates = {
  participantCount: number;
  correctCount: number;
  incorrectCount: number;
  attemptCount: number;
  averageCompletionTimeMs: number | null;
};

export type BountyDb = {
  $transaction<T>(fn: (tx: BountyDb) => Promise<T>): Promise<T>;
  createBounty(input: BountyWrite): Promise<OwnerBounty>;
  updateDraft(id: string, creatorId: string, input: BountyWrite): Promise<OwnerBounty | "missing" | "not_draft">;
  findOwned(id: string, creatorId: string): Promise<OwnerBounty | null>;
  listOwned(creatorId: string): Promise<OwnerBounty[]>;
  listActive(now: Date): Promise<PublicBountyRecord[]>;
  findPublic(id: string, now: Date): Promise<PublicBountyRecord | null>;
  recordConsent(bountyId: string, userId: string, now: Date): Promise<{ id: string; policyVersion: string; acceptedAt: Date } | "missing" | "inactive">;
  startSession(bountyId: string, solverId: string, now: Date): Promise<StoredSession | "missing" | "no_consent" | "inactive" | "full">;
  readSession(sessionId: string, solverId: string): Promise<StoredSession | null>;
  submitAnswer(sessionId: string, solverId: string, answer: string, now: Date, decide: (input: { ciphertext: string; method: VerificationMethodName }) => boolean): Promise<SubmitAnswerResult>;
  creatorAnalytics(bountyId: string, creatorId: string): Promise<ResearchAggregates | "missing">;
  ensureFunding(bountyId: string, creatorId: string, expected: Record<FundingPurposeName, bigint>, now: Date): Promise<FundingSnapshot | "missing" | "closed">;
  findSignature(signature: string): Promise<{ bountyId: string; purpose: FundingPurposeName } | null>;
  applyFunding(input: ApplyFundingInput): Promise<ApplyFundingResult>;
  activateIfFunded(bountyId: string, creatorId: string, now: Date): Promise<ActivateFundingResult>;
};
