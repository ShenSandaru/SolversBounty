export class InMemoryRateLimit {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  allow(key: string, limit: number, windowMs: number): boolean {
    const current = this.now();
    const recent = (this.hits.get(key) ?? []).filter((time) => current - time < windowMs);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(current);
    this.hits.set(key, recent);
    return true;
  }
}
