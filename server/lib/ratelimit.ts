/** Fixed-window in-memory rate limiter. Good for a single server; swap for Redis if you scale out. */
export class RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>()
  private sweeper: ReturnType<typeof setInterval>
  private now: () => number

  constructor(now: () => number = Date.now) {
    this.now = now
    this.sweeper = setInterval(() => this.sweep(), 60_000)
    this.sweeper.unref?.()
  }

  /**
   * Records one attempt against every rule. Returns seconds to wait if any rule is exceeded, otherwise null.
   * Each rule is [key, limit, windowMs].
   */
  hit(rules: [key: string, limit: number, windowMs: number][]): number | null {
    const t = this.now()
    let wait: number | null = null
    for (const [key, limit, windowMs] of rules) {
      let entry = this.hits.get(key)
      if (!entry || entry.resetAt <= t) {
        entry = { count: 0, resetAt: t + windowMs }
        this.hits.set(key, entry)
      }
      entry.count++
      if (entry.count > limit) wait = Math.max(wait ?? 0, Math.ceil((entry.resetAt - t) / 1000))
    }
    return wait
  }

  reset(key: string) {
    this.hits.delete(key)
  }

  private sweep() {
    const t = this.now()
    for (const [k, v] of this.hits) if (v.resetAt <= t) this.hits.delete(k)
  }

  dispose() {
    clearInterval(this.sweeper)
  }
}

/** Serialises async work per key (e.g. per user) so second-factor checks can't race each other. */
export function keyedMutex() {
  const tails = new Map<string, Promise<unknown>>()
  return async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
    const prev = tails.get(key) ?? Promise.resolve()
    const run = prev.then(fn, fn)
    const tail = run.catch(() => undefined)
    tails.set(key, tail)
    try {
      return await run
    } finally {
      if (tails.get(key) === tail) tails.delete(key)
    }
  }
}
