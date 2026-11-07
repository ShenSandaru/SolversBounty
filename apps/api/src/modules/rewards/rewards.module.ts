import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SolanaModule } from "../solana/solana.module";
import { PayoutLifecycle } from "./payout-lifecycle";
import { PayoutWorker } from "./payout-worker";
import { PayoutsController } from "./payouts.controller";
import { PrismaPayoutRepository } from "./prisma-payout.repository";

@Module({
  imports: [AuthModule, SolanaModule],
  controllers: [PayoutsController],
  providers: [PrismaPayoutRepository, PayoutWorker, PayoutLifecycle],
  exports: [PayoutWorker],
})
export class RewardsModule {}
