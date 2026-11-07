import { APP_NAME } from "@solversbounty/shared";
import { Button } from "@/components/ui/button";
import { HealthStatus } from "./health-status";

export function HomePage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium text-muted-foreground">Custodial Devnet treasury</p>
      <h1 className="text-4xl font-semibold tracking-tight">{APP_NAME}</h1>
      <p className="max-w-xl text-lg text-muted-foreground">
        Solve problems. Earn rewards. Unlock human insights. This shell is the
        application foundation. Challenge, wallet, and payout flows are not built yet.
      </p>
      <div className="flex items-center gap-3">
        <Button type="button">Get started later</Button>
        <HealthStatus />
      </div>
    </main>
  );
}
