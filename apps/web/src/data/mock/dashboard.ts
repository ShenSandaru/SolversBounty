export type SampleActivity = {
  id: string;
  audience: "creator" | "solver";
  title: string;
  detail: string;
  when: string;
};

export const dashboardSample = {
  notice:
    "Sample figures for the layout. Creator rows are the preview fixtures. Solver totals are not your rewards or research results.",
  completedChallenges: 3,
  rewardsEarnedLamports: "80000000",
  solverSummary: {
    sessionsStarted: 5,
    correctAttempts: 3,
    incorrectAttempts: 2,
    rewardsPending: 1,
  },
  activity: [
    {
      id: "activity-1",
      audience: "solver",
      title: "Sample session completed",
      detail: "A sample solver finished The archive door inside the attempt limit.",
      when: "2 hours ago",
    },
    {
      id: "activity-2",
      audience: "creator",
      title: "Sample bounty awaiting funds",
      detail: "Lattice count is funding pending until a Devnet deposit confirms.",
      when: "Yesterday",
    },
    {
      id: "activity-3",
      audience: "solver",
      title: "Sample reward reserved",
      detail: "One sample payout is reserved and has not been confirmed.",
      when: "Yesterday",
    },
    {
      id: "activity-4",
      audience: "creator",
      title: "Sample challenge closed",
      detail: "Alphabet primer closed because its deadline passed. Displayed close reason: Expired.",
      when: "Last week",
    },
  ] satisfies SampleActivity[],
};
