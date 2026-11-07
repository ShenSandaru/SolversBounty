import { Module } from "@nestjs/common";
import { AntiAbuseModule } from "../anti-abuse/anti-abuse.module";
import { AuthModule } from "../auth/auth.module";
import { BountiesModule } from "../bounties/bounties.module";
import { RewardsModule } from "../rewards/rewards.module";
import { SubmissionsController } from "./submissions.controller";
import { SubmissionsService } from "./submissions.service";

@Module({
  imports: [AuthModule, AntiAbuseModule, BountiesModule, RewardsModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
