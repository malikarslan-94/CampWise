import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadRegistry, collectChatOrigins } from '../src/registry/registry.js';

/**
 * publicChat + allowedOrigins: which tenants the browser-facing chat endpoint may
 * reach, and how an Origin resolves to one.
 *
 * Origin is forgeable by a script, so this is not a security boundary on its own —
 * it is safe only because every tenant behind it serves data that is already public.
 * These tests pin that invariant: opting in is explicit, and a tenant that opts in
 * without origins fails at startup rather than looking configured.
 */

let dir: string;

function writeRegistry(records: unknown[]): string {
  const path = join(dir, 'tenants.json');
  writeFileSync(path, JSON.stringify(records));
  return path;
}

const baseTenant = {
  displayName: 'Test',
  family: 'website',
  source: 'urwifi',
  platformValue: 'web',
  baseUrls: { dispatcher: 'https://api.example.com' },
  auth: { mode: 'none' },
  localeRule: { default: 'EN' },
  allowedTools: ['search_plans'],
  rateLimit: { requestsPerMinute: 60 },
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'yoowifi-registry-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('publicChat defaults', () => {
  it('a tenant that says nothing is NOT chat-enabled', () => {
    const registry = loadRegistry(writeRegistry([{ ...baseTenant, tenantId: 'quiet' }]));
    expect(registry.getTenant('quiet').publicChat).toBe(false);
    expect(registry.getTenant('quiet').allowedOrigins).toEqual([]);
  });

  it('rejects publicChat with no origins — configured but unreachable', () => {
    const path = writeRegistry([
      { ...baseTenant, tenantId: 'broken', publicChat: true, allowedOrigins: [] },
    ]);
    expect(() => loadRegistry(path)).toThrow(/allowedOrigins/);
  });
});

describe('getTenantByOrigin', () => {
  const registryWith = () =>
    loadRegistry(
      writeRegistry([
        {
          ...baseTenant,
          tenantId: 'web-public',
          publicChat: true,
          allowedOrigins: ['https://yoowifi.example', 'https://www.yoowifi.example'],
        },
        {
          ...baseTenant,
          tenantId: 'portal-private',
          publicChat: false,
          allowedOrigins: ['https://portal.yoowifi.example'],
        },
      ]),
    );

  it('resolves an allowed origin to its tenant', () => {
    expect(registryWith().getTenantByOrigin('https://yoowifi.example')?.tenantId).toBe('web-public');
  });

  it('matches several origins onto one tenant', () => {
    const registry = registryWith();
    expect(registry.getTenantByOrigin('https://www.yoowifi.example')?.tenantId).toBe('web-public');
  });

  it('ignores case and a trailing slash', () => {
    const registry = registryWith();
    expect(registry.getTenantByOrigin('HTTPS://YooWifi.example/')?.tenantId).toBe('web-public');
  });

  it('does NOT resolve a tenant that has not opted in, even with a matching origin', () => {
    expect(registryWith().getTenantByOrigin('https://portal.yoowifi.example')).toBeUndefined();
  });

  it('returns undefined for an unknown origin rather than a default tenant', () => {
    expect(registryWith().getTenantByOrigin('https://evil.example')).toBeUndefined();
    expect(registryWith().getTenantByOrigin('')).toBeUndefined();
  });
});

describe('origin collisions', () => {
  it('refuses to start when two chat tenants claim the same origin', () => {
    const path = writeRegistry([
      { ...baseTenant, tenantId: 'a', publicChat: true, allowedOrigins: ['https://same.example'] },
      { ...baseTenant, tenantId: 'b', publicChat: true, allowedOrigins: ['https://same.example'] },
    ]);
    expect(() => loadRegistry(path)).toThrow(/claimed by both/);
  });
});

describe('collectChatOrigins', () => {
  it('returns only origins of chat-enabled tenants, for the CORS allowlist', () => {
    const registry = loadRegistry(
      writeRegistry([
        { ...baseTenant, tenantId: 'a', publicChat: true, allowedOrigins: ['https://a.example'] },
        { ...baseTenant, tenantId: 'b', publicChat: false, allowedOrigins: ['https://b.example'] },
      ]),
    );
    expect(collectChatOrigins(registry.getAllTenants())).toEqual(['https://a.example']);
  });
});
