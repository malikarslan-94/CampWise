import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  InMemoryRateLimiter,
  checkChatRateLimit,
  recordTokenSpend,
  remainingTokenBudget,
  DEFAULT_CHAT_LIMITS,
  MINUTE_MS,
  DAY_MS,
  type ChatLimits,
} from '../src/middleware/rateLimit.js';
import { RateLimitedError } from '../src/lib/errors.js';

/**
 * The failure Phase 1's limiter allowed: one bucket per tenant meant a single
 * abusive caller drained the allowance for every real user of that tenant. These
 * tests pin the fix — dimensions are independent, and cost is measured in tokens as
 * well as requests.
 */

let limiter: InMemoryRateLimiter;

const identity = (over: Partial<{ sessionId: string; tenantId: string; client: string }> = {}) => ({
  sessionId: 'sess-1',
  tenantId: 'web-yoowifi-my',
  client: '203.0.113.1',
  ...over,
});

const limits: ChatLimits = {
  sessionPerMinute: 3,
  sessionPerDay: 10,
  clientPerMinute: 5,
  clientPerDay: 20,
  sessionTokensPerDay: 1_000,
};

beforeEach(() => {
  limiter = new InMemoryRateLimiter();
});

describe('one abuser cannot starve a tenant', () => {
  it('an exhausted session does not consume another session’s allowance', () => {
    // Burn through session A's per-minute allowance.
    for (let i = 0; i < limits.sessionPerMinute; i++) {
      checkChatRateLimit(identity({ sessionId: 'a' }), 1000, limits, limiter);
    }
    expect(() => checkChatRateLimit(identity({ sessionId: 'a' }), 1000, limits, limiter)).toThrow(
      RateLimitedError,
    );

    // A different session, different client, is untouched.
    expect(() =>
      checkChatRateLimit(identity({ sessionId: 'b', client: '203.0.113.2' }), 1000, limits, limiter),
    ).not.toThrow();
  });

  it('still enforces the tenant ceiling when many sessions pile on', () => {
    const tenantPerMinute = 2;
    checkChatRateLimit(identity({ sessionId: 'a', client: 'c1' }), tenantPerMinute, limits, limiter);
    checkChatRateLimit(identity({ sessionId: 'b', client: 'c2' }), tenantPerMinute, limits, limiter);

    expect(() =>
      checkChatRateLimit(identity({ sessionId: 'c', client: 'c3' }), tenantPerMinute, limits, limiter),
    ).toThrow(/tenant-minute/);
  });
});

describe('dimensions are reported so logs can tell them apart', () => {
  it('names the session-minute dimension', () => {
    for (let i = 0; i < limits.sessionPerMinute; i++) {
      checkChatRateLimit(identity(), 1000, limits, limiter);
    }
    try {
      checkChatRateLimit(identity(), 1000, limits, limiter);
      expect.unreachable();
    } catch (err) {
      expect((err as RateLimitedError).dimension).toBe('session-minute');
    }
  });

  it('names the client dimension when one device rotates sessions', () => {
    const wide = { ...limits, sessionPerMinute: 100 };
    for (let i = 0; i < wide.clientPerMinute; i++) {
      checkChatRateLimit(identity({ sessionId: `s${i}` }), 1000, wide, limiter);
    }
    try {
      checkChatRateLimit(identity({ sessionId: 'fresh' }), 1000, wide, limiter);
      expect.unreachable();
    } catch (err) {
      expect((err as RateLimitedError).dimension).toBe('client-minute');
    }
  });
});

describe('token budget', () => {
  it('blocks once the daily token budget is spent, even with requests to spare', () => {
    checkChatRateLimit(identity(), 1000, limits, limiter);
    recordTokenSpend('sess-1', limits.sessionTokensPerDay, limits, limiter);

    expect(remainingTokenBudget('sess-1', limits, limiter)).toBe(0);
    try {
      checkChatRateLimit(identity(), 1000, limits, limiter);
      expect.unreachable();
    } catch (err) {
      expect((err as RateLimitedError).dimension).toBe('session-tokens');
    }
  });

  it('a single oversized call is allowed, then the next is refused', () => {
    // Usage is only known after the model call — rejecting work already done helps nobody.
    recordTokenSpend('sess-1', limits.sessionTokensPerDay * 5, limits, limiter);
    expect(remainingTokenBudget('sess-1', limits, limiter)).toBe(0);
    expect(() => checkChatRateLimit(identity(), 1000, limits, limiter)).toThrow(/session-tokens/);
  });

  it('token budgets are per session', () => {
    recordTokenSpend('sess-1', limits.sessionTokensPerDay, limits, limiter);
    expect(remainingTokenBudget('sess-2', limits, limiter)).toBe(limits.sessionTokensPerDay);
  });
});

describe('windows refill', () => {
  afterEach(() => vi.useRealTimers());

  it('a minute limit recovers, a daily limit does not', () => {
    vi.useFakeTimers();
    const start = Date.now();

    for (let i = 0; i < limits.sessionPerMinute; i++) {
      checkChatRateLimit(identity(), 1000, limits, limiter);
    }
    expect(() => checkChatRateLimit(identity(), 1000, limits, limiter)).toThrow();

    vi.setSystemTime(start + MINUTE_MS + 1);
    expect(() => checkChatRateLimit(identity(), 1000, limits, limiter)).not.toThrow();
  });

  it('daily buckets refill after a day', () => {
    vi.useFakeTimers();
    const start = Date.now();
    const tight = { ...limits, sessionPerDay: 2, sessionPerMinute: 100 };

    checkChatRateLimit(identity(), 1000, tight, limiter);
    checkChatRateLimit(identity(), 1000, tight, limiter);
    expect(() => checkChatRateLimit(identity(), 1000, tight, limiter)).toThrow(/session-day/);

    vi.setSystemTime(start + DAY_MS + 1);
    expect(() => checkChatRateLimit(identity(), 1000, tight, limiter)).not.toThrow();
  });
});

describe('defaults', () => {
  it('are stricter per session than per client, since a runaway loop is the likely failure', () => {
    expect(DEFAULT_CHAT_LIMITS.sessionPerMinute).toBeLessThan(DEFAULT_CHAT_LIMITS.clientPerMinute);
    expect(DEFAULT_CHAT_LIMITS.sessionPerDay).toBeLessThan(DEFAULT_CHAT_LIMITS.clientPerDay);
  });
});
