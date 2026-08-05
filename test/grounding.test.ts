import { describe, it, expect, vi } from 'vitest';

const mockSearchPlans = vi.fn();

const mockAdapter = { searchPlans: mockSearchPlans, getPricing: vi.fn(), getCoverage: vi.fn(), checkOrderStatus: vi.fn() };

import type { ResolvedContext } from '../src/resolver/types.js';
import { groundPlan } from '../src/lib/grounding.js';

const ctx: ResolvedContext = {
  record: {
    tenantId: 'web-test', displayName: 'Test', family: 'website', source: 'urwifi',
    platformValue: 'web', baseUrls: { dispatcher: 'https://api.example.com' },
    auth: { mode: 'none' }, localeRule: { default: 'EN' },
    allowedTools: ['search_plans'], rateLimit: { requestsPerMinute: 60 },
  },
  adapter: mockAdapter,
  resolvedSecrets: {},
  tenantContext: { tenantId: 'web-test', requestId: 'req-1' },
};

const originalPlan = {
  planCode: 'P001', planName: 'Test Plan', productType: 'esim',
  price: 25.99, currency: 'USD', variations: [],
};

const req = { originCountry: 'MY', destinationCountries: ['SG'] };

describe('grounding', () => {
  it('returns true when plan exists with matching price', async () => {
    mockSearchPlans.mockResolvedValue({ ok: true, plans: [{ ...originalPlan }] });
    expect(await groundPlan(originalPlan, req, ctx)).toBe(true);
  });

  it('returns false when plan not found in re-verification', async () => {
    mockSearchPlans.mockResolvedValue({ ok: true, plans: [] });
    expect(await groundPlan(originalPlan, req, ctx)).toBe(false);
  });

  it('returns false when price has changed', async () => {
    mockSearchPlans.mockResolvedValue({ ok: true, plans: [{ ...originalPlan, price: 30.00 }] });
    expect(await groundPlan(originalPlan, req, ctx)).toBe(false);
  });

  it('returns false when upstream call errors', async () => {
    mockSearchPlans.mockRejectedValue(new Error('Network error'));
    expect(await groundPlan(originalPlan, req, ctx)).toBe(false);
  });

  it('returns false when upstream returns ok:false', async () => {
    mockSearchPlans.mockResolvedValue({ ok: false, plans: [] });
    expect(await groundPlan(originalPlan, req, ctx)).toBe(false);
  });
});
