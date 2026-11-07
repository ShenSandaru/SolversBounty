"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { WalletAuth } from "@/features/auth/wallet-auth";
import { readOnboardingJourney } from "@/features/marketing/journey-preference";
import { Brand } from "./brand";
import { isNavActive, navItems, pageContext } from "./navigation";
import { SiteFooter } from "./site-footer";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [openOnPath, setOpenOnPath] = useState<string | null>(null);
  const menuOpen = openOnPath === pathname;
  const menuId = useId();
  const context = pageContext(pathname);
  const journey = useSyncExternalStore(subscribeJourney, readOnboardingJourney, () => null);

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
    <div className="min-h-full lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-card/80 px-4 py-6 backdrop-blur lg:flex">
        <Brand className="mb-8" />
        {journey ? (
          <p className="mb-4 px-3 text-xs text-muted-foreground">
            {journey === "creator" ? "Creator tools" : "Solver journey"}
          </p>
        ) : null}
        <Navigation pathname={pathname} />
      </aside>
      <div className="flex min-h-full min-w-0 flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium transition-colors hover:border-brand-purple/70 lg:hidden"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={() => setOpenOnPath(menuOpen ? null : pathname)}
              >
                Menu
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{context.section}</p>
                <p className="hidden truncate text-xs text-muted-foreground sm:block">{context.detail}</p>
              </div>
            </div>
            <WalletAuth />
          </div>
        </header>
        {menuOpen ? (
          <div className="fixed inset-0 z-30 lg:hidden" id={menuId}>
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              aria-label="Close menu"
              onClick={() => setOpenOnPath(null)}
            />
            <div className="relative flex h-full w-72 flex-col bg-card px-4 py-6 shadow-xl" role="dialog" aria-modal="true" aria-label="Navigation">
              <Brand className="mb-8" />
              {journey ? (
                <p className="mb-4 px-3 text-xs text-muted-foreground">
                  {journey === "creator" ? "Creator tools" : "Solver journey"}
                </p>
              ) : null}
              <Navigation pathname={pathname} />
            </div>
          </div>
        ) : null}
        <div className="flex flex-1 flex-col">
          <div className="flex-1">{children}</div>
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}

function subscribeJourney(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function Navigation({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Primary" className="flex flex-col gap-1">
      {navItems.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg border-l-2 px-3 py-2 text-sm whitespace-nowrap transition-colors ${
              active
                ? "border-brand-green bg-brand-purple/15 font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
