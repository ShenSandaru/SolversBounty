import { APP_NAME } from "@solversbounty/shared";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HealthStatus } from "@/features/home/health-status";
import { HeroArt } from "./hero-art";
import { Reveal } from "./reveal";

const solverSteps = [
  {
    step: "1",
    title: "Browse open challenges",
    body: "The marketplace lists active Devnet challenges. You can read public prompts without connecting a wallet.",
  },
  {
    step: "2",
    title: "Consent, then submit",
    body: "A solving session starts only after you accept research-consent-v1. The backend checks your answer. This website does not.",
  },
  {
    step: "3",
    title: "Earn the same configured reward",
    body: "Every eligible correct solver receives the same reward, once, while the funded pool and the solver cap allow it.",
  },
] as const;

const creatorSteps = [
  {
    step: "1",
    title: "Draft a challenge",
    body: "Publish a public question and store a protected expected answer. Saving a draft does not move SOL.",
  },
  {
    step: "2",
    title: "Fund two Devnet transfers",
    body: "Send the reward pool and a separate 5% platform commission to the custodial treasury. Phantom must approve each transfer.",
  },
  {
    step: "3",
    title: "Activate and review aggregates",
    body: "Once active, solvers can join. You later see consented aggregate analytics for bounties you own, not individual solver records.",
  },
] as const;

const trustPoints = [
  "This demonstration runs on Solana Devnet, not mainnet.",
  "Rewards are native SOL transfers from a custodial Devnet treasury controlled by the backend. This is not trustless escrow and not a custom Solana program.",
  "Research participation requires explicit consent. Wallet login alone does not imply research consent.",
  "Research analytics are aggregate. Creators and administrators do not see individual solver research records or solver wallet addresses in analytics.",
  "Solvers do not pay a participation fee. Chain transfers are public. Wallet addresses are pseudonymous.",
] as const;

export function LandingPage() {
  return (
    <main>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)] lg:px-8 lg:py-24">
          <div>
            <p className="inline-flex items-center rounded-full border border-brand-green/30 bg-brand-green/10 px-3 py-1 text-xs font-medium tracking-[0.16em] text-brand-green uppercase">
              Solana Devnet demonstration
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Great ideas deserve <span className="gradient-text">great rewards.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
              {APP_NAME} connects organizations and researchers with human intelligence through funded
              cognitive challenges. Solve problems, contribute insights, and earn SOL rewards.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href="/bounties">Explore Challenges</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/get-started">Publish a Challenge</Link>
              </Button>
            </div>
            <p className="mt-4 text-sm text-muted-foreground">
              Browsing is public. Connecting a wallet is only required for authenticated actions.
            </p>
          </div>
          <div className="flex justify-center lg:justify-end">
            <HeroArt />
          </div>
        </div>
      </section>

      <Reveal>
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8" aria-labelledby="what-heading">
          <p className="gradient-text text-xs font-semibold tracking-[0.16em] uppercase">What it is</p>
          <h2 id="what-heading" className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            A marketplace for cognitive work, with consented research measurement.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            Creators fund a fixed SOL pool. Solvers attempt a predefined question. The backend verifies
            answers and pays every eligible correct solver the same configured amount. With consent, the
            platform records observable activity such as attempts and completion time. It does not read
            private thoughts.
          </p>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <FeatureCard
              title="Funded challenges"
              body="Each bounty has a public prompt, a protected expected answer, an attempt limit, and a deadline."
            />
            <FeatureCard
              title="Wallet authentication"
              body="There is no email, password, or KYC. Phantom signs a login message. That login is not research consent."
            />
            <FeatureCard
              title="Custodial Devnet treasury"
              body="Deposits and payouts are native SOL on Devnet. The backend holds the treasury key. Do not treat this as escrow."
            />
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section
          id="how-it-works"
          className="scroll-mt-24 border-y border-white/10 bg-[#18181f]/60"
          aria-labelledby="how-heading"
        >
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
            <p className="gradient-text text-xs font-semibold tracking-[0.16em] uppercase">How it works</p>
            <h2 id="how-heading" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Two journeys. One marketplace.
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
              Individual researchers and organizations use the same creator tools. Students, specialists,
              and other solvers use the same marketplace. Choose a path when you are ready.
            </p>
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              <JourneyCard
                eyebrow="For solvers"
                title="Solve, then earn"
                steps={solverSteps}
                href="/bounties"
                cta="Explore Challenges"
              />
              <JourneyCard
                eyebrow="For organizations / creators"
                title="Publish, then fund"
                steps={creatorSteps}
                href="/get-started"
                cta="Start publishing"
              />
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section id="for-solvers" className="scroll-mt-24 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <p className="gradient-text text-xs font-semibold tracking-[0.16em] uppercase">For solvers</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Test your reasoning. Keep the same reward as everyone else who is eligible.
          </h2>
          <ul className="mt-6 grid gap-3 text-base leading-7 text-muted-foreground sm:grid-cols-2">
            <li className="glass p-5">No participation fee. You do not pay to attempt a challenge.</li>
            <li className="glass p-5">One reward per wallet on a bounty, if you are eligible and the pool still has room.</li>
            <li className="glass p-5">The server decides correctness, timestamps, and payout eligibility. Ignore any client-side flags.</li>
            <li className="glass p-5">Payouts are individual SOL transfers from the custodial treasury after confirmation.</li>
          </ul>
        </section>
      </Reveal>

      <Reveal>
        <section
          id="for-organizations"
          className="scroll-mt-24 mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8"
        >
          <p className="gradient-text text-xs font-semibold tracking-[0.16em] uppercase">
            For organizations / creators
          </p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Fund a question. Reach human participants. Read aggregate insights.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            University researchers, independent creators, and organizations all use this path. There is no
            separate company account. Any signed-in wallet can draft a bounty.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <FeatureCard
              title="Protected answers"
              body="The expected answer is stored encrypted on the server. Public payloads omit it and anything that reverses into it."
            />
            <FeatureCard
              title="Two funding transfers"
              body="Reward-pool principal stays available for solvers. The 5% commission is extra and is not taken from that pool."
            />
            <FeatureCard
              title="Owner analytics only"
              body="You see aggregates for bounties you own. Administrators may see the same figures across the platform."
            />
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="border-y border-white/10 bg-[#18181f]/60" aria-labelledby="research-heading">
          <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
            <p className="gradient-text text-xs font-semibold tracking-[0.16em] uppercase">Research analytics</p>
            <h2 id="research-heading" className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Consented aggregates, not a window into private thought.
            </h2>
            <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
              After a solver accepts research-consent-v1, the platform can store whether an attempt is
              correct, how many attempts are kept, time to the first correct attempt, and how many solvers
              started a session. The MVP does not collect strategy surveys or written explanations.
            </p>
            <Button className="mt-6" variant="outline" asChild>
              <Link href="/research">View the demonstration analytics layout</Link>
            </Button>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8" aria-labelledby="solana-heading">
          <p className="gradient-text text-xs font-semibold tracking-[0.16em] uppercase">Why Solana</p>
          <h2 id="solana-heading" className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Public transfers. Native SOL. Devnet first.
          </h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground">
            Solana lets {APP_NAME} move small native SOL amounts and keep the resulting signatures as
            public evidence. Confirmed transfers advance product state in PostgreSQL. This demonstration
            does not offer mainnet, audited programs, or smart-contract escrow.
          </p>
        </section>
      </Reveal>

      <Reveal>
        <section className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8" aria-labelledby="trust-heading">
          <div className="glass gradient-border relative overflow-hidden p-6 sm:p-8">
            <h2 id="trust-heading" className="text-2xl font-semibold tracking-tight">
              Trust and transparency
            </h2>
            <ul className="mt-5 grid gap-3 text-sm leading-6 text-muted-foreground sm:grid-cols-2">
              {trustPoints.map((point) => (
                <li key={point} className="rounded-xl border border-white/10 bg-background/40 px-4 py-3">
                  {point}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              <HealthStatus />
            </div>
          </div>
        </section>
      </Reveal>

      <section className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:px-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight">Choose how you want to start.</h2>
            <p className="mt-2 max-w-xl text-muted-foreground">
              You can explore challenges now. Sign in with Phantom only when you create, fund, or start a
              solving session.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <Link href="/get-started">Get Started</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/bounties">Explore Challenges</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="glass h-full p-5 transition-colors hover:border-brand-purple/50">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
    </article>
  );
}

function JourneyCard({
  eyebrow,
  title,
  steps,
  href,
  cta,
}: {
  eyebrow: string;
  title: string;
  steps: readonly { step: string; title: string; body: string }[];
  href: string;
  cta: string;
}) {
  return (
    <article className="glass gradient-border relative flex h-full flex-col overflow-hidden p-6">
      <p className="text-xs font-semibold tracking-[0.14em] text-brand-green uppercase">{eyebrow}</p>
      <h3 className="mt-2 text-2xl font-semibold">{title}</h3>
      <ol className="mt-6 grid flex-1 gap-4">
        {steps.map((item) => (
          <li key={item.step} className="flex gap-3">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-gradient font-mono text-xs font-bold text-[#111116]">
              {item.step}
            </span>
            <span>
              <span className="block font-medium">{item.title}</span>
              <span className="mt-1 block text-sm leading-6 text-muted-foreground">{item.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <Button className="mt-8 w-fit" asChild>
        <Link href={href}>{cta}</Link>
      </Button>
    </article>
  );
}
