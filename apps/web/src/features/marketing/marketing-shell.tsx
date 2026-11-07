"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Brand } from "@/components/layout/brand";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { useWalletAuth } from "@/features/auth/use-wallet-auth";
import { MarketingAccountMenu, MarketingSignIn } from "./marketing-account";
import { marketingNav } from "./marketing-nav";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const auth = useWalletAuth();
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const menuOpen = openOnPath === pathname;
  const menuId = useId();
  const signedIn = Boolean(auth.session);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenOnPath(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-background/80 backdrop-blur-md">
        <div className="mx-auto grid h-16 w-full max-w-6xl grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-4 sm:px-6 lg:gap-3 lg:px-8">
          <Brand className="shrink-0" subtitle="" />
          <nav aria-label="Marketing" className="hidden min-w-0 items-center justify-center lg:flex">
            {marketingNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg px-2 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground xl:px-3"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex min-w-0 items-center justify-end gap-2">
            <div className="hidden items-center gap-2 lg:flex">
              {signedIn ? (
                <MarketingAccountMenu auth={auth} layout="header" />
              ) : (
                <>
                  <Button size="sm" asChild>
                    <Link href="/get-started">Get Started</Link>
                  </Button>
                  <MarketingSignIn auth={auth} />
                </>
              )}
            </div>
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:border-brand-purple/70 lg:hidden"
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setOpenOnPath(menuOpen ? null : pathname)}
            >
              <span className="flex flex-col gap-1" aria-hidden="true">
                <span className="block h-0.5 w-4 bg-current" />
                <span className="block h-0.5 w-4 bg-current" />
                <span className="block h-0.5 w-4 bg-current" />
              </span>
            </button>
          </div>
        </div>
      </header>
      {menuOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden" id={menuId}>
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Close menu"
            onClick={() => setOpenOnPath(null)}
          />
          <div
            className="relative flex h-full w-[min(100%,20rem)] flex-col gap-6 overflow-y-auto bg-[#18181f] px-4 py-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Marketing navigation"
          >
            <Brand />
            <nav aria-label="Marketing" className="flex flex-col gap-1">
              {marketingNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
                  onClick={() => setOpenOnPath(null)}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {signedIn ? (
              <MarketingAccountMenu auth={auth} layout="drawer" />
            ) : (
              <div className="grid gap-3 border-t border-border pt-4">
                <Button asChild>
                  <Link href="/get-started" onClick={() => setOpenOnPath(null)}>
                    Get Started
                  </Link>
                </Button>
                <MarketingSignIn auth={auth} layout="drawer" />
              </div>
            )}
          </div>
        </div>
      ) : null}
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}
