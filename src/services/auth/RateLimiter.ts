export type RateLimiterConfig = {
  windowMs: number;
  max: number;
};

type Window = {
  startMs: number;
  count: number;
};

export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  constructor(private readonly cfg: RateLimiterConfig) {}

  allow(key: string): { ok: true } | { ok: false; retryAfterMs: number } {
    const now = Date.now();
    const w = this.windows.get(key);
    if (!w || now - w.startMs >= this.cfg.windowMs) {
      this.windows.set(key, { startMs: now, count: 1 });
      return { ok: true };
    }
    if (w.count >= this.cfg.max) {
      const retryAfterMs = Math.max(0, this.cfg.windowMs - (now - w.startMs));
      return { ok: false, retryAfterMs };
    }
    w.count += 1;
    return { ok: true };
  }
}

