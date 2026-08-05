import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Reset registry singleton between tests
let loadRegistry: typeof import('../src/registry/registry.js').loadRegistry;
let collectSecretRefs: typeof import('../src/registry/registry.js').collectSecretRefs;
let validateSecretRefs: typeof import('../src/config.js').validateSecretRefs;

beforeEach(async () => {
  vi.resetModules();
  const mod = await import('../src/registry/registry.js');
  loadRegistry = mod.loadRegistry;
  collectSecretRefs = mod.collectSecretRefs;
  const cfgMod = await import('../src/config.js');
  validateSecretRefs = cfgMod.validateSecretRefs;
});

const validTenant = {
  tenantId: 'web-test',
  displayName: 'Test Website',
  family: 'website',
  source: 'urwifi',
  platformValue: 'web',
  baseUrls: { dispatcher: 'https://api.example.com/dispatcher' },
  auth: { mode: 'none' },
  localeRule: { default: 'EN' },
  allowedTools: ['search_plans'],
  rateLimit: { requestsPerMinute: 60 },
};

function writeTempRegistry(data: unknown): string {
  const path = join(tmpdir(), `registry-${Date.now()}.json`);
  writeFileSync(path, JSON.stringify(data));
  return path;
}

describe('Registry', () => {
  it('loads a valid registry file', () => {
    const path = writeTempRegistry([validTenant]);
    const registry = loadRegistry(path);
    expect(registry.getAllTenants()).toHaveLength(1);
    expect(registry.getTenant('web-test').tenantId).toBe('web-test');
    unlinkSync(path);
  });

  it('throws on invalid tenant record', () => {
    const invalid = { ...validTenant, family: 'unknown_family' };
    const path = writeTempRegistry([invalid]);
    expect(() => loadRegistry(path)).toThrow('Registry validation failed');
    unlinkSync(path);
  });

  it('throws TenantNotFoundError for unknown tenantId', () => {
    const path = writeTempRegistry([validTenant]);
    const registry = loadRegistry(path);
    expect(() => registry.getTenant('nonexistent')).toThrow('Tenant not found');
    unlinkSync(path);
  });

  it('collectSecretRefs returns sharedSecretRef and keyRef values', () => {
    const tenant = {
      ...validTenant,
      auth: {
        mode: 'shared_secret',
        sharedSecretRef: 'SECRET_FOO',
        encryption: { enabled: true, keyRef: 'AESKEY_FOO', algorithm: 'aes-256-cbc' },
      },
    };
    const path = writeTempRegistry([tenant]);
    const registry = loadRegistry(path);
    const refs = collectSecretRefs(registry.getAllTenants());
    expect(refs).toContain('SECRET_FOO');
    expect(refs).toContain('AESKEY_FOO');
    unlinkSync(path);
  });
});

describe('validateSecretRefs', () => {
  it('throws and names missing env vars when a *Ref in the registry has no matching env var', async () => {
    const refName = `TEST_SECRET_REF_${Date.now()}`;
    const tenant = {
      ...validTenant,
      auth: { mode: 'shared_secret', sharedSecretRef: refName },
    };
    const path = writeTempRegistry([tenant]);

    // Ensure the env var is NOT set
    delete process.env[refName];
    process.env.REGISTRY_PATH = path;

    expect(() => validateSecretRefs()).toThrow(refName);

    delete process.env.REGISTRY_PATH;
    unlinkSync(path);
  });

  it('passes when all *Refs have matching env vars', () => {
    const refName = `TEST_SECRET_PRESENT_${Date.now()}`;
    const tenant = {
      ...validTenant,
      auth: { mode: 'shared_secret', sharedSecretRef: refName },
    };
    const path = writeTempRegistry([tenant]);

    process.env[refName] = 'some-value';
    process.env.REGISTRY_PATH = path;

    expect(() => validateSecretRefs()).not.toThrow();

    delete process.env[refName];
    delete process.env.REGISTRY_PATH;
    unlinkSync(path);
  });
});
