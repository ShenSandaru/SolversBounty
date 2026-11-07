import { Inject, Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { canonicalWalletAddress, WalletAddressError } from "../solana/verify-wallet-signature";
import { isDevnetRpc, SOLANA_TRANSFER_GATEWAY, type SolanaTransferGateway } from "../solana/solana-transfer.gateway";
import { BountyFlowError } from "./bounty.errors";
import type { BountyDb, FundingPurposeName, FundingSnapshot, LedgerBuckets, StoredObligation } from "./bounty.persistence";
import { bucketsBalance } from "./funding-ledger";
import { commissionLamports } from "./bounties.service";
import { PrismaBountyRepository } from "./prisma-bounty.repository";
import type { ObservedTransfer } from "./observed-transfer";
import { principalLamports } from "@solversbounty/shared";

const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;

export type FundingView = {
  bountyId: string;
  status: "draft" | "funding_pending" | "active" | "closed";
  treasuryAddress: string;
  network: "devnet";
  custody: "custodial";
  rewardLamports: string;
  maxRewardedSolvers: number;
  rewardPoolLamports: string;
  commissionLamports: string;
  totalFundingLamports: string;
  obligations: {
    purpose: FundingPurposeName;
    expectedLamports: string;
    observedLamports: string | null;
    depositReference: string;
    status: StoredObligation["status"];
    signature: string | null;
    commitment: string | null;
  }[];
  buckets: Record<keyof LedgerBuckets, string>;
  canActivate: boolean;
};

@Injectable()
export class FundingService {
  constructor(
    @Optional() @Inject(PrismaBountyRepository) private readonly store?: BountyDb,
    @Optional() @Inject(SOLANA_TRANSFER_GATEWAY) private readonly gateway?: SolanaTransferGateway,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async requirements(creatorId: string, bountyId: string): Promise<FundingView> {
    const snapshot = await this.prepare(creatorId, bountyId);
    return this.view(snapshot);
  }

  async submit(creatorId: string, walletAddress: string, bountyId: string, purpose: FundingPurposeName, signature: string): Promise<FundingView> {
    if (!SIGNATURE.test(signature)) {
      throw new BountyFlowError(400, "VALIDATION_ERROR", "Enter the Solana transaction signature.");
    }
    const treasury = this.treasury();
    const snapshot = await this.prepare(creatorId, bountyId);
    const obligation = snapshot.obligations.find((item) => item.purpose === purpose);
    if (!obligation || obligation.expectedLamports <= 0n) {
      throw new BountyFlowError(400, "VALIDATION_ERROR", "The funding amount must be a positive number of lamports.");
    }
    if (obligation.status === "confirmed" && obligation.signature === signature) {
      return this.view(snapshot);
    }
    if (obligation.status === "confirmed") {
      throw new BountyFlowError(409, "CONFLICT", "That obligation is already confirmed.");
    }
    const known = await this.db().findSignature(signature);
    if (known && (known.bountyId !== bountyId || known.purpose !== purpose)) {
      throw new BountyFlowError(409, "CONFLICT", "That transaction already funds another obligation.");
    }
    if (known && obligation.status === "rejected") {
      throw new BountyFlowError(409, "CONFLICT", "That transaction failed and cannot be reused.");
    }
    const lookup = await this.transfers().lookup(signature);
    if (lookup.outcome === "unavailable") {
      throw new BountyFlowError(503, "NOT_READY", "The Solana RPC did not answer. Submit this same signature again. It was not marked failed.");
    }
    if (lookup.outcome === "not_found" || lookup.transfer.commitment === "processed") {
      throw new BountyFlowError(409, "CONFLICT", "The transaction is not confirmed yet. Submit this same signature again.");
    }
    if (lookup.transfer.cluster !== "devnet") {
      throw new BountyFlowError(409, "CONFLICT", "The transaction is not on Solana Devnet.");
    }
    if (lookup.transfer.failed) {
      await this.db().applyFunding({
        bountyId,
        creatorId,
        purpose,
        signature,
        sourceAddress: lookup.transfer.feePayer,
        destinationAddress: treasury,
        amountLamports: obligation.expectedLamports,
        commitment: lookup.transfer.commitment === "finalized" ? "finalized" : "confirmed",
        rejected: true,
        now: this.now(),
      });
      throw new BountyFlowError(409, "CONFLICT", "The transaction failed on Solana Devnet.");
    }
    const matched = matchObligation(lookup.transfer, walletAddress, treasury, obligation.expectedLamports, obligation.depositReference);
    if (!matched) {
      throw new BountyFlowError(409, "CONFLICT", "The transaction sender, treasury destination, amount, or deposit reference does not match this obligation.");
    }
    const applied = await this.db().applyFunding({
      bountyId,
      creatorId,
      purpose,
      signature,
      sourceAddress: matched.source,
      destinationAddress: matched.destination,
      amountLamports: matched.lamports,
      commitment: lookup.transfer.commitment === "finalized" ? "finalized" : "confirmed",
      rejected: false,
      now: this.now(),
    });
    if (applied.kind === "missing") {
      throw new BountyFlowError(404, "NOT_FOUND", "Bounty not found.");
    }
    if (applied.kind === "signature_in_use") {
      throw new BountyFlowError(409, "CONFLICT", "That transaction already funds another obligation.");
    }
    if (applied.kind === "already_confirmed") {
      throw new BountyFlowError(409, "CONFLICT", "That obligation is already confirmed.");
    }
    return this.view(applied.snapshot);
  }

  private async prepare(creatorId: string, bountyId: string): Promise<FundingSnapshot> {
    this.treasury();
    const owned = await this.db().findOwned(bountyId, creatorId);
    if (!owned) {
      throw new BountyFlowError(404, "NOT_FOUND", "Bounty not found.");
    }
    const pool = principalLamports(owned.rewardLamports, owned.maxRewardedSolvers);
    const commission = commissionLamports(pool);
    if (pool <= 0n || commission <= 0n) {
      throw new BountyFlowError(400, "VALIDATION_ERROR", "The reward pool and the 5% commission must both be positive lamport amounts.");
    }
    const snapshot = await this.db().ensureFunding(bountyId, creatorId, { reward_pool: pool, commission }, this.now());
    if (snapshot === "missing") {
      throw new BountyFlowError(404, "NOT_FOUND", "Bounty not found.");
    }
    if (snapshot === "closed") {
      throw new BountyFlowError(409, "CONFLICT", "A closed bounty cannot be funded.");
    }
    if (!bucketsBalance(snapshot.buckets)) {
      throw new BountyFlowError(500, "INTERNAL", "Internal server error");
    }
    return snapshot;
  }

  private view(snapshot: FundingSnapshot): FundingView {
    const pool = snapshot.obligations.find((item) => item.purpose === "reward_pool");
    const commission = snapshot.obligations.find((item) => item.purpose === "commission");
    if (!pool || !commission) {
      throw new BountyFlowError(500, "INTERNAL", "Internal server error");
    }
    return {
      bountyId: snapshot.bounty.id,
      status: snapshot.bounty.status,
      treasuryAddress: this.treasury(),
      network: "devnet",
      custody: "custodial",
      rewardLamports: snapshot.bounty.rewardLamports.toString(),
      maxRewardedSolvers: snapshot.bounty.maxRewardedSolvers,
      rewardPoolLamports: pool.expectedLamports.toString(),
      commissionLamports: commission.expectedLamports.toString(),
      totalFundingLamports: (pool.expectedLamports + commission.expectedLamports).toString(),
      obligations: snapshot.obligations.map((item) => ({
        purpose: item.purpose,
        expectedLamports: item.expectedLamports.toString(),
        observedLamports: item.observedLamports === null ? null : item.observedLamports.toString(),
        depositReference: item.depositReference,
        status: item.status,
        signature: item.signature,
        commitment: item.commitment,
      })),
      buckets: {
        funded: snapshot.buckets.funded.toString(),
        reserved: snapshot.buckets.reserved.toString(),
        paid: snapshot.buckets.paid.toString(),
        refundable: snapshot.buckets.refundable.toString(),
        refunded: snapshot.buckets.refunded.toString(),
      },
      canActivate: pool.status === "confirmed" && commission.status === "confirmed" && snapshot.bounty.status !== "active" && snapshot.bounty.status !== "closed",
    };
  }

  private treasury(): string {
    const configured = this.config?.get<string>("solana.treasuryPublicKey");
    const rpcUrl = this.config?.get<string>("solana.rpcUrl") ?? "";
    if (!configured || !isDevnetRpc(rpcUrl)) {
      throw new BountyFlowError(503, "NOT_READY", "Devnet treasury funding is not configured.");
    }
    try {
      return canonicalWalletAddress(configured);
    } catch (error) {
      if (error instanceof WalletAddressError) {
        throw new BountyFlowError(503, "NOT_READY", "Devnet treasury funding is not configured.");
      }
      throw error;
    }
  }

  private db(): BountyDb {
    if (!this.store) {
      throw new BountyFlowError(503, "NOT_READY", "Bounty storage is not ready.");
    }
    return this.store;
  }

  private transfers(): SolanaTransferGateway {
    if (!this.gateway) {
      throw new BountyFlowError(503, "NOT_READY", "Solana RPC is not ready.");
    }
    return this.gateway;
  }

  protected now(): Date {
    return new Date();
  }
}

function matchObligation(transfer: ObservedTransfer, wallet: string, treasury: string, expected: bigint, reference: string): { source: string; destination: string; lamports: bigint } | null {
  if (transfer.memo !== reference || transfer.feePayer !== wallet) {
    return null;
  }
  const matches = transfer.transfers.filter((item) => item.source === wallet && item.destination === treasury && item.lamports === expected);
  return matches.length === 1 ? matches[0] ?? null : null;
}
