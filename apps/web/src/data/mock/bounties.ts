import { publicBountySchema } from "@solversbounty/shared";
import type { PreviewBounty } from "./types";

const drafts: PreviewBounty[] = [
  {
    id: "archive-door",
    title: "The archive door",
    description:
      "Three labeled doors stand between a researcher and a locked archive. Exactly one label is true.",
    instructions:
      "Use only the labels. Do not assume a door is safe because it sounds familiar. Submit the door letter.",
    prompt:
      "Door A says 'B leads to the archive.' Door B says 'C does not lead to the archive.' Door C says 'A does not lead to the archive.' Exactly one label is true. Which door leads to the archive?",
    category: "logic",
    status: "active",
    rewardLamports: "50000000",
    maxRewardedSolvers: 40,
    rewardedCount: 12,
    attemptLimit: 3,
    deadline: "2026-12-18T18:00:00.000Z",
    difficulty: "intermediate",
  },
  {
    id: "grading-rate",
    title: "Grading rate",
    description:
      "Two reviewers grade the same stack of papers at constant rates. The question asks when the stack is finished.",
    instructions: "Give the number of hours. Units are not required.",
    prompt:
      "Reviewer A finishes the stack alone in 6 hours. Reviewer B finishes the same stack alone in 3 hours. Working together at those constant rates, how many hours do they need?",
    category: "mathematics",
    status: "active",
    rewardLamports: "20000000",
    maxRewardedSolvers: 80,
    rewardedCount: 27,
    attemptLimit: 4,
    deadline: "2026-12-02T16:00:00.000Z",
    difficulty: "introductory",
  },
  {
    id: "doubling-gap",
    title: "The doubling gap",
    description: "A short numerical sequence changes by a regular rule. Find the next term.",
    instructions: "Submit the next number only.",
    prompt: "Find the next term in 2, 3, 5, 9, 17.",
    category: "numerical_patterns",
    status: "active",
    rewardLamports: "15000000",
    maxRewardedSolvers: 60,
    rewardedCount: 41,
    attemptLimit: 2,
    deadline: "2026-11-28T12:00:00.000Z",
    difficulty: "introductory",
  },
  {
    id: "night-desk",
    title: "Night desk cipher",
    description:
      "A lab notebook line was shifted by a fixed alphabet offset. The offset is stated. The plaintext is not.",
    instructions: "Submit the plaintext word in uppercase letters.",
    prompt: "Each letter was moved forward by 4. Recover the word: LIVI.",
    category: "ciphers",
    status: "active",
    rewardLamports: "100000000",
    maxRewardedSolvers: 25,
    rewardedCount: 6,
    attemptLimit: 5,
    deadline: "2027-01-09T20:00:00.000Z",
    difficulty: "intermediate",
  },
  {
    id: "three-claims",
    title: "Three claims about a number",
    description:
      "A whole number is hidden. Three claims are made, and the preamble tells you how many are true.",
    instructions: "Submit the only whole number that fits the preamble.",
    prompt:
      "Exactly two of these claims are true. 1) The number is even. 2) The number is greater than 10. 3) The number is 8. What is the number?",
    category: "logic",
    status: "closed",
    rewardLamports: "30000000",
    maxRewardedSolvers: 50,
    rewardedCount: 50,
    attemptLimit: 3,
    deadline: "2026-12-30T15:00:00.000Z",
    difficulty: "advanced",
    closeReason: "fully_allocated",
  },
  {
    id: "square-steps",
    title: "Square steps",
    description: "The terms grow by successive square numbers. Continue the sequence.",
    instructions: "Submit the next term as a whole number.",
    prompt: "Find the next term in 1, 2, 6, 15, 31.",
    category: "numerical_patterns",
    status: "active",
    rewardLamports: "25000000",
    maxRewardedSolvers: 35,
    rewardedCount: 9,
    attemptLimit: 3,
    deadline: "2026-12-22T09:30:00.000Z",
    difficulty: "advanced",
  },
  {
    id: "column-shift",
    title: "Column shift",
    description:
      "A five-letter token was written with a repeating column shift. The rule is public. The token is not.",
    instructions: "Keep the letters in order. Do not insert spaces.",
    prompt:
      "Shift the first, third, and fifth letters back by 1, and leave the others in place. Recover: CPJQO.",
    category: "ciphers",
    status: "active",
    rewardLamports: "75000000",
    maxRewardedSolvers: 20,
    rewardedCount: 4,
    attemptLimit: 4,
    deadline: "2027-01-20T18:00:00.000Z",
    difficulty: "advanced",
  },
  {
    id: "shared-tank",
    title: "Shared tank",
    description: "Two pipes fill one tank. A third pipe empties it. All three rates are constant.",
    instructions: "Submit the number of hours as a whole number.",
    prompt:
      "Pipe A fills the tank in 4 hours. Pipe B fills it in 12 hours. Pipe C empties a full tank in 6 hours. Starting empty, with all three open, how many hours until the tank is full?",
    category: "mathematics",
    status: "active",
    rewardLamports: "40000000",
    maxRewardedSolvers: 30,
    rewardedCount: 11,
    attemptLimit: 3,
    deadline: "2026-12-11T11:00:00.000Z",
    difficulty: "intermediate",
  },
  {
    id: "draft-signals",
    title: "Signal inventory",
    description: "A draft logic challenge about radio signals. It is not open for attempts.",
    instructions: "Not published.",
    prompt: "Four beacons flash. Exactly one pattern repeats every statement. Which beacon is consistent?",
    category: "logic",
    status: "draft",
    rewardLamports: "10000000",
    maxRewardedSolvers: 10,
    rewardedCount: 0,
    attemptLimit: 2,
    deadline: "2027-02-01T12:00:00.000Z",
    difficulty: "introductory",
  },
  {
    id: "funding-lattice",
    title: "Lattice count",
    description: "A mathematics challenge waiting for a confirmed Devnet deposit.",
    instructions: "Submit the count of shortest paths.",
    prompt: "How many shortest paths cross a 3 by 3 grid from the bottom-left corner to the top-right corner?",
    category: "mathematics",
    status: "funding_pending",
    rewardLamports: "60000000",
    maxRewardedSolvers: 15,
    rewardedCount: 0,
    attemptLimit: 3,
    deadline: "2027-02-14T12:00:00.000Z",
    difficulty: "intermediate",
  },
  {
    id: "closed-primer",
    title: "Alphabet primer",
    description: "A short cipher that reached its deadline and no longer accepts sessions.",
    instructions: "This challenge is closed.",
    prompt: "Each letter moved back by 1. The ciphertext was QFBS.",
    category: "ciphers",
    status: "closed",
    rewardLamports: "10000000",
    maxRewardedSolvers: 20,
    rewardedCount: 7,
    attemptLimit: 2,
    deadline: "2026-10-01T12:00:00.000Z",
    difficulty: "introductory",
    closeReason: "deadline",
  },
];

function publish(draft: PreviewBounty): PreviewBounty {
  const { difficulty, closeReason, ...publicFields } = draft;
  return {
    ...publicBountySchema.parse(publicFields),
    difficulty,
    ...(closeReason ? { closeReason } : {}),
  };
}

const previewBounties = drafts.map(publish);

// The preview list is pinned to the Phase 3 fixture date so cards do not disappear as the clock moves.
export const marketplaceBounties = previewBounties.filter(
  (bounty) =>
    bounty.status === "active" &&
    bounty.rewardedCount < bounty.maxRewardedSolvers &&
    new Date(bounty.deadline).getTime() > Date.parse("2026-11-07T00:00:00.000Z"),
);

export const creatorBounties = previewBounties;

export function findPreviewBounty(id: string): PreviewBounty | undefined {
  return previewBounties.find((bounty) => bounty.id === id);
}
