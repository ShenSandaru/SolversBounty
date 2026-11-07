"use client";

import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
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

export { shortAddress } from "./short-address";

type Phase = "idle" | "connecting" | "signing" | "logging-out";

export function useWalletAuth() {
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
  const mismatch = Boolean(session && address && session.walletAddress !== address);

  return {
    session,
    address,
    connected,
    connecting,
    wallet,
    ready,
    phase,
    busy,
    error,
    prepared,
    mismatch,
    signMessage,
    onConnect,
    onSignIn,
    onDisconnect,
    onLogout,
  };
}
