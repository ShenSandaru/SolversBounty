import type { FundingPurposeName, LedgerBuckets } from "./bounty.persistence";

export function depositReference(bountyId: string, purpose: FundingPurposeName): string {
  return `sb:deposit:${bountyId}:${purpose}`;
}

export function emptyBuckets(): LedgerBuckets {
  return { funded: 0n, reserved: 0n, paid: 0n, refundable: 0n, refunded: 0n };
}

export function bucketsFromEntries(entries: { entryType: string; amountLamports: bigint }[]): LedgerBuckets {
  const buckets = emptyBuckets();
  for (const entry of entries) {
    if (entry.entryType === "deposit") {
      buckets.funded += entry.amountLamports;
      buckets.refundable += entry.amountLamports;
    } else if (entry.entryType === "reserve") {
      buckets.reserved += entry.amountLamports;
      buckets.refundable -= entry.amountLamports;
    } else if (entry.entryType === "settle") {
      buckets.reserved -= entry.amountLamports;
      buckets.paid += entry.amountLamports;
    } else if (entry.entryType === "release") {
      buckets.reserved -= entry.amountLamports;
      buckets.refundable += entry.amountLamports;
    } else if (entry.entryType === "refund") {
      buckets.refundable -= entry.amountLamports;
      buckets.refunded += entry.amountLamports;
    }
  }
  return buckets;
}

export function bucketsBalance(buckets: LedgerBuckets): boolean {
  return buckets.funded === buckets.reserved + buckets.paid + buckets.refundable + buckets.refunded;
}
