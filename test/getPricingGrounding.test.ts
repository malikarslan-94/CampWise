import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock everything that touches the network or requires config
vi.mock('../src/resolver/resolver.js', () => ({ resolve: vi.fn() }));
vi.mock('../src/middleware/rateLimit.js', () => ({ checkRateLimit: vi.fn() }));
vi.mock('../src/middleware/tenantAuth.js', () => ({
  requireTenantContext: () => ({ tenantId: 'web-test', requestId: 'req-1' }),
}));
// Grounding ships disabled (GROUNDING_ENABLED=false); these tests cover the
// behaviour when it is switched back on.
vi.mock('../src/config.js', () => ({ isGroundingEnabled: () => true }));

const mockGetPricing = vi.fn();
const mockSearchPlans = vi.fn();

const mockAdapter = {
  searchPlans: mockSearchPlans,
  getPricing: mockGetPricing,
  getCoverage: vi.fn(),
  checkOrderStatus: vi.fn(),
};

const resolvedCtx = {
  record: { rateLimit: { requestsPerMinute: 60 }, family: 'website' },
  adapter: mockAdapter,
  resolvedSecrets: {},
  tenantContext: { tenantId: 'web-test' },
};

beforeEach(() => {
  vi.resetModules();
  vi.mock('../src/resolver/resolver.js', () => ({
    resolve: vi.fn().mockReturnValue(resolvedCtx),
  }));
  vi.mock('../src/middleware/rateLimit.js', () => ({ checkRateLimit: vi.fn() }));
  vi.mock('../src/middleware/tenantAuth.js', () => ({
    requireTenantContext: () => ({ tenantId: 'web-test', requestId: 'req-1' }),
  }));
  vi.mock('../src/config.js', () => ({ isGroundingEnabled: () => true }));
  mockGetPricing.mockReset();
  mockSearchPlans.mockReset();
});

const validPricingInput = {
  planCode: 'P001',
  startDate: '2026-06-01',
  endDate: '2026-06-10',
  destinationCountries: ['SG'],
  travelDetails: [{ startDate: '2026-06-01', endDate: '2026-06-10', countryCode: 'SG' }],
  quantity: 1,
};

describe('get_pricing grounding', () => {
  it('returns price when grounding confirms the same total', async () => {
    // First call (main): returns 49.99
    // Second call (grounding re-verify): returns same 49.99 → passes
    mockGetPricing
      .mockResolvedValueOnce({ ok: true, totalAmount: 49.99, currency: 'USD' })
      .mockResolvedValueOnce({ ok: true, totalAmount: 49.99, currency: 'USD' });

    const { handleGetPricing } = await import('../src/tools/getPricing.js');
    const result = await handleGetPricing(validPricingInput) as Record<string, unknown>;

    expect(result.ok).toBe(true);
    expect(result.totalAmount).toBe(49.99);
    expect(mockGetPricing).toHaveBeenCalledTimes(2); // main call + grounding call
  });

  it('returns ok:false when grounding detects price change', async () => {
    // First call: returns 49.99
    // Grounding re-verify: returns 55.00 → mismatch → reject
    mockGetPricing
      .mockResolvedValueOnce({ ok: true, totalAmount: 49.99, currency: 'USD' })
      .mockResolvedValueOnce({ ok: true, totalAmount: 55.00, currency: 'USD' });

    const { handleGetPricing } = await import('../src/tools/getPricing.js');
    const result = await handleGetPricing(validPricingInput) as Record<string, unknown>;

    expect(result.ok).toBe(false);
    expect((result.message as string).toLowerCase()).toMatch(/verif/);
  });

  it('returns ok:false when grounding re-verify call returns ok:false', async () => {
    mockGetPricing
      .mockResolvedValueOnce({ ok: true, totalAmount: 49.99, currency: 'USD' })
      .mockResolvedValueOnce({ ok: false, message: 'Upstream error' });

    const { handleGetPricing } = await import('../src/tools/getPricing.js');
    const result = await handleGetPricing(validPricingInput) as Record<string, unknown>;

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when grounding re-verify call throws', async () => {
    mockGetPricing
      .mockResolvedValueOnce({ ok: true, totalAmount: 49.99, currency: 'USD' })
      .mockRejectedValueOnce(new Error('Network failure'));

    const { handleGetPricing } = await import('../src/tools/getPricing.js');
    const result = await handleGetPricing(validPricingInput) as Record<string, unknown>;

    expect(result.ok).toBe(false);
  });

  it('passes through ok:false from adapter without running grounding', async () => {
    // Legacy adapter pattern: adapter already returns ok:false — no grounding needed
    mockGetPricing.mockResolvedValueOnce({ ok: false, message: 'Not available' });

    const { handleGetPricing } = await import('../src/tools/getPricing.js');
    const result = await handleGetPricing(validPricingInput) as Record<string, unknown>;

    expect(result.ok).toBe(false);
    expect(result.message).toBe('Not available');
    // Grounding must NOT have fired a second call
    expect(mockGetPricing).toHaveBeenCalledTimes(1);
  });
});
