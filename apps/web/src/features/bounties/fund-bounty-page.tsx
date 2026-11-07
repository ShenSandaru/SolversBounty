"use client";

import { formatLamportsAsSol } from "@solversbounty/shared";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { apiBaseUrl } from "@/features/auth/auth-client";
import { useAuthSession } from "@/features/auth/auth-session";
import { BountyClientError, activateBounty, readFunding, submitFunding, type FundingView } from "./bounty-api";
import { buildFundingTransaction } from "./funding-transaction";

const pendingKey = (bountyId: string, purpose: "reward_pool" | "commission") => `sb-funding:${bountyId}:${purpose}`;

export function FundBountyPage({ id }: { id: string }) {
  const { session } = useAuthSession();
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [funding, setFunding] = useState<FundingView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<"reward_pool" | "commission" | "activate" | null>(null);
  const [pending, setPending] = useState<Record<"reward_pool" | "commission", string | null>>({ reward_pool: null, commission: null });

  useEffect(() => {
    setPending({
      reward_pool: sessionStorage.getItem(pendingKey(id, "reward_pool")),
      commission: sessionStorage.getItem(pendingKey(id, "commission")),
    });
  }, [id]);

  const load = useCallback(async () => {
    const next = await readFunding(apiBaseUrl(), id);
    setFunding(next);
    return next;
  }, [id]);

  useEffect(() => {
    if (!session) {
      return;
    }
    let active = true;
    load()
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof BountyClientError ? caught.message : "Funding details could not be loaded.");
        }
      });
    return () => {
      active = false;
    };
  }, [load, session]);

  const walletMatches = Boolean(session && publicKey && publicKey.toBase58() === session.walletAddress);

  const checkSignature = useCallback(async (purpose: "reward_pool" | "commission", signature: string) => {
    if (!session) {
      return;
    }
    const route = purpose === "reward_pool" ? "reward-pool" : "commission";
    try {
      const next = await submitFunding(apiBaseUrl(), session.csrfToken, id, route, signature);
      setFunding(next);
      const obligation = next.obligations.find((item) => item.purpose === purpose);
      if (obligation?.status === "confirmed") {
        sessionStorage.removeItem(pendingKey(id, purpose));
        setPending((current) => ({ ...current, [purpose]: null }));
        setNotice(purpose === "reward_pool" ? "Reward-pool transfer confirmed." : "Commission transfer confirmed.");
        setError(null);
      }
    } catch (caught) {
      const message = caught instanceof BountyClientError ? caught.message : "The transfer could not be verified.";
      const retry = /same signature|not confirmed|did not answer/i.test(message);
      if (!retry) {
        sessionStorage.removeItem(pendingKey(id, purpose));
        setPending((current) => ({ ...current, [purpose]: null }));
      }
      setError(message);
    }
  }, [id, session]);

  const sendTransfer = useCallback(async (purpose: "reward_pool" | "commission") => {
    if (!session || !funding || !publicKey || !walletMatches) {
      setError(walletMatches ? "Connect the signed-in wallet before sending SOL." : "The connected wallet is different from the signed-in wallet.");
      return;
    }
    const obligation = funding.obligations.find((item) => item.purpose === purpose);
    if (!obligation || obligation.status === "confirmed") {
      return;
    }
    setBusy(purpose);
    setError(null);
    setNotice(null);
    try {
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      const transaction = buildFundingTransaction({
        from: publicKey,
        treasury: new PublicKey(funding.treasuryAddress),
        lamports: BigInt(obligation.expectedLamports),
        memo: obligation.depositReference,
        recentBlockhash: blockhash,
      });
      const signature = await sendTransaction(transaction, connection);
      sessionStorage.setItem(pendingKey(id, purpose), signature);
      setPending((current) => ({ ...current, [purpose]: signature }));
      setNotice("Phantom requested a SOL transfer to the custodial Devnet treasury. This is not a login signature.");
      await checkSignature(purpose, signature);
    } catch (caught) {
      setError(caught instanceof BountyClientError ? caught.message : "The wallet did not send the transfer.");
    } finally {
      setBusy(null);
    }
  }, [checkSignature, connection, funding, id, publicKey, sendTransaction, session, walletMatches]);

  const activate = useCallback(async () => {
    if (!session) {
      return;
    }
    setBusy("activate");
    setError(null);
    try {
      await activateBounty(apiBaseUrl(), session.csrfToken, id);
      await load();
      setNotice("The bounty is active. It can appear in the marketplace.");
    } catch (caught) {
      setError(caught instanceof BountyClientError ? caught.message : "The bounty could not be activated.");
    } finally {
      setBusy(null);
    }
  }, [id, load, session]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Custodial Devnet treasury"
        title="Fund this bounty"
        description="Two separate SOL transfers are required. The reward pool stays available for solvers. The 5% commission is extra and is not taken from that pool. Nothing is sent until you approve each transfer in Phantom."
        actions={
          <Link href={`/bounties/${id}/edit`} className="text-sm font-medium hover:underline">
            Back to the draft
          </Link>
        }
      />
      {!session ? <p className="mt-6 text-sm text-muted-foreground">Sign in to fund this bounty.</p> : null}
      {session && !funding && !error ? <p className="mt-6 text-sm text-muted-foreground">Loading funding requirements.</p> : null}
      {error ? <p className="mt-6 text-sm text-destructive" role="alert">{error}</p> : null}
      {notice ? <p className="mt-6 text-sm text-muted-foreground">{notice}</p> : null}
      {funding ? <FundingSummary funding={funding} busy={busy} walletMatches={walletMatches} pending={pending} onSend={(purpose) => void sendTransfer(purpose)} onCheck={(purpose) => void checkSignature(purpose, pending[purpose] ?? "")} onActivate={() => void activate()} /> : null}
    </PageContainer>
  );
}

function FundingSummary({
  funding,
  busy,
  walletMatches,
  pending,
  onSend,
  onCheck,
  onActivate,
}: {
  funding: FundingView;
  busy: "reward_pool" | "commission" | "activate" | null;
  walletMatches: boolean;
  pending: Record<"reward_pool" | "commission", string | null>;
  onSend: (purpose: "reward_pool" | "commission") => void;
  onCheck: (purpose: "reward_pool" | "commission") => void;
  onActivate: () => void;
}) {
  const pool = funding.obligations.find((item) => item.purpose === "reward_pool");
  const commission = funding.obligations.find((item) => item.purpose === "commission");
  return (
    <div className="mt-6 grid gap-4">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Figure label="Reward per solver" value={`${formatLamportsAsSol(BigInt(funding.rewardLamports))} SOL`} />
        <Figure label="Maximum rewarded solvers" value={String(funding.maxRewardedSolvers)} />
        <Figure label="Reward pool" value={`${formatLamportsAsSol(BigInt(funding.rewardPoolLamports))} SOL`} />
        <Figure label="Platform commission (5%)" value={`${formatLamportsAsSol(BigInt(funding.commissionLamports))} SOL`} />
        <Figure label="Total you send" value={`${formatLamportsAsSol(BigInt(funding.totalFundingLamports))} SOL`} />
        <Figure label="Treasury" value={funding.treasuryAddress} />
        <Figure label="Funded principal" value={`${formatLamportsAsSol(BigInt(funding.buckets.funded))} SOL`} />
        <Figure label="Unallocated principal" value={`${formatLamportsAsSol(BigInt(funding.buckets.refundable))} SOL`} />
      </dl>
      <p className="text-sm text-muted-foreground">Status: {funding.status}. Network: Devnet. Custody is custodial, not escrow.</p>
      {pool ? <ObligationRow label="Reward pool" obligation={pool} pending={pending.reward_pool} disabled={!walletMatches || busy !== null} onSend={() => onSend("reward_pool")} onCheck={() => onCheck("reward_pool")} /> : null}
      {commission ? <ObligationRow label="Commission" obligation={commission} pending={pending.commission} disabled={!walletMatches || busy !== null} onSend={() => onSend("commission")} onCheck={() => onCheck("commission")} /> : null}
      {!walletMatches ? <p className="text-sm text-muted-foreground">Connect the same wallet you used to sign in. The transfer is approved only when you confirm it in Phantom.</p> : null}
      <div>
        <Button type="button" disabled={!funding.canActivate || busy !== null} onClick={onActivate}>
          {busy === "activate" ? "Activating" : funding.status === "active" ? "Active" : "Activate bounty"}
        </Button>
      </div>
    </div>
  );
}

function ObligationRow({
  label,
  obligation,
  pending,
  disabled,
  onSend,
  onCheck,
}: {
  label: string;
  obligation: FundingView["obligations"][number];
  pending: string | null;
  disabled: boolean;
  onSend: () => void;
  onCheck: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{obligation.status}{obligation.commitment ? ` · ${obligation.commitment}` : ""}</p>
      </div>
      {obligation.status === "confirmed" ? null : pending ? (
        <Button type="button" variant="outline" disabled={disabled} onClick={onCheck}>Check confirmation</Button>
      ) : (
        <Button type="button" disabled={disabled} onClick={onSend}>Send SOL</Button>
      )}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-4 py-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-all font-medium">{value}</dd>
    </div>
  );
}
