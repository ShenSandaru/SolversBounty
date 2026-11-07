"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiBaseUrl } from "@/features/auth/auth-client";
import { useAuthSession } from "@/features/auth/auth-session";
import { BountyClientError, listMyBounties, type BountyDraft } from "@/features/bounties/bounty-api";
import { formatDeadline } from "@/lib/dates";
import { statusLabels } from "@/lib/labels";

export function CreatorDraftList() {
  const { session } = useAuthSession();
  const [loaded, setLoaded] = useState<{ wallet: string; rows: BountyDraft[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      return;
    }
    const wallet = session.walletAddress;
    let active = true;
    listMyBounties(apiBaseUrl())
      .then((rows) => {
        if (active) {
          setLoaded({ wallet, rows });
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof BountyClientError ? caught.message : "Drafts could not be loaded.");
        }
      });
    return () => {
      active = false;
    };
  }, [session]);

  // Rows from a previous wallet are never shown after logout or a wallet switch.
  const drafts = session && loaded?.wallet === session.walletAddress ? loaded.rows : null;
  if (!session) {
    return <p className="mt-4 text-sm text-muted-foreground">Sign in to see your drafts.</p>;
  }
  if (error) {
    return (
      <p className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }
  if (!drafts) {
    return <div className="mt-4 h-24 animate-pulse rounded-xl border border-border bg-card" role="status"><span className="sr-only">Loading drafts.</span></div>;
  }
  if (drafts.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No drafts yet. <Link href="/bounties/create" className="font-medium hover:text-brand-green hover:underline">Create a bounty</Link>.
      </p>
    );
  }
  return (
    <div className="mt-4 surface overflow-x-auto">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">Your bounty drafts</caption>
        <thead className="bg-secondary/60 text-xs tracking-wider text-muted-foreground uppercase">
          <tr>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Deadline</th>
          </tr>
        </thead>
        <tbody>
          {drafts.map((bounty) => (
            <tr key={bounty.id} className="border-t border-border transition-colors hover:bg-card-elevated">
              <td className="px-4 py-3">
                <Link href={`/bounties/${bounty.id}/edit`} className="font-medium hover:text-brand-green hover:underline">
                  {bounty.title}
                </Link>
              </td>
              <td className="px-4 py-3"><span className="rounded-full border border-input bg-secondary px-2.5 py-1 text-xs font-medium">{statusLabels[bounty.status]}</span></td>
              <td className="px-4 py-3">{formatDeadline(bounty.deadline)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
