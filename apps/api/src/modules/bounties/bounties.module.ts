import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SolanaModule } from "../solana/solana.module";
import { BountiesController } from "./bounties.controller";
import { BountiesService } from "./bounties.service";
import { FundingService } from "./funding.service";
import { PrismaBountyRepository } from "./prisma-bounty.repository";

@Module({
  imports: [AuthModule, SolanaModule],
  controllers: [BountiesController],
  providers: [BountiesService, FundingService, PrismaBountyRepository],
  exports: [PrismaBountyRepository],
})
export class BountiesModule {}
