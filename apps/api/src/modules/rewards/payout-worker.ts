import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { ObservedTransfer } from "../bounties/observed-transfer";
import { SOLANA_TRANSFER_GATEWAY, type SolanaTransferGateway } from "../solana/solana-transfer.gateway";
import { payoutMemo, signPayoutTransfer } from "../solana/treasury-signer";
import type { PayoutSnapshot, PayoutStore } from "./payout.persistence";
import { PrismaPayoutRepository } from "./prisma-payout.repository";

const TICK_MS = 15_000;
const BATCH = 10;
const EXPIRY_MS = 180_000;

@Injectable()
export class PayoutWorker {
  private readonly logger = new Logger(PayoutWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    @Optional() @Inject(PrismaPayoutRepository) private readonly store?: PayoutStore,
    @Optional() @Inject(SOLANA_TRANSFER_GATEWAY) private readonly gateway?: SolanaTransferGateway,
    @Optional() private readonly config?: ConfigService,
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }
    this.timer = setInterval(() => {
      void this.nudge();
    }, TICK_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  nudge(): Promise<void> {
    if (!this.store || !this.gateway || this.running) {
      return Promise.resolve();
    }
    this.running = true;
    return this.store
      .listActionable(BATCH)
      .then(async (ids) => {
        for (const id of ids) {
          await this.advance(id);
        }
      })
      .catch(() => {
        this.logger.warn("Payout processing skipped.");
      })
      .finally(() => {
        this.running = false;
      });
  }

  private async advance(id: string): Promise<void> {
    const store = this.store;
    const gateway = this.gateway;
    if (!store || !gateway) {
      return;
    }
    const payout = await store.read(id);
    if (!payout || payout.status === "confirmed" || payout.status === "failed") {
      return;
    }
    const open = payout.signatures.find((item) => item.commitment === "submitted");
    if (open) {
      await this.reconcile(payout, open.signature, open.createdAt);
      return;
    }
    if (payout.status !== "pending" && payout.status !== "retryable") {
      return;
    }
    if (payout.reservedLamports !== payout.amountLamports || payout.settled) {
      await store.note(id, "The reserved balance does not match the allocation.");
      return;
    }
    const secret = this.config?.get<string>("secrets.treasurySecretKey") ?? null;
    if (!secret) {
      await store.note(id, "Treasury signing is not ready.");
      return;
    }
    const blockhash = await gateway.recentBlockhash();
    if (!blockhash) {
      await store.note(id, "Devnet RPC is not ready.");
      return;
    }
    const signed = await signPayoutTransfer({
      secret,
      destination: payout.solverWallet,
      lamports: payout.amountLamports,
      memo: payoutMemo(payout.id),
      recentBlockhash: blockhash,
      expectedTreasury: this.config?.get<string>("solana.treasuryPublicKey") ?? null,
    });
    if (!signed) {
      await store.note(id, "The payout could not be signed.");
      return;
    }
    const recorded = await store.recordSend({
      id: payout.id,
      signature: signed.signature,
      source: signed.treasury,
      destination: payout.solverWallet,
      amountLamports: payout.amountLamports,
      now: new Date(),
    });
    if (recorded !== "recorded") {
      return;
    }
    await gateway.submit(signed.serialized);
  }

  private async reconcile(payout: PayoutSnapshot, signature: string, createdAt: Date): Promise<void> {
    const store = this.store;
    const gateway = this.gateway;
    if (!store || !gateway) {
      return;
    }
    const lookup = await gateway.lookup(signature);
    if (lookup.outcome === "unavailable") {
      return;
    }
    if (lookup.outcome === "not_found") {
      if (Date.now() - createdAt.getTime() >= EXPIRY_MS) {
        await store.noteRetryable(payout.id, signature, "expired");
      }
      return;
    }
    const transfer = lookup.transfer;
    if (transfer.commitment === "processed") {
      return;
    }
    if (transfer.failed) {
      await store.noteRetryable(payout.id, signature, "failed");
      return;
    }
    const treasury = this.config?.get<string>("solana.treasuryPublicKey") ?? transfer.feePayer;
    if (!matchesPayout(transfer, payout, treasury)) {
      await store.note(payout.id, "The confirmed transfer does not match this payout.");
      return;
    }
    await store.settle({ id: payout.id, signature, commitment: transfer.commitment, now: new Date() });
  }
}

function matchesPayout(transfer: ObservedTransfer, payout: PayoutSnapshot, treasury: string): boolean {
  if (transfer.cluster !== "devnet" || transfer.feePayer !== treasury || transfer.memo !== payoutMemo(payout.id)) {
    return false;
  }
  return transfer.transfers.length === 1 && transfer.transfers[0]?.source === treasury && transfer.transfers[0]?.destination === payout.solverWallet && transfer.transfers[0]?.lamports === payout.amountLamports;
}
