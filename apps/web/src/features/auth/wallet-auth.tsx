"use client";

import { Button } from "@/components/ui/button";
import { shortAddress, useWalletAuth } from "./use-wallet-auth";

export function WalletAuth() {
  const {
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
  } = useWalletAuth();

  return (
    <div className="flex max-w-[11rem] shrink-0 flex-col items-end gap-2 sm:max-w-xs">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {address ? (
          <p className="font-mono text-xs text-muted-foreground" title={address}>
            {shortAddress(address)}
          </p>
        ) : (
          <p className="hidden text-xs text-muted-foreground sm:block">{ready ? "Wallet not connected" : "Checking session"}</p>
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
