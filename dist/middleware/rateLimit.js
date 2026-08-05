import { RateLimitedError } from '../lib/errors.js';
class InMemoryRateLimiter {
    buckets = new Map();
    check(tenantId, limitPerMinute) {
        const now = Date.now();
        let bucket = this.buckets.get(tenantId);
        if (!bucket) {
            bucket = { tokens: limitPerMinute, lastRefill: now };
            this.buckets.set(tenantId, bucket);
        }
        // Refill tokens proportionally to elapsed time
        const elapsed = now - bucket.lastRefill;
        const refill = Math.floor((elapsed / 60_000) * limitPerMinute);
        if (refill > 0) {
            bucket.tokens = Math.min(limitPerMinute, bucket.tokens + refill);
            bucket.lastRefill = now;
        }
        if (bucket.tokens <= 0)
            return false;
        bucket.tokens -= 1;
        return true;
    }
}
const defaultLimiter = new InMemoryRateLimiter();
export function checkRateLimit(tenantId, limitPerMinute, limiter = defaultLimiter) {
    if (!limiter.check(tenantId, limitPerMinute)) {
        throw new RateLimitedError(tenantId);
    }
}
export { InMemoryRateLimiter };
//# sourceMappingURL=rateLimit.js.map