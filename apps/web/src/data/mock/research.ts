export type ResearchSample = {
  id: string;
  bountyTitle: string;
  participants: number;
  correctSolvers: number;
  correctAttempts: number;
  incorrectAttempts: number;
  averageCompletionTime: string;
  medianCompletionTime: string;
  averageAttempts: string;
  averageAttemptsBeforeSuccess: string;
};

export const researchNotice =
  "Demonstration data for the layout. These figures are not research results from solvers.";

export const researchSamples: ResearchSample[] = [
  {
    id: "archive-door",
    bountyTitle: "The archive door",
    participants: 24,
    correctSolvers: 15,
    correctAttempts: 18,
    incorrectAttempts: 21,
    averageCompletionTime: "6m 40s",
    medianCompletionTime: "5m 10s",
    averageAttempts: "1.63",
    averageAttemptsBeforeSuccess: "1.40",
  },
  {
    id: "empty-sessions",
    bountyTitle: "Signal inventory",
    participants: 0,
    correctSolvers: 0,
    correctAttempts: 0,
    incorrectAttempts: 0,
    averageCompletionTime: "—",
    medianCompletionTime: "—",
    averageAttempts: "—",
    averageAttemptsBeforeSuccess: "—",
  },
];

export function accuracyPercent(sample: ResearchSample): number | null {
  const attempts = sample.correctAttempts + sample.incorrectAttempts;
  if (attempts === 0) {
    return null;
  }
  return (sample.correctAttempts / attempts) * 100;
}

export function completionRatePercent(sample: ResearchSample): number | null {
  if (sample.participants === 0) {
    return null;
  }
  return (sample.correctSolvers / sample.participants) * 100;
}
