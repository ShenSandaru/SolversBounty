import { describe, expect, it, vi } from "vitest";
import { bountyWriteBody, createBounty, listMyBounties, updateBounty } from "./bounty-api";
import type { CreateBountyFormValues } from "./create-bounty-schema";

const values: CreateBountyFormValues = {
  title: "Parity",
  description: "A public description.",
  instructions: "Read the prompt.",
  prompt: "2 + 2",
  category: "mathematics",
  expectedAnswer: "4",
  verificationMethod: "numeric_exact",
  rewardSol: "0.01",
  maxRewardedSolvers: 100,
  attemptLimit: 3,
  deadline: "2099-01-01T00:00",
  difficulty: "introductory",
  consentAcknowledged: true,
};

describe("bounty client", () => {
  it("omits difficulty, consent, and creator identity from the request", () => {
    const body = bountyWriteBody(values);
    expect(body).not.toHaveProperty("difficulty");
    expect(body).not.toHaveProperty("consentAcknowledged");
    expect(body).not.toHaveProperty("creatorId");
    expect(body.rewardSol).toBe("0.01");
    expect(body.deadline).toBe(new Date("2099-01-01T00:00").toISOString());
  });

  it("saves a draft and reports success", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "bounty-1",
          title: "Parity",
          status: "draft",
          rewardLamports: "10000000",
          principalLamports: "1000000000",
          commissionLamports: "50000000",
        }),
        { status: 201 },
      ),
    );
    const draft = await createBounty("http://localhost:3001", "csrf", bountyWriteBody(values), fetchImpl);
    expect(draft.status).toBe("draft");
    expect(fetchImpl).toHaveBeenCalledWith(
      "http://localhost:3001/bounties",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({ "X-CSRF-Token": "csrf" }),
      }),
    );
  });

  it("shows a validation failure without inventing a saved draft", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "VALIDATION_ERROR" }), { status: 400 }));
    await expect(createBounty("http://localhost:3001", "csrf", bountyWriteBody(values), fetchImpl)).rejects.toThrow(
      "Check the bounty fields and try again.",
    );
  });

  it("shows an unavailable API while saving", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(updateBounty("http://localhost:3001", "csrf", "bounty-1", bountyWriteBody(values), fetchImpl)).rejects.toThrow(
      "The API is unavailable.",
    );
  });

  it("loads the signed-in creator's drafts", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify([{ id: "bounty-1", title: "Parity", status: "draft" }]), { status: 200 }));
    const rows = await listMyBounties("http://localhost:3001", fetchImpl);
    expect(rows).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledWith("http://localhost:3001/bounties/mine", expect.objectContaining({ credentials: "include" }));
  });
});
