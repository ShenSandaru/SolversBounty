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
        <p>
          <Link href="/bounties" className="underline-offset-4 hover:underline">
            Browse challenges
          </Link>
        </p>
      </div>
    </footer>
  );
}
