import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockGetTenant = vi.fn();

vi.mock('../src/registry/registry.js', () => ({
  getRegistry: () => ({ getTenant: mockGetTenant, getAllTenants: () => [] }),
}));

let resolve: typeof import('../src/resolver/resolver.js').resolve;

beforeEach(async () => {
  vi.resetModules();
  vi.mock('../src/registry/registry.js', () => ({
    getRegistry: () => ({ getTenant: mockGetTenant, getAllTenants: () => [] }),
  }));
  const mod = await import('../src/resolver/resolver.js');
  resolve = mod.resolve;
});

const baseTenant = {
  tenantId: 'web-test',
  displayName: 'Test',
  family: 'website' as const,
  source: 'urwifi',
  platformValue: 'web',
  baseUrls: { dispatcher: 'https://api.example.com' },
  auth: { mode: 'none' as const },
  localeRule: { default: 'EN' },
  allowedTools: ['search_plans', 'get_pricing', 'get_coverage', 'check_order_status'],
  rateLimit: { requestsPerMinute: 60 },
};

describe('Resolver', () => {
  it('returns correct adapter for website family', () => {
    mockGetTenant.mockReturnValue(baseTenant);
    const ctx = resolve({ tenantId: 'web-test', toolName: 'search_plans' });
    expect(ctx.record.family).toBe('website');
    expect(ctx.adapter).toBeDefined();
  });

  it('returns correct adapter for legacy_app family', () => {
    mockGetTenant.mockReturnValue({ ...baseTenant, family: 'legacy_app' });
    const ctx = resolve({ tenantId: 'app-test', toolName: 'search_plans' });
    expect(ctx.record.family).toBe('legacy_app');
  });

  it('returns correct adapter for portal family', () => {
    mockGetTenant.mockReturnValue({ ...baseTenant, family: 'portal' });
    const ctx = resolve({ tenantId: 'portal-test', toolName: 'search_plans' });
    expect(ctx.record.family).toBe('portal');
  });

  it('throws ToolNotAllowedError when tool not in allowedTools', () => {
    mockGetTenant.mockReturnValue({ ...baseTenant, allowedTools: ['search_plans'] });
    expect(() => resolve({ tenantId: 'web-test', toolName: 'get_pricing' })).toThrow('Tool \'get_pricing\' is not allowed');
  });

  it('portal partner role restricted to search_plans and get_coverage', () => {
    mockGetTenant.mockReturnValue({ ...baseTenant, family: 'portal' });
    expect(() =>
      resolve({ tenantId: 'portal-test', toolName: 'check_order_status', userRole: 'partner' }),
    ).toThrow('not allowed');
  });

  it('portal admin role has full access', () => {
    mockGetTenant.mockReturnValue({ ...baseTenant, family: 'portal' });
    const ctx = resolve({ tenantId: 'portal-test', toolName: 'check_order_status', userRole: 'admin' });
    expect(ctx).toBeDefined();
  });

  it('resolves sharedSecret from env', () => {
    process.env.SECRET_TEST = 'test-secret-value';
    mockGetTenant.mockReturnValue({ ...baseTenant, auth: { mode: 'shared_secret', sharedSecretRef: 'SECRET_TEST' } });
    const ctx = resolve({ tenantId: 'portal-test' });
    expect(ctx.resolvedSecrets.sharedSecret).toBe('test-secret-value');
    delete process.env.SECRET_TEST;
  });
});
