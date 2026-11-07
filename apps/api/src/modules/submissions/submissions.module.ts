import { Module } from "@nestjs/common";
import { AntiAbuseModule } from "../anti-abuse/anti-abuse.module";
import { AuthModule } from "../auth/auth.module";
import { BountiesModule } from "../bounties/bounties.module";
import { SubmissionsController } from "./submissions.controller";
import { SubmissionsService } from "./submissions.service";

@Module({
  imports: [AuthModule, AntiAbuseModule, BountiesModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
