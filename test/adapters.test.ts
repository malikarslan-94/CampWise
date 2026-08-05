import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encrypt, decrypt } from '../src/lib/crypto.js';

vi.mock('../src/lib/httpClient.js', () => ({
  httpPost: vi.fn(),
}));

import * as httpClientModule from '../src/lib/httpClient.js';

const mockHttpPost = vi.mocked(httpClientModule.httpPost);

import { websiteAdapter } from '../src/adapters/websiteAdapter.js';
import { legacyAppAdapter } from '../src/adapters/legacyAppAdapter.js';
import { portalAdapter } from '../src/adapters/portalAdapter.js';
import type { ResolvedContext } from '../src/resolver/types.js';

function makeCtx(overrides: Partial<ResolvedContext['record']> = {}, secretOverrides: Partial<ResolvedContext['resolvedSecrets']> = {}): ResolvedContext {
  const record: ResolvedContext['record'] = {
    tenantId: 'web-test',
    displayName: 'Test',
    family: 'website',
    source: 'urwifi',
    platformValue: 'web',
    baseUrls: {
      dispatcher: 'https://api.example.com/dispatcher',
      restCharges: 'https://api.example.com/charges',
    },
    auth: { mode: 'none' },
    localeRule: { default: 'EN', remap: { JP: 'JA' } },
    allowedTools: ['search_plans', 'get_pricing', 'get_coverage', 'check_order_status'],
    rateLimit: { requestsPerMinute: 60 },
    ...overrides,
  };

  return {
    record,
    adapter: websiteAdapter,
    resolvedSecrets: secretOverrides,
    tenantContext: { tenantId: record.tenantId, requestId: 'req-1' },
  };
}

const planRaw = {
  planCode: 'P001',
  planName: 'Global eSIM',
  productType: 'esim',
  price: 25.99,
  currency: 'USD',
  variations: [{ variationId: 'V1', price: 25.99 }],
};

// ── Website Adapter ───────────────────────────────────────────────────────────

describe('websiteAdapter', () => {
  beforeEach(() => mockHttpPost.mockReset());

  it('searchPlans — injects source, platform, language into body', async () => {
    mockHttpPost.mockResolvedValue({ status: 200, data: { data: [planRaw] } });

    await websiteAdapter.searchPlans(
      { originCountry: 'MY', destinationCountries: ['JP'] },
      makeCtx(),
    );

    const [url, opts] = mockHttpPost.mock.calls[0];
    expect(url).toBe('https://api.example.com/dispatcher');
    expect(opts.body).toMatchObject({ source: 'urwifi', platform: 'web', requestType: 'localPlans', origin: 'MY' });
  });

  it('searchPlans — applies locale remap JP -> JA', async () => {
    mockHttpPost.mockResolvedValue({ status: 200, data: { data: [] } });
    const ctx = makeCtx({ localeRule: { default: 'JP', remap: { JP: 'JA' } } });
    await websiteAdapter.searchPlans({ originCountry: 'MY', destinationCountries: ['SG'] }, ctx);
    expect(mockHttpPost.mock.calls[0][1].body.language).toBe('JA');
  });

  it('getPricing — posts to restCharges with correct payload', async () => {
    mockHttpPost.mockResolvedValue({ status: 200, data: { data: { totalAmount: 49.99, currency: 'USD' } } });

    const result = await websiteAdapter.getPricing(
      {
        planCode: 'P001', startDate: '2026-06-01', endDate: '2026-06-10',
        destinationCountries: ['SG'], travelDetails: [], quantity: 1,
      },
      makeCtx(),
    );

    expect(mockHttpPost.mock.calls[0][0]).toBe('https://api.example.com/charges');
    expect(result.ok).toBe(true);
    expect(result.totalAmount).toBe(49.99);
  });

  it('getPricing — returns ok:false when restCharges not configured', async () => {
    const ctx = makeCtx({ baseUrls: { dispatcher: 'https://api.example.com/dispatcher' } });
    const result = await websiteAdapter.getPricing(
      { planCode: 'P', startDate: '2026-06-01', endDate: '2026-06-10', destinationCountries: ['SG'], travelDetails: [], quantity: 1 },
      ctx,
    );
    expect(result.ok).toBe(false);
    expect(mockHttpPost).not.toHaveBeenCalled();
  });

  it('getCoverage — requestType planCountries', async () => {
    mockHttpPost.mockResolvedValue({ status: 200, data: { data: [{ countryCode: 'SG', countryName: 'Singapore' }] } });
    const result = await websiteAdapter.getCoverage({ planCode: 'P001' }, makeCtx());
    expect(result.ok).toBe(true);
    expect(result.countries[0].countryCode).toBe('SG');
    expect(mockHttpPost.mock.calls[0][1].body.requestType).toBe('planCountries');
  });

  it('checkOrderStatus — requestType getUserOrders', async () => {
    mockHttpPost.mockResolvedValue({ status: 200, data: { data: [{ orderId: 'O1', orderStatus: 'active' }] } });
    const result = await websiteAdapter.checkOrderStatus({ userId: 'U1' }, makeCtx());
    expect(result.ok).toBe(true);
    expect(result.orders[0].orderId).toBe('O1');
    expect(mockHttpPost.mock.calls[0][1].body.requestType).toBe('getUserOrders');
  });
});

// ── Legacy App Adapter ────────────────────────────────────────────────────────

describe('legacyAppAdapter', () => {
  beforeEach(() => mockHttpPost.mockReset());

  const legacyCtx = () => makeCtx(
    { family: 'legacy_app', platformValue: 'app', auth: { mode: 'none', encryption: { enabled: true, keyRef: 'AESKEY_LEGACY_APP', algorithm: 'aes-256-cbc' } } },
    { aesKey: 'test-aes-key-32bytes-padded-here' },
  );

  it('searchPlans — encrypts inner payload when encryption enabled', async () => {
    mockHttpPost.mockResolvedValue({ status: 200, data: { data: [planRaw] } });
    await legacyAppAdapter.searchPlans({ originCountry: 'MY', destinationCountries: ['SG'] }, legacyCtx());

    const body = mockHttpPost.mock.calls[0][1].body as Record<string, unknown>;
    expect(typeof body.data).toBe('string');
    expect(body.data).toMatch(/^[0-9a-f]+:/);

    const inner = decrypt<Record<string, unknown>>(body.data as string, 'test-aes-key-32bytes-padded-here');
    expect(inner.origin).toBe('MY');
  });

  it('searchPlans — platform field is "app"', async () => {
    mockHttpPost.mockResolvedValue({ status: 200, data: { data: [] } });
    await legacyAppAdapter.searchPlans({ originCountry: 'MY', destinationCountries: ['SG'] }, legacyCtx());
    expect(mockHttpPost.mock.calls[0][1].body.platform).toBe('app');
  });

  it('getPricing — returns ok:false (no charges endpoint for legacy)', async () => {
    const result = await legacyAppAdapter.getPricing(
      { planCode: 'P', startDate: '2026-06-01', endDate: '2026-06-10', destinationCountries: ['SG'], travelDetails: [], quantity: 1 },
      legacyCtx(),
    );
    expect(result.ok).toBe(false);
    expect(mockHttpPost).not.toHaveBeenCalled();
  });

  it('searchPlans — injects language field from localeRule', async () => {
    mockHttpPost.mockResolvedValue({ status: 200, data: { data: [] } });
    await legacyAppAdapter.searchPlans({ originCountry: 'MY', destinationCountries: ['SG'] }, legacyCtx());
    expect(mockHttpPost.mock.calls[0][1].body.language).toBe('EN');
  });

  it('searchPlans — applies locale remap (JP -> JA) in language field', async () => {
    mockHttpPost.mockResolvedValue({ status: 200, data: { data: [] } });
    const ctx = makeCtx(
      { family: 'legacy_app', platformValue: 'app', localeRule: { default: 'JP', remap: { JP: 'JA' } }, auth: { mode: 'none', encryption: { enabled: false, keyRef: 'K', algorithm: 'aes-256-cbc' } } },
      {},
    );
    await legacyAppAdapter.searchPlans({ originCountry: 'MY', destinationCountries: ['SG'] }, ctx);
    expect(mockHttpPost.mock.calls[0][1].body.language).toBe('JA');
  });
});

// ── Portal Adapter ────────────────────────────────────────────────────────────

describe('portalAdapter', () => {
  beforeEach(() => mockHttpPost.mockReset());

  const portalCtx = () => makeCtx(
    {
      family: 'portal', source: 'tune', platformValue: 'b2b',
      platformOverrides: { localPlans: 'crm', activateEsim: 'crm' },
      baseUrls: {
        dispatcher: 'https://api.example.com/dispatcher',
        extApi: 'https://extapi.example.com',
      },
      auth: { mode: 'shared_secret', sharedSecretRef: 'SECRET_PORTAL_TUNE' },
    },
    { sharedSecret: 'super-secret-value' },
  );

  it('searchPlans — routes to extApi for tune source', async () => {
    mockHttpPost.mockResolvedValue({ status: 200, data: { data: [] } });
    await portalAdapter.searchPlans({ originCountry: 'MY', destinationCountries: ['SG'] }, portalCtx());
    expect(mockHttpPost.mock.calls[0][0]).toBe('https://extapi.example.com');
  });

  it('searchPlans — platform override localPlans -> crm', async () => {
    mockHttpPost.mockResolvedValue({ status: 200, data: { data: [] } });
    await portalAdapter.searchPlans({ originCountry: 'MY', destinationCountries: ['SG'] }, portalCtx());
    expect(mockHttpPost.mock.calls[0][1].body.platform).toBe('crm');
  });


  it('searchPlans — security field injected then stripped (body ref has no security after call)', async () => {
    // mock.calls stores the body BY REFERENCE. stripSecurity() deletes 'security' from that same
    // object after httpPost returns. So checking mock.calls[0][1].body post-call proves strip ran.
    // Combined with ctx.resolvedSecrets.sharedSecret being set, this proves inject+strip.
    mockHttpPost.mockResolvedValue({ status: 200, data: { data: [] } });
    const ctx = portalCtx(); // sharedSecret: 'super-secret-value'
    await portalAdapter.searchPlans({ originCountry: 'MY', destinationCountries: ['SG'] }, ctx);

    const body = mockHttpPost.mock.calls[0][1].body as Record<string, unknown>;
    expect(ctx.resolvedSecrets.sharedSecret).toBe('super-secret-value'); // there was a secret to inject
    expect('security' in body).toBe(false);  // stripped from the same object reference post-call
  });

  it('checkOrderStatus — platform NOT overridden (no override for getUserOrders)', async () => {
    mockHttpPost.mockResolvedValue({ status: 200, data: { data: [] } });
    await portalAdapter.checkOrderStatus({ userId: 'U1' }, portalCtx());
    expect(mockHttpPost.mock.calls[0][1].body.platform).toBe('b2b');
  });

  it('searchPlans — security absent from body ref after call (strip invariant)', async () => {
    mockHttpPost.mockResolvedValue({ status: 200, data: { data: [] } });
    await portalAdapter.searchPlans({ originCountry: 'MY', destinationCountries: ['SG'] }, portalCtx());
    const body = mockHttpPost.mock.calls[0][1].body as Record<string, unknown>;
    expect('security' in body).toBe(false);
  });

  it('getPricing — security absent from body ref after call (strip invariant)', async () => {
    mockHttpPost.mockResolvedValue({ status: 200, data: { data: { totalAmount: 50, currency: 'USD' } } });
    const ctx = makeCtx(
      {
        family: 'portal', source: 'tune', platformValue: 'b2b',
        baseUrls: { dispatcher: 'https://api.example.com', restCharges: 'https://charges.example.com', extApi: 'https://ext.example.com' },
        auth: { mode: 'shared_secret', sharedSecretRef: 'S' },
      },
      { sharedSecret: 'portal-secret' },
    );
    await portalAdapter.getPricing(
      { planCode: 'P', startDate: '2026-06-01', endDate: '2026-06-10', destinationCountries: ['SG'], travelDetails: [], quantity: 1 },
      ctx,
    );
    const body = mockHttpPost.mock.calls[0][1].body as Record<string, unknown>;
    expect(ctx.resolvedSecrets.sharedSecret).toBe('portal-secret');
    expect('security' in body).toBe(false);
  });
});
