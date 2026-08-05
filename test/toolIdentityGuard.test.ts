import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Guard tests: identity and tenancy may only come from TenantContext.
 *
 * Every case here drives the tool handlers with a **dummy app payload** — the shape
 * a client app will eventually send — plus hostile extras a conversation could have
 * put there. The assertion is always the same: what reaches the adapter came from
 * the trusted context, and the hostile extras were dropped.
 *
 * Discovery showed upstream accepts `source` (the tenant) as a plain client field
 * with no server-side validation, so nothing downstream catches a mistake here.
 * These tests are the only check.
 */

vi.mock('../src/resolver/resolver.js', () => ({ resolve: vi.fn() }));
vi.mock('../src/middleware/rateLimit.js', () => ({ checkRateLimit: vi.fn() }));
vi.mock('../src/middleware/tenantAuth.js', () => ({ requireTenantContext: vi.fn() }));

import { handleSearchPlans } from '../src/tools/searchPlans.js';
import { handleGetPricing } from '../src/tools/getPricing.js';
import { handleCheckOrderStatus } from '../src/tools/checkOrderStatus.js';
import { searchPlansInputSchema } from '../src/tools/searchPlans.js';
import { getPricingInputSchema } from '../src/tools/getPricing.js';
import { checkOrderStatusInputSchema } from '../src/tools/checkOrderStatus.js';
import { resolve } from '../src/resolver/resolver.js';
import { requireTenantContext } from '../src/middleware/tenantAuth.js';

const mockSearchPlans = vi.fn();
const mockGetPricing = vi.fn();
const mockCheckOrderStatus = vi.fn();

/** The tenant + identity the server trusts — from headers, or a signed session pass. */
const TRUSTED_CONTEXT = {
  tenantId: 'web-yoowifi-my',
  userId: 'u-12345',
  requestId: 'req-1',
};

const resolvedCtx = {
  record: {
    tenantId: 'web-yoowifi-my',
    displayName: 'Malaysia Website',
    family: 'website' as const,
    source: 'urwifi',
    platformValue: 'web',
    baseUrls: { dispatcher: 'https://api.example.com' },
    auth: { mode: 'none' as const },
    localeRule: { default: 'EN' },
    allowedTools: ['search_plans', 'get_pricing', 'check_order_status'],
    rateLimit: { requestsPerMinute: 60 },
  },
  adapter: {
    searchPlans: mockSearchPlans,
    getPricing: mockGetPricing,
    getCoverage: vi.fn(),
    checkOrderStatus: mockCheckOrderStatus,
  },
  resolvedSecrets: {},
  tenantContext: TRUSTED_CONTEXT,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireTenantContext).mockReturnValue(TRUSTED_CONTEXT as never);
  vi.mocked(resolve).mockReturnValue(resolvedCtx as never);
  mockSearchPlans.mockResolvedValue({ ok: true, plans: [] });
  mockGetPricing.mockResolvedValue({ ok: true, totalAmount: 45, currency: 'MYR' });
  mockCheckOrderStatus.mockResolvedValue({ ok: true, orders: [] });
});

// ── The model-facing schemas must not expose identity at all ──────────────────

describe('tool input schemas expose no identity fields', () => {
  const forbidden = ['userId', 'appUserId', 'phone', 'tenantId', 'source', 'promoCode'];

  it.each([
    ['search_plans', searchPlansInputSchema],
    ['get_pricing', getPricingInputSchema],
    ['check_order_status', checkOrderStatusInputSchema],
  ])('%s', (_name, schema) => {
    const keys = Object.keys(schema.shape);
    for (const field of forbidden) {
      expect(keys).not.toContain(field);
    }
  });
});

// ── Hostile args must not reach the adapter ───────────────────────────────────

describe('identity comes from context, not from tool arguments', () => {
  it('search_plans ignores userId/promoCode/tenantId in args', async () => {
    await handleSearchPlans({
      // the dummy app payload
      originCountry: 'MY',
      destinationCountries: ['JP'],
      durationDays: 7,
      deviceType: 'esim',
      // what a conversation might have injected
      userId: 'u-99999',
      promoCode: 'GUESSED50',
      tenantId: 'portal-tune',
    });

    const [req] = mockSearchPlans.mock.calls[0];
    expect(req.userId).toBe('u-12345');
    expect(req.promoCode).toBeUndefined();
    expect(req).not.toHaveProperty('tenantId');
  });

  it('get_pricing ignores userId/promoCode in args', async () => {
    await handleGetPricing({
      planCode: 'JP-UNL-7D',
      startDate: '2026-01-01',
      endDate: '2026-01-08',
      destinationCountries: ['JP'],
      travelDetails: [{ startDate: '2026-01-01', endDate: '2026-01-08', countryCode: 'JP' }],
      quantity: 1,
      userId: 'u-99999',
      promoCode: 'GUESSED50',
    });

    const [req] = mockGetPricing.mock.calls[0];
    expect(req.userId).toBe('u-12345');
    expect(req.promoCode).toBeUndefined();
  });

  it('check_order_status returns the context user, not the one named in args', async () => {
    await handleCheckOrderStatus({ userId: 'u-99999', phone: '+60123456789' });

    const [req] = mockCheckOrderStatus.mock.calls[0];
    expect(req.userId).toBe('u-12345');
    expect(req.phone).toBeUndefined();
  });

  it('check_order_status still narrows by orderId, which is safe to expose', async () => {
    await handleCheckOrderStatus({ orderId: 'ORD-1' });

    const [req] = mockCheckOrderStatus.mock.calls[0];
    expect(req).toMatchObject({ userId: 'u-12345', orderId: 'ORD-1' });
  });
});

// ── No signed-in user → no order lookup at all ────────────────────────────────

describe('anonymous context cannot reach order history', () => {
  it('refuses without calling the adapter', async () => {
    vi.mocked(requireTenantContext).mockReturnValue({
      tenantId: 'web-yoowifi-my',
      requestId: 'req-2',
    } as never);

    const result = await handleCheckOrderStatus({ userId: 'u-99999' });

    expect(result.ok).toBe(false);
    expect(mockCheckOrderStatus).not.toHaveBeenCalled();
  });
});

// ── Tenancy is resolved from context, never from args ─────────────────────────

describe('tenant is resolved from context', () => {
  it('resolve() is called with the context tenant even when args name another', async () => {
    await handleSearchPlans({
      originCountry: 'MY',
      destinationCountries: ['JP'],
      tenantId: 'portal-tune',
      source: 'tune',
    });

    const [resolveArg] = vi.mocked(resolve).mock.calls[0];
    expect(resolveArg.tenantId).toBe('web-yoowifi-my');
  });
});
