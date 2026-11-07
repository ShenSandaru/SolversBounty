"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "./auth-session";

import {
  AuthClientError,
  apiBaseUrl,
  completeSignedLogin,
  connectErrorMessage,
  logoutSession,
  requestNonce,
  restoreSession,
  signingFailure,
  type IssuedNonce,
} from "./auth-client";
import { phantomMessageProvider, signPreparedMessage } from "./phantom-sign";

type Phase = "idle" | "connecting" | "signing" | "logging-out";

export function WalletAuth() {
  const { connected, connecting, disconnect, publicKey, select, signMessage, wallet, wallets } = useWallet();
  const { session, setSession } = useAuthSession();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [prepared, setPrepared] = useState<IssuedNonce | null>(null);
  const [prepareAttempt, setPrepareAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    restoreSession(apiBaseUrl())
      .catch((caught: unknown) => {
        if (!(caught instanceof AuthClientError) || caught.code !== "API_UNAVAILABLE") {
          throw caught;
        }
        return restoreSession(apiBaseUrl());
      })
      .then((restored) => {
        if (active && restored) {
          setSession(restored);
          setError(null);
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

  const address = publicKey?.toBase58() ?? null;

  useEffect(() => {
    if (!ready || !address || session) {
      setPrepared(null);
      return;
    }
    let active = true;
    requestNonce(apiBaseUrl(), address)
      .then((issued) => {
        if (active) {
          setPrepared(issued);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(caught instanceof AuthClientError ? caught.message : "The sign-in message could not be prepared.");
        }
      });
    return () => {
      active = false;
    };
  }, [address, prepareAttempt, ready, session]);

  const onSignIn = useCallback(() => {
    if (!publicKey || !signMessage) {
      setError(publicKey ? "This wallet cannot sign in. It does not support message signing." : "Connect a wallet before signing in.");
      return;
    }
    if (!prepared || Date.parse(prepared.expiresAt) <= Date.now()) {
      setPrepared(null);
      setPrepareAttempt((attempt) => attempt + 1);
      setError("The sign-in message expired. Try again.");
      return;
    }
    setError(null);
    setPhase("signing");
    const walletAddress = publicKey.toBase58();
    const provider = phantomMessageProvider(window);
    void signPreparedMessage({ message: prepared.message, adapterSign: signMessage, provider })
      .then((signatureBytes) => completeSignedLogin({ apiUrl: apiBaseUrl(), walletAddress, signatureBytes }))
      .then((next) => {
        setSession(next);
        setPrepared(null);
        setError(null);
      })
      .catch((caught: unknown) => {
        const failure = caught instanceof AuthClientError ? caught : signingFailure(caught);
        setError(failure.message);
        if (failure.code === "NONCE_EXPIRED" || failure.code === "AUTH_REJECTED") {
          setPrepared(null);
          setPrepareAttempt((attempt) => attempt + 1);
        }
      })
      .finally(() => {
        setPhase("idle");
      });
  }, [prepared, publicKey, setSession, signMessage]);

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
  }, [session, setSession]);

  const onDisconnect = useCallback(async () => {
    setError(null);
    try {
      await disconnect();
    } catch (caught) {
      setError(connectErrorMessage(caught));
    }
  }, [disconnect]);

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
          <Button type="button" size="sm" disabled={busy || !signMessage || !prepared} onClick={onSignIn}>
            {phase === "signing" ? "Waiting for signature" : prepared ? "Sign in" : "Preparing sign-in"}
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
