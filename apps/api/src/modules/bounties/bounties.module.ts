import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RpcSolanaTransferGateway, SOLANA_TRANSFER_GATEWAY } from "../solana/solana-transfer.gateway";
import { BountiesController } from "./bounties.controller";
import { BountiesService } from "./bounties.service";
import { FundingService } from "./funding.service";
import { PrismaBountyRepository } from "./prisma-bounty.repository";

@Module({
  imports: [AuthModule],
  controllers: [BountiesController],
  providers: [BountiesService, FundingService, PrismaBountyRepository, { provide: SOLANA_TRANSFER_GATEWAY, useClass: RpcSolanaTransferGateway }],
})
export class BountiesModule {}
