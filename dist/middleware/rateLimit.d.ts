/** Swappable interface so Redis-backed implementation can replace in-memory. */
export interface RateLimiter {
    check(tenantId: string, limitPerMinute: number): boolean;
}
declare class InMemoryRateLimiter implements RateLimiter {
    private readonly buckets;
    check(tenantId: string, limitPerMinute: number): boolean;
}
export declare function checkRateLimit(tenantId: string, limitPerMinute: number, limiter?: RateLimiter): void;
export { InMemoryRateLimiter };
//# sourceMappingURL=rateLimit.d.ts.map