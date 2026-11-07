import { Module } from "@nestjs/common";
import { RpcSolanaTransferGateway, SOLANA_TRANSFER_GATEWAY } from "./solana-transfer.gateway";

@Module({
  providers: [{ provide: SOLANA_TRANSFER_GATEWAY, useClass: RpcSolanaTransferGateway }],
  exports: [SOLANA_TRANSFER_GATEWAY],
})
export class SolanaModule {}
