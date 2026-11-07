"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { shortAddress, useWalletAuth } from "@/features/auth/use-wallet-auth";

type WalletAuthState = ReturnType<typeof useWalletAuth>;

export function MarketingSignIn({
  auth,
  layout = "header",
}: {
  auth: WalletAuthState;
  layout?: "header" | "drawer";
}) {
  const { address, busy, connecting, phase, prepared, signMessage, onConnect, onSignIn, error } = auth;
  const label = !address
    ? phase === "connecting" || connecting
      ? "Connecting"
      : "Sign In"
    : phase === "signing"
      ? "Waiting for signature"
      : prepared
        ? "Sign In"
        : "Preparing sign-in";

  return (
    <div className={layout === "drawer" ? "grid gap-2" : "relative"}>
      <Button
        type="button"
        size={layout === "drawer" ? "default" : "sm"}
        variant="outline"
        className={layout === "drawer" ? "w-full" : undefined}
        disabled={busy || Boolean(address && (!signMessage || !prepared))}
        onClick={() => {
          if (address) {
            onSignIn();
            return;
          }
          void onConnect();
        }}
      >
        {label}
      </Button>
      {error ? (
        <p
          className={
            layout === "drawer"
              ? "text-xs text-destructive"
              : "absolute right-0 z-50 mt-2 w-56 rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-xs text-destructive"
          }
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function MarketingAccountMenu({
  auth,
  layout,
}: {
  auth: WalletAuthState;
  layout: "header" | "drawer";
}) {
  const { session, address, connected, wallet, busy, phase, mismatch, error, onDisconnect, onLogout } = auth;
  const [open, setOpen] = useState(layout === "drawer");
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const displayAddress = session?.walletAddress ?? address;

  useEffect(() => {
    if (!open || layout === "drawer") {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [layout, open]);

  if (!session) {
    return null;
  }

  const panel = (
    <div className={layout === "header" ? "w-64 p-3" : "grid gap-3 p-3"} role="menu" aria-label="Account">
      <p className="text-xs leading-5 text-muted-foreground">
        Signed in as {shortAddress(session.walletAddress)}
        {session.role === "admin" ? " (admin)" : ""}
        {wallet?.adapter.name ? ` via ${wallet.adapter.name}` : ""}
        {connected ? "" : ". The wallet is disconnected. Log out ends the server session."}
      </p>
      {mismatch ? (
        <p className="text-xs text-muted-foreground">The connected wallet is different from the signed-in wallet.</p>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        {address ? (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void onDisconnect()}>
            Disconnect
          </Button>
        ) : null}
        <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={() => void onLogout()}>
          {phase === "logging-out" ? "Signing out" : "Log out"}
        </Button>
      </div>
    </div>
  );

  if (layout === "drawer") {
    return (
      <div className="grid gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2 px-1">
          <span
            className={`size-2 rounded-full ${connected ? "bg-brand-green" : "bg-warning"}`}
            aria-hidden="true"
          />
          <span className="font-mono text-sm">{shortAddress(session.walletAddress)}</span>
          <span className="text-xs text-muted-foreground">{connected ? "Connected" : "Disconnected"}</span>
        </div>
        <div className="rounded-xl border border-border bg-card">{panel}</div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex h-9 max-w-[11rem] items-center gap-2 rounded-full border border-border bg-card px-3 text-sm transition-colors hover:border-brand-purple/70"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        aria-label={`Account ${displayAddress ? shortAddress(displayAddress) : ""}`.trim()}
        onClick={() => setOpen((current) => !current)}
      >
        <span
          className={`size-2 shrink-0 rounded-full ${connected ? "bg-brand-green" : "bg-warning"}`}
          aria-hidden="true"
        />
        <span className="font-mono text-xs">{displayAddress ? shortAddress(displayAddress) : "Account"}</span>
        <span className="sr-only">{connected ? "Wallet connected" : "Wallet disconnected"}</span>
        <span className="text-[10px] text-muted-foreground" aria-hidden="true">
          {open ? "▴" : "▾"}
        </span>
      </button>
      {open ? (
        <div id={menuId} className="absolute right-0 z-50 mt-2 rounded-xl border border-border bg-[#18181f] shadow-xl">
          {panel}
        </div>
      ) : null}
    </div>
  );
}
