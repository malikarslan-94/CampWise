import { describe, it, expect } from 'vitest';
import { InMemoryRateLimiter } from '../src/middleware/rateLimit.js';
import { checkRateLimit } from '../src/middleware/rateLimit.js';
import { RateLimitedError } from '../src/lib/errors.js';

describe('InMemoryRateLimiter', () => {
  it('allows requests up to the limit', () => {
    const limiter = new InMemoryRateLimiter();
    for (let i = 0; i < 5; i++) {
      expect(limiter.check('tenant-a', 5)).toBe(true);
    }
  });

  it('rejects the N+1th request', () => {
    const limiter = new InMemoryRateLimiter();
    for (let i = 0; i < 3; i++) limiter.check('tenant-b', 3);
    expect(limiter.check('tenant-b', 3)).toBe(false);
  });

  it('independent buckets per tenant', () => {
    const limiter = new InMemoryRateLimiter();
    for (let i = 0; i < 2; i++) limiter.check('t1', 2);
    expect(limiter.check('t1', 2)).toBe(false);
    expect(limiter.check('t2', 2)).toBe(true);
  });
});

describe('checkRateLimit', () => {
  it('throws RateLimitedError when limit exceeded', () => {
    const limiter = new InMemoryRateLimiter();
    limiter.check('x', 1); // exhaust
    expect(() => checkRateLimit('x', 1, limiter)).toThrow(RateLimitedError);
  });
});
