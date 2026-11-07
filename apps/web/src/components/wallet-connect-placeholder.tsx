export function WalletConnectPlaceholder() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-3 py-2">
      <p className="text-[0.68rem] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Placeholder
      </p>
      <p className="text-sm font-medium">Wallet not connected</p>
      <p className="text-xs text-muted-foreground">Connection is not available in this preview.</p>
    </div>
  );
}
