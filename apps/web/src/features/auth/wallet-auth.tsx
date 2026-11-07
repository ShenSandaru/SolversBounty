"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AuthClientError,
  type AuthSession,
  apiBaseUrl,
  connectErrorMessage,
  logoutSession,
  restoreSession,
  signInWithWallet,
} from "./auth-client";

type Phase = "idle" | "connecting" | "signing" | "logging-out";

export function WalletAuth() {
  const { connected, connecting, disconnect, publicKey, select, signMessage, wallet, wallets } = useWallet();
  const [session, setSession] = useState<AuthSession | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    restoreSession(apiBaseUrl())
      .then((restored) => {
        if (active) {
          setSession(restored);
        }
      })
      .catch((caught: unknown) => {
        if (!active || !(caught instanceof AuthClientError) || caught.code === "UNAUTHENTICATED") {
          return;
        }
        setError(caught.message);
      })
      .finally(() => {
        if (active) {
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const onConnect = useCallback(async () => {
    setError(null);
    const phantom = wallets.find((item) => item.adapter.name === "Phantom");
    if (!phantom || phantom.readyState === WalletReadyState.NotDetected || phantom.readyState === WalletReadyState.Unsupported) {
      setError("Phantom is not available. Install it and refresh this page.");
      return;
    }
    setPhase("connecting");
    try {
      select(phantom.adapter.name);
      await phantom.adapter.connect();
    } catch (caught) {
      setError(connectErrorMessage(caught));
    } finally {
      setPhase("idle");
    }
  }, [select, wallets]);

  const onSignIn = useCallback(async () => {
    if (!publicKey) {
      setError("Connect a wallet before signing in.");
      return;
    }
    setError(null);
    setPhase("signing");
    try {
      const next = await signInWithWallet({
        apiUrl: apiBaseUrl(),
        walletAddress: publicKey.toBase58(),
        signMessage,
      });
      setSession(next);
    } catch (caught) {
      setError(caught instanceof AuthClientError ? caught.message : "Sign-in failed.");
    } finally {
      setPhase("idle");
    }
  }, [publicKey, signMessage]);

  const onLogout = useCallback(async () => {
    if (!session) {
      return;
    }
    setError(null);
    setPhase("logging-out");
    try {
      await logoutSession(apiBaseUrl(), session.csrfToken);
      setSession(null);
    } catch (caught) {
      setError(caught instanceof AuthClientError ? caught.message : "Logout failed.");
    } finally {
      setPhase("idle");
    }
  }, [session]);

  const onDisconnect = useCallback(async () => {
    setError(null);
    try {
      await disconnect();
    } catch (caught) {
      setError(connectErrorMessage(caught));
    }
  }, [disconnect]);

  const address = publicKey?.toBase58() ?? null;
  const busy = phase !== "idle" || connecting;
  const mismatch = session && address && session.walletAddress !== address;

  return (
    <div className="flex max-w-xs flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {address ? (
          <p className="font-mono text-xs text-muted-foreground" title={address}>
            {shortAddress(address)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{ready ? "Wallet not connected" : "Checking session"}</p>
        )}
        {address ? (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void onDisconnect()}>
            Disconnect
          </Button>
        ) : (
          <Button type="button" size="sm" disabled={busy} onClick={() => void onConnect()}>
            {phase === "connecting" || connecting ? "Connecting" : "Connect wallet"}
          </Button>
        )}
        {session ? (
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void onLogout()}>
            {phase === "logging-out" ? "Signing out" : "Log out"}
          </Button>
        ) : address ? (
          <Button type="button" size="sm" disabled={busy || !signMessage} onClick={() => void onSignIn()}>
            {phase === "signing" ? "Waiting for signature" : "Sign in"}
          </Button>
        ) : null}
      </div>
      {session ? (
        <p className="text-xs text-muted-foreground">
          Signed in as {shortAddress(session.walletAddress)}
          {session.role === "admin" ? " (admin)" : ""}
          {wallet?.adapter.name ? ` via ${wallet.adapter.name}` : ""}
          {connected ? "" : ". The wallet is disconnected. Log out ends the server session."}
        </p>
      ) : null}
      {mismatch ? (
        <p className="text-xs text-muted-foreground">The connected wallet is different from the signed-in wallet.</p>
      ) : null}
      {address && !signMessage && !session ? (
        <p className="text-xs text-muted-foreground">This wallet cannot sign in. It does not support message signing.</p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function shortAddress(value: string): string {
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
