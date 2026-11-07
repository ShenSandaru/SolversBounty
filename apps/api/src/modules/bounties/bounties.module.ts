import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BountiesController } from "./bounties.controller";
import { BountiesService } from "./bounties.service";
import { PrismaBountyRepository } from "./prisma-bounty.repository";

@Module({
  imports: [AuthModule],
  controllers: [BountiesController],
  providers: [BountiesService, PrismaBountyRepository],
})
export class BountiesModule {}
