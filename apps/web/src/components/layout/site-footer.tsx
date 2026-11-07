import { APP_NAME } from "@solversbounty/shared";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <p>
          {APP_NAME} uses a custodial Devnet treasury. Wallet addresses are pseudonymous. Solana
          transfers are public.
        </p>
        <nav className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Footer">
          <Link href="/get-started" className="text-brand-green underline-offset-4 hover:underline">
            Get started
          </Link>
          <Link href="/bounties" className="text-brand-green underline-offset-4 hover:underline">
            Browse challenges
          </Link>
        </nav>
      </div>
    </footer>
  );
}
