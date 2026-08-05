import { RateLimitedError } from '../lib/errors.js';

/**
 * Rate limiting.
 *
 * Phase 1 keyed a single bucket per tenant, which was sized for a handful of trusted
 * server-to-server callers. Under public chat traffic that fails in both directions:
 * 60/min is far too low for a whole country's website, and one abuser drains the
 * bucket for every real user of that tenant.
 *
 * So limits are now checked across several independent dimensions, and cost is
 * measured in tokens as well as requests — on an LLM endpoint the expensive request
 * and the cheap one look identical if you only count them.
 */

/** Swappable interface so a Redis-backed implementation can replace in-memory. */
export interface RateLimiter {
  /** Per-tenant convenience used by the tool handlers. */
  check(tenantId: string, limitPerMinute: number): boolean;
  /** Takes `cost` from a bucket of `limit`, refilling fully over `windowMs`. */
  consume(key: string, limit: number, windowMs: number, cost?: number): boolean;
  /** Remaining allowance without consuming any. */
  remaining(key: string, limit: number, windowMs: number): number;
}

export const MINUTE_MS = 60_000;
export const DAY_MS = 86_400_000;

interface Bucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Buckets are evicted once they have sat full for longer than their own window —
 * at that point they are indistinguishable from a fresh one. Without this the map
 * grows once per unique session/IP forever, which on a public endpoint is a leak.
 */
const MAX_BUCKETS = 50_000;
const SWEEP_EVERY = 1_000;

class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private opsSinceSweep = 0;

  check(tenantId: string, limitPerMinute: number): boolean {
    return this.consume(`tenant:${tenantId}:min`, limitPerMinute, MINUTE_MS);
  }

  consume(key: string, limit: number, windowMs: number, cost = 1): boolean {
    const bucket = this.refilled(key, limit, windowMs);

    if (bucket.tokens <= 0) return false;

    // A single call may cost more than is left — allow it, then block what follows.
    // The alternative is rejecting work already done upstream, which helps nobody.
    bucket.tokens = Math.max(0, bucket.tokens - cost);
    return true;
  }

  remaining(key: string, limit: number, windowMs: number): number {
    return this.refilled(key, limit, windowMs).tokens;
  }

  private refilled(key: string, limit: number, windowMs: number): Bucket {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      bucket = { tokens: limit, lastRefill: now };
      this.buckets.set(key, bucket);
      this.maybeSweep(now);
      return bucket;
    }

    const elapsed = now - bucket.lastRefill;
    const refill = Math.floor((elapsed / windowMs) * limit);
    if (refill > 0) {
      bucket.tokens = Math.min(limit, bucket.tokens + refill);
      bucket.lastRefill = now;
    }

    this.maybeSweep(now);
    return bucket;
  }

  private maybeSweep(now: number): void {
    if (++this.opsSinceSweep < SWEEP_EVERY && this.buckets.size < MAX_BUCKETS) return;
    this.opsSinceSweep = 0;

    for (const [key, bucket] of this.buckets) {
      if (now - bucket.lastRefill > DAY_MS) this.buckets.delete(key);
    }

    // Still oversized after sweeping: drop the least recently touched.
    if (this.buckets.size >= MAX_BUCKETS) {
      const excess = this.buckets.size - Math.floor(MAX_BUCKETS * 0.9);
      const oldest = [...this.buckets.entries()]
        .sort((a, b) => a[1].lastRefill - b[1].lastRefill)
        .slice(0, excess);
      for (const [key] of oldest) this.buckets.delete(key);
    }
  }
}

const defaultLimiter: RateLimiter = new InMemoryRateLimiter();

export function checkRateLimit(
  tenantId: string,
  limitPerMinute: number,
  limiter: RateLimiter = defaultLimiter,
): void {
  if (!limiter.check(tenantId, limitPerMinute)) {
    throw new RateLimitedError(tenantId, 'tenant');
  }
}

// ── Chat endpoint limits ──────────────────────────────────────────────────────

/**
 * Who a chat request is attributed to.
 *
 * `client` is the mobile app's `deviceFingerprint` when it sends one, else the IP.
 * IP alone is weak in both directions: Malaysian mobile CGNAT shares one address
 * across many real users, while an attacker rotates proxies cheaply. A per-install
 * id is a materially better key wherever it is available.
 */
export interface ChatRequestIdentity {
  sessionId: string;
  tenantId: string;
  client: string;
}

export interface ChatLimits {
  sessionPerMinute: number;
  sessionPerDay: number;
  clientPerMinute: number;
  clientPerDay: number;
  /** Model tokens a single session may spend per day — the real cost control. */
  sessionTokensPerDay: number;
}

/**
 * Provisional. Guessing these precisely before seeing real traffic is theatre;
 * they are here to be tuned once there is a week of usage to look at.
 */
export const DEFAULT_CHAT_LIMITS: ChatLimits = {
  sessionPerMinute: 10,
  sessionPerDay: 100,
  clientPerMinute: 20,
  clientPerDay: 200,
  sessionTokensPerDay: 200_000,
};

/**
 * Gate for an incoming chat message. Throws before any model call is made, so a
 * rejected request costs nothing.
 *
 * Dimensions are checked cheapest-and-most-specific first: a runaway loop in one
 * conversation is the realistic failure, not a tenant-wide flood.
 */
export function checkChatRateLimit(
  identity: ChatRequestIdentity,
  tenantPerMinute: number,
  limits: ChatLimits = DEFAULT_CHAT_LIMITS,
  limiter: RateLimiter = defaultLimiter,
): void {
  const { sessionId, tenantId, client } = identity;

  const checks: Array<[boolean, string, string]> = [
    [limiter.consume(`s:${sessionId}:min`, limits.sessionPerMinute, MINUTE_MS), sessionId, 'session-minute'],
    [limiter.consume(`s:${sessionId}:day`, limits.sessionPerDay, DAY_MS), sessionId, 'session-day'],
    [limiter.consume(`c:${client}:min`, limits.clientPerMinute, MINUTE_MS), client, 'client-minute'],
    [limiter.consume(`c:${client}:day`, limits.clientPerDay, DAY_MS), client, 'client-day'],
    [limiter.consume(`t:${tenantId}:min`, tenantPerMinute, MINUTE_MS), tenantId, 'tenant-minute'],
  ];

  for (const [ok, scope, dimension] of checks) {
    if (!ok) throw new RateLimitedError(scope, dimension);
  }

  if (limiter.remaining(tokenKey(sessionId), limits.sessionTokensPerDay, DAY_MS) <= 0) {
    throw new RateLimitedError(sessionId, 'session-tokens');
  }
}

function tokenKey(sessionId: string): string {
  return `s:${sessionId}:tokens`;
}

/**
 * Records what a model call actually cost. Called *after* the call, since usage is
 * only known then; `checkChatRateLimit` refuses up front once the budget is spent.
 */
export function recordTokenSpend(
  sessionId: string,
  tokens: number,
  limits: ChatLimits = DEFAULT_CHAT_LIMITS,
  limiter: RateLimiter = defaultLimiter,
): void {
  limiter.consume(tokenKey(sessionId), limits.sessionTokensPerDay, DAY_MS, tokens);
}

/** Remaining daily token budget for a session — for logging and headers. */
export function remainingTokenBudget(
  sessionId: string,
  limits: ChatLimits = DEFAULT_CHAT_LIMITS,
  limiter: RateLimiter = defaultLimiter,
): number {
  return limiter.remaining(tokenKey(sessionId), limits.sessionTokensPerDay, DAY_MS);
}

export { InMemoryRateLimiter };
