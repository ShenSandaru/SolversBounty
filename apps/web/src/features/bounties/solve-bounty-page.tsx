"use client";

import { formatLamportsAsSol, RESEARCH_CONSENT_VERSION } from "@solversbounty/shared";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CategoryBadge } from "@/components/category-badge";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { RewardDisplay } from "@/components/reward-display";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiBaseUrl } from "@/features/auth/auth-client";
import { useAuthSession } from "@/features/auth/auth-session";
import { formatDeadline } from "@/lib/dates";
import { BountyClientError, acceptResearchConsent, readPublicBounty, readSolvingSession, startSolvingSession, submitSolvingAnswer, type SolvingSessionView } from "./bounty-api";
import type { PublicBounty } from "@solversbounty/shared";

const sessionKey = (bountyId: string) => `sb-solving:${bountyId}`;

export function SolveBountyPage({ id }: { id: string }) {
  const { session } = useAuthSession();
  const [bounty, setBounty] = useState<PublicBounty | null>(null);
  const [solving, setSolving] = useState<SolvingSessionView | null>(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"consent" | "submit" | null>(null);

  useEffect(() => {
    let active = true;
    readPublicBounty(apiBaseUrl(), id)
      .then((row) => {
        if (active) {
          setBounty(row);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof BountyClientError ? caught.message : "This challenge could not be loaded.");
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!session) {
      return;
    }
    const stored = sessionStorage.getItem(sessionKey(id));
    if (!stored) {
      return;
    }
    let active = true;
    readSolvingSession(apiBaseUrl(), stored)
      .then((row) => {
        if (active) {
          setSolving(row);
        }
      })
      .catch(() => {
        sessionStorage.removeItem(sessionKey(id));
      });
    return () => {
      active = false;
    };
  }, [id, session]);

  const start = useCallback(async () => {
    if (!session) {
      setError("Sign in before starting this challenge.");
      return;
    }
    setBusy("consent");
    setError(null);
    try {
      await acceptResearchConsent(apiBaseUrl(), session.csrfToken, id);
      const next = await startSolvingSession(apiBaseUrl(), session.csrfToken, id);
      sessionStorage.setItem(sessionKey(id), next.id);
      setSolving(next);
    } catch (caught) {
      setError(caught instanceof BountyClientError ? caught.message : "The solving session could not be started.");
    } finally {
      setBusy(null);
    }
  }, [id, session]);

  const submit = useCallback(async () => {
    if (!session || !solving) {
      return;
    }
    setBusy("submit");
    setError(null);
    try {
      const next = await submitSolvingAnswer(apiBaseUrl(), session.csrfToken, solving.id, answer);
      setSolving(next);
      setAnswer("");
    } catch (caught) {
      setError(caught instanceof BountyClientError ? caught.message : "The answer could not be submitted.");
    } finally {
      setBusy(null);
    }
  }, [answer, session, solving]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Challenge"
        title={bounty?.title ?? (error ? "Challenge unavailable" : "Challenge")}
        description={
          bounty?.description ??
          (error ? "The public challenge could not be loaded." : "Loading the public challenge.")
        }
        actions={<Button variant="outline" asChild><Link href="/bounties">Back to marketplace</Link></Button>}
      />
      {error ? <p className="mt-6 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p> : null}
      {bounty ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
          <section className="surface p-6">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={bounty.category} />
              <span className="rounded-full border border-input bg-secondary px-2.5 py-1 text-xs font-medium capitalize">{bounty.status}</span>
            </div>
            <h2 className="mt-4 text-lg font-semibold">Question</h2>
            <p className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-background px-4 py-3 text-base leading-8">{solving?.prompt ?? bounty.prompt}</p>
            {bounty.instructions ? <p className="mt-4 text-sm leading-6 text-muted-foreground">{bounty.instructions}</p> : null}
            {solving ? <AnswerForm solving={solving} answer={answer} busy={busy === "submit"} onAnswer={setAnswer} onSubmit={() => void submit()} /> : <ConsentPanel signedIn={Boolean(session)} open={bounty.status === "active"} busy={busy === "consent"} onStart={() => void start()} />}
          </section>
          <aside className="surface gradient-border relative h-fit overflow-hidden p-6 lg:sticky lg:top-24">
            <RewardDisplay lamports={bounty.rewardLamports} size="lg" />
            <ul className="mt-4 grid gap-2 text-sm leading-6 text-muted-foreground">
              <li>Maximum rewarded solvers: {bounty.maxRewardedSolvers}. Rewarded so far: {bounty.rewardedCount}.</li>
              <li>Attempt limit: {bounty.attemptLimit}.</li>
              <li>Deadline {formatDeadline(bounty.deadline)}.</li>
              <li>Each eligible correct solver receives {formatLamportsAsSol(BigInt(bounty.rewardLamports))} SOL from the custodial Devnet treasury. This page does not send that transfer.</li>
            </ul>
          </aside>
        </div>
      ) : null}
    </PageContainer>
  );
}

function ConsentPanel({ signedIn, open, busy, onStart }: { signedIn: boolean; open: boolean; busy: boolean; onStart: () => void }) {
  if (!open) {
    return <p className="mt-6 text-sm text-muted-foreground">This bounty is not open for a new solving session.</p>;
  }
  return (
    <div className="mt-6 rounded-lg border border-brand-purple/30 bg-brand-purple/[0.07] p-4">
      <h2 className="text-lg font-semibold">Research consent</h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Wallet sign-in does not record research consent. Version {RESEARCH_CONSENT_VERSION} covers four server-measured items: whether an attempt is correct, how many attempts are stored, the time from the server session start to the first correct attempt, and the count of solvers who start a session. No strategy survey or written explanation is collected. Wallet addresses stay out of creator analytics. Payments use a custodial Devnet treasury, and wallet addresses are pseudonymous.
      </p>
      {signedIn ? <Button className="mt-4" disabled={busy} onClick={onStart}>{busy ? "Starting" : "Accept and start"}</Button> : <p className="mt-4 text-sm text-muted-foreground">Sign in to accept and start.</p>}
    </div>
  );
}

function AnswerForm({ solving, answer, busy, onAnswer, onSubmit }: { solving: SolvingSessionView; answer: string; busy: boolean; onAnswer: (value: string) => void; onSubmit: () => void }) {
  const latest = solving.latest;
  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold">Your answer</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Attempt {solving.attemptsUsed} of {solving.attemptLimit}. {solving.remainingAttempts} remaining. The server checks the answer.
      </p>
      {latest ? <ResultLine solving={solving} /> : null}
      {solving.status === "completed" ? <p className="mt-4 rounded-lg border border-border bg-secondary px-3 py-2 text-sm">This solving session is complete.</p> : (
        <>
          <Textarea className="mt-4" value={answer} onChange={(event) => onAnswer(event.target.value)} placeholder="Answer" />
          <Button className="mt-4" disabled={busy || answer.trim().length === 0} onClick={onSubmit}>{busy ? "Checking" : "Submit answer"}</Button>
        </>
      )}
    </div>
  );
}

function ResultLine({ solving }: { solving: SolvingSessionView }) {
  const latest = solving.latest;
  if (!latest) {
    return null;
  }
  if (!latest.isCorrect) {
    return <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm" role="status">Incorrect. {solving.remainingAttempts} attempts remaining.</p>;
  }
  if (latest.ineligibilityReason) {
    const reason = latest.ineligibilityReason === "pool_exhausted" ? "the rewarded solver cap is full" : "the reward pool cannot cover another reward";
    return <p className="mt-4 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm" role="status">Correct. No reward was reserved because {reason}.</p>;
  }
  return <p className="mt-4 rounded-lg border border-brand-green/40 bg-brand-green/10 px-3 py-2 text-sm" role="status">Correct. A reward is reserved and the payout is pending. No Devnet transfer has been sent.</p>;
}
