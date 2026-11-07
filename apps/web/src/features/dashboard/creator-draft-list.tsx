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
  const [drafts, setDrafts] = useState<BountyDraft[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!session) {
      setDrafts(null);
      return;
    }
    let active = true;
    listMyBounties(apiBaseUrl())
      .then((rows) => {
        if (active) {
          setDrafts(rows);
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

  if (!session) {
    return <p className="mt-4 text-sm text-muted-foreground">Sign in to see your drafts.</p>;
  }
  if (error) {
    return (
      <p className="mt-4 text-sm text-destructive" role="alert">
        {error}
      </p>
    );
  }
  if (!drafts) {
    return <p className="mt-4 text-sm text-muted-foreground">Loading drafts.</p>;
  }
  if (drafts.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No drafts yet. <Link href="/bounties/create" className="font-medium hover:underline">Create a bounty</Link>.
      </p>
    );
  }
  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[40rem] text-left text-sm">
        <caption className="sr-only">Your bounty drafts</caption>
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Deadline</th>
          </tr>
        </thead>
        <tbody>
          {drafts.map((bounty) => (
            <tr key={bounty.id} className="border-t border-border">
              <td className="px-4 py-3">
                <Link href={`/bounties/${bounty.id}/edit`} className="font-medium hover:underline">
                  {bounty.title}
                </Link>
              </td>
              <td className="px-4 py-3">{statusLabels[bounty.status]}</td>
              <td className="px-4 py-3">{formatDeadline(bounty.deadline)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
