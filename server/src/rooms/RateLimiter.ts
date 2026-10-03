/**
 * Sliding-window rate limiter: allows at most `max` actions per `windowMs` for each key.
 * We remember the time of each person's recent actions and forget the ones older than the window.
 * It lives in memory (one per room), which is enough for a single server. With several servers
 * (Redis scaling step) the counters would move into Redis.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>(); // key -> times (ms) of recent actions

  constructor(
    private readonly max: number,
    private readonly windowMs: number
  ) {}

  /** Returns true and records the action if allowed; returns false if the key is over its limit. */
  tryConsume(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Forget a person (they left the room), so the map doesn't grow forever. */
  forget(key: string): void {
    this.hits.delete(key);
  }
}
