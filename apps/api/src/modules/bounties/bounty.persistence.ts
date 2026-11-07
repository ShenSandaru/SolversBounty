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

export type BountyDb = {
  $transaction<T>(fn: (tx: BountyDb) => Promise<T>): Promise<T>;
  createBounty(input: BountyWrite): Promise<OwnerBounty>;
  updateDraft(id: string, creatorId: string, input: BountyWrite): Promise<OwnerBounty | "missing" | "not_draft">;
  findOwned(id: string, creatorId: string): Promise<OwnerBounty | null>;
  listOwned(creatorId: string): Promise<OwnerBounty[]>;
  listActive(): Promise<PublicBountyRecord[]>;
};
