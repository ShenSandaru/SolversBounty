import type { CreateBountyFormValues } from "./create-bounty-schema";

export type BountyDraft = {
  id: string;
  title: string;
  description: string;
  instructions: string;
  prompt: string;
  category: CreateBountyFormValues["category"];
  verificationMethod: CreateBountyFormValues["verificationMethod"];
  expectedAnswer: string;
  rewardLamports: string;
  principalLamports: string;
  commissionLamports: string;
  maxRewardedSolvers: number;
  attemptLimit: number;
  deadline: string;
  status: "draft" | "funding_pending" | "active" | "closed";
  closeReason: string | null;
};

export type BountyWriteBody = {
  title: string;
  description: string;
  instructions: string;
  prompt: string;
  category: CreateBountyFormValues["category"];
  expectedAnswer: string;
  verificationMethod: CreateBountyFormValues["verificationMethod"];
  rewardSol: string;
  maxRewardedSolvers: number;
  attemptLimit: number;
  deadline: string;
};

export function bountyWriteBody(values: CreateBountyFormValues): BountyWriteBody {
  const deadline = new Date(values.deadline);
  return {
    title: values.title,
    description: values.description,
    instructions: values.instructions,
    prompt: values.prompt,
    category: values.category,
    expectedAnswer: values.expectedAnswer,
    verificationMethod: values.verificationMethod,
    rewardSol: values.rewardSol,
    maxRewardedSolvers: values.maxRewardedSolvers,
    attemptLimit: values.attemptLimit,
    deadline: Number.isNaN(deadline.getTime()) ? values.deadline : deadline.toISOString(),
  };
}

export class BountyClientError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export async function createBounty(apiUrl: string, csrfToken: string, body: BountyWriteBody, fetchImpl: FetchLike = fetch): Promise<BountyDraft> {
  return sendJson(fetchImpl, `${apiUrl}/bounties`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify(body),
  });
}

export async function updateBounty(apiUrl: string, csrfToken: string, id: string, body: BountyWriteBody, fetchImpl: FetchLike = fetch): Promise<BountyDraft> {
  return sendJson(fetchImpl, `${apiUrl}/bounties/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify(body),
  });
}

export async function listMyBounties(apiUrl: string, fetchImpl: FetchLike = fetch): Promise<BountyDraft[]> {
  const response = await send(fetchImpl, `${apiUrl}/bounties/mine`, { method: "GET", credentials: "include" });
  const body = (await response.json()) as unknown;
  if (!Array.isArray(body)) {
    throw new BountyClientError("The API returned an incomplete bounty list.");
  }
  return body.map(readDraft);
}

export type FundingObligation = {
  purpose: "reward_pool" | "commission";
  expectedLamports: string;
  observedLamports: string | null;
  depositReference: string;
  status: "pending" | "confirmed" | "rejected";
  signature: string | null;
  commitment: string | null;
};

export type FundingView = {
  bountyId: string;
  status: BountyDraft["status"];
  treasuryAddress: string;
  network: "devnet";
  custody: "custodial";
  rewardLamports: string;
  maxRewardedSolvers: number;
  rewardPoolLamports: string;
  commissionLamports: string;
  totalFundingLamports: string;
  obligations: FundingObligation[];
  buckets: { funded: string; reserved: string; paid: string; refundable: string; refunded: string };
  canActivate: boolean;
};

export async function readFunding(apiUrl: string, id: string, fetchImpl: FetchLike = fetch): Promise<FundingView> {
  const response = await fundingSend(fetchImpl, `${apiUrl}/bounties/${id}/funding`, { method: "GET", credentials: "include" });
  return readFundingView(await response.json());
}

export async function submitFunding(apiUrl: string, csrfToken: string, id: string, purpose: "reward-pool" | "commission", signature: string, fetchImpl: FetchLike = fetch): Promise<FundingView> {
  const response = await fundingSend(fetchImpl, `${apiUrl}/bounties/${id}/funding/${purpose}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify({ signature }),
  });
  return readFundingView(await response.json());
}

export async function activateBounty(apiUrl: string, csrfToken: string, id: string, fetchImpl: FetchLike = fetch): Promise<void> {
  await fundingSend(fetchImpl, `${apiUrl}/bounties/${id}/activate`, {
    method: "POST",
    credentials: "include",
    headers: { "X-CSRF-Token": csrfToken },
  });
}

export async function readMyBounty(apiUrl: string, id: string, fetchImpl: FetchLike = fetch): Promise<BountyDraft> {
  const response = await send(fetchImpl, `${apiUrl}/bounties/${id}`, { method: "GET", credentials: "include" });
  return readDraft(await response.json());
}

async function sendJson(fetchImpl: FetchLike, url: string, init: RequestInit): Promise<BountyDraft> {
  const response = await send(fetchImpl, url, init);
  return readDraft(await response.json());
}

async function fundingSend(fetchImpl: FetchLike, url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, cache: "no-store" });
  } catch {
    throw new BountyClientError("The API is unavailable.", "API_UNAVAILABLE");
  }
  if (response.ok) {
    return response;
  }
  let message = "The funding request failed.";
  let code = "API_FAILURE";
  try {
    const body = (await response.json()) as { message?: string; code?: string };
    if (typeof body.message === "string" && body.message.length > 0) {
      message = body.message;
    }
    if (body.code) {
      code = body.code;
    }
  } catch {
    code = "API_FAILURE";
  }
  throw new BountyClientError(message, code);
}

function readFundingView(value: unknown): FundingView {
  if (!isRecord(value) || typeof value.bountyId !== "string" || typeof value.treasuryAddress !== "string" || !Array.isArray(value.obligations)) {
    throw new BountyClientError("The API returned an incomplete funding record.");
  }
  if (value.custody !== "custodial" || value.network !== "devnet") {
    throw new BountyClientError("The API returned an incomplete funding record.");
  }
  return value as FundingView;
}

async function send(fetchImpl: FetchLike, url: string, init: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, cache: "no-store" });
  } catch {
    throw new BountyClientError("The API is unavailable.", "API_UNAVAILABLE");
  }
  if (response.ok) {
    return response;
  }
  let code = "API_FAILURE";
  try {
    const body = (await response.json()) as { code?: string };
    if (body.code) {
      code = body.code;
    }
  } catch {
    code = "API_FAILURE";
  }
  if (response.status === 401) {
    throw new BountyClientError("Sign in before managing a bounty.", code);
  }
  if (response.status === 403) {
    throw new BountyClientError("The server rejected this request. Sign in again.", code);
  }
  if (response.status === 404) {
    throw new BountyClientError("That bounty was not found.", code);
  }
  if (response.status === 400) {
    throw new BountyClientError("Check the bounty fields and try again.", code);
  }
  throw new BountyClientError("The bounty could not be saved.", code);
}

function readDraft(value: unknown): BountyDraft {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string" || typeof value.status !== "string") {
    throw new BountyClientError("The API returned an incomplete bounty.");
  }
  if (value.status !== "draft" && value.status !== "funding_pending" && value.status !== "active" && value.status !== "closed") {
    throw new BountyClientError("The API returned an incomplete bounty.");
  }
  return value as BountyDraft;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
