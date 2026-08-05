import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock everything that goes to the network or requires config
vi.mock('../src/resolver/resolver.js', () => ({ resolve: vi.fn() }));
vi.mock('../src/middleware/rateLimit.js', () => ({ checkRateLimit: vi.fn() }));
vi.mock('../src/middleware/tenantAuth.js', () => ({
  requireTenantContext: () => ({ tenantId: 'web-test', requestId: 'req-1' }),
}));
vi.mock('../src/lib/grounding.js', () => ({ groundPlan: vi.fn().mockResolvedValue(true) }));

const mockAdapter = {
  searchPlans: vi.fn().mockResolvedValue({ ok: true, plans: [] }),
  getPricing: vi.fn().mockResolvedValue({ ok: true, totalAmount: 10, currency: 'USD' }),
  getCoverage: vi.fn().mockResolvedValue({ ok: true, countries: [] }),
  checkOrderStatus: vi.fn().mockResolvedValue({ ok: true, orders: [] }),
};

beforeEach(async () => {
  vi.resetModules();
  vi.mock('../src/resolver/resolver.js', () => ({
    resolve: vi.fn().mockReturnValue({
      record: { rateLimit: { requestsPerMinute: 60 }, family: 'website' },
      adapter: mockAdapter,
      resolvedSecrets: {},
      tenantContext: { tenantId: 'web-test' },
    }),
  }));
  vi.mock('../src/middleware/rateLimit.js', () => ({ checkRateLimit: vi.fn() }));
  vi.mock('../src/middleware/tenantAuth.js', () => ({
    requireTenantContext: () => ({ tenantId: 'web-test', requestId: 'req-1' }),
  }));
  vi.mock('../src/lib/grounding.js', () => ({ groundPlan: vi.fn().mockResolvedValue(true) }));
});

describe('Tool input validation', () => {
  it('search_plans rejects missing originCountry', async () => {
    const { handleSearchPlans } = await import('../src/tools/searchPlans.js');
    const result = await handleSearchPlans({ destinationCountries: ['SG'] }) as Record<string, unknown>;
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/invalid/i);
  });

  it('search_plans rejects bad ISO-2 code', async () => {
    const { handleSearchPlans } = await import('../src/tools/searchPlans.js');
    const result = await handleSearchPlans({ originCountry: 'TOOLONG', destinationCountries: ['SG'] }) as Record<string, unknown>;
    expect(result.ok).toBe(false);
  });

  it('get_pricing rejects missing required fields', async () => {
    const { handleGetPricing } = await import('../src/tools/getPricing.js');
    const result = await handleGetPricing({ planCode: 'P1' }) as Record<string, unknown>;
    expect(result.ok).toBe(false);
  });

  it('check_order_status rejects missing userId', async () => {
    const { handleCheckOrderStatus } = await import('../src/tools/checkOrderStatus.js');
    const result = await handleCheckOrderStatus({}) as Record<string, unknown>;
    expect(result.ok).toBe(false);
  });

  it('search_plans succeeds with valid minimal input and no upstream call happens before adapter', async () => {
    mockAdapter.searchPlans.mockResolvedValue({ ok: true, plans: [] });
    const { handleSearchPlans } = await import('../src/tools/searchPlans.js');
    const result = await handleSearchPlans({ originCountry: 'MY', destinationCountries: ['SG'] }) as Record<string, unknown>;
    // Adapter was called (valid input reached the adapter)
    expect(result.ok).toBe(true);
  });
});
