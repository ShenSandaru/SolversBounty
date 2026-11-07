"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { writeOnboardingJourney, type OnboardingJourney } from "./journey-preference";

export function GetStartedPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <p className="gradient-text text-xs font-semibold tracking-[0.16em] uppercase">Guided onboarding</p>
      <h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
        What brings you to SolversBounty?
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-muted-foreground">
        Choose a starting path. You can still use every public screen afterwards. Wallet sign-in is
        required only when you create, fund, or start a solving session.
      </p>
      <div className="mt-12 grid gap-6 lg:grid-cols-2">
        <JourneyOption
          journey="solver"
          eyebrow="Solver"
          title="I want to solve challenges"
          description="Discover intellectual challenges, test your reasoning, contribute to human intelligence research, and earn SOL rewards."
          href="/bounties"
          cta="Explore Marketplace"
        />
        <JourneyOption
          journey="creator"
          eyebrow="Organization / Creator"
          title="I want to publish challenges"
          description="Create funded cognitive challenges, reach human participants, and collect consented aggregate research insights."
          href="/bounties/create?from=onboarding"
          cta="Explore Creator Tools"
        />
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Individual researchers can publish. There is no separate company registration.
      </p>
    </main>
  );
}

function JourneyOption({
  journey,
  eyebrow,
  title,
  description,
  href,
  cta,
}: {
  journey: OnboardingJourney;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  const accent = journey === "solver" ? "hover:border-brand-green/50" : "hover:border-brand-purple/50";
  return (
    <article className={`glass gradient-border relative flex h-full flex-col overflow-hidden p-8 transition-colors ${accent}`}>
      <p className="text-xs font-semibold tracking-[0.14em] text-brand-green uppercase">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <p className="mt-4 flex-1 text-base leading-7 text-muted-foreground">{description}</p>
      <Button className="mt-8 w-fit" size="lg" asChild>
        <Link href={href} onClick={() => writeOnboardingJourney(journey)}>
          {cta}
        </Link>
      </Button>
    </article>
  );
}
