import { APP_NAME } from "@solversbounty/shared";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/page-container";
import { HealthStatus } from "./health-status";

export function HomePage() {
  return (
    <PageContainer>
      <section className="grid gap-10 py-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(16rem,0.7fr)] lg:py-12">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-green/30 bg-brand-green/10 px-3 py-1 text-xs font-medium tracking-[0.14em] text-brand-green uppercase">
            Custodial Devnet treasury
          </p>
          <h1 className="mt-3 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            <span className="gradient-text">Solve problems.</span> Earn rewards. Unlock human insights.
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
            {APP_NAME} is a wallet-authenticated marketplace for cognitive challenges and consented
            research. Creators fund a fixed SOL pool. Eligible solvers share the same reward.
            This preview can sign in with a wallet. It does not verify answers or move SOL.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/bounties">Browse the marketplace</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/bounties/create">Create a bounty</Link>
            </Button>
          </div>
        </div>
        <aside className="surface gradient-border relative grid gap-3 self-start overflow-hidden p-6">
          <h2 className="text-lg font-semibold">Two sides of the same study</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Creators publish a question and fund it. Solvers attempt it after research consent.
            Analytics describe observable work, not private thoughts.
          </p>
          <HealthStatus />
        </aside>
      </section>
    </PageContainer>
  );
}
