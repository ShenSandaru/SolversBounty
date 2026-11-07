import { Test } from "@nestjs/testing";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AntiAbuseModule } from "./anti-abuse/anti-abuse.module";
import { InMemoryRateLimit } from "./anti-abuse/in-memory-rate-limit";
import { AuditModule } from "./audit/audit.module";
import { AuthModule } from "./auth/auth.module";
import { BountiesModule } from "./bounties/bounties.module";
import { RewardsModule } from "./rewards/rewards.module";
import { SolanaModule } from "./solana/solana.module";
import { SubmissionsModule } from "./submissions/submissions.module";
import { UsersModule } from "./users/users.module";
import { VerificationModule } from "./verification/verification.module";

const modules = [
  AuthModule,
  UsersModule,
  BountiesModule,
  SubmissionsModule,
  VerificationModule,
  RewardsModule,
  AnalyticsModule,
  SolanaModule,
  AuditModule,
];

describe("domain module boundaries", () => {
  it.each(modules)("initializes %p without another domain module", async (moduleType) => {
    const compiled = await Test.createTestingModule({ imports: [moduleType] }).compile();
    await compiled.close();
  });

  it("provides the in-memory rate limit from anti-abuse", async () => {
    const compiled = await Test.createTestingModule({ imports: [AntiAbuseModule] }).compile();
    expect(compiled.get(InMemoryRateLimit)).toBeInstanceOf(InMemoryRateLimit);
    await compiled.close();
  });
});
