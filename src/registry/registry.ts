import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TenantRecord, TenantRecordSchema } from './schema.js';
import { TenantNotFoundError } from '../lib/errors.js';
import { rootLogger } from '../lib/logger.js';
import { z } from 'zod';

/** Swappable interface so a DB-backed loader can replace this without changing callers. */
export interface TenantRegistry {
  getTenant(tenantId: string): TenantRecord;
  getAllTenants(): TenantRecord[];
  /**
   * Resolves a request Origin to the tenant that owns it, considering only tenants
   * with publicChat enabled. Returns undefined for anything unrecognised — the chat
   * endpoint then refuses, rather than falling back to some default tenant.
   */
  getTenantByOrigin(origin: string): TenantRecord | undefined;
}

/** Origins are compared case-insensitively and without a trailing slash. */
function canonicalOrigin(origin: string): string {
  return origin.trim().toLowerCase().replace(/\/+$/, '');
}

class JsonTenantRegistry implements TenantRegistry {
  private readonly map: Map<string, TenantRecord>;
  private readonly byOrigin: Map<string, TenantRecord>;

  constructor(records: TenantRecord[]) {
    this.map = new Map(records.map((r) => [r.tenantId, r]));

    this.byOrigin = new Map();
    for (const record of records) {
      if (!record.publicChat) continue;
      for (const origin of record.allowedOrigins) {
        const key = canonicalOrigin(origin);
        const existing = this.byOrigin.get(key);
        if (existing) {
          throw new Error(
            `Origin '${origin}' is claimed by both '${existing.tenantId}' and '${record.tenantId}'`,
          );
        }
        this.byOrigin.set(key, record);
      }
    }
  }

  getTenant(tenantId: string): TenantRecord {
    const record = this.map.get(tenantId);
    if (!record) throw new TenantNotFoundError(tenantId);
    return record;
  }

  getAllTenants(): TenantRecord[] {
    return Array.from(this.map.values());
  }

  getTenantByOrigin(origin: string): TenantRecord | undefined {
    if (!origin) return undefined;
    return this.byOrigin.get(canonicalOrigin(origin));
  }
}

let _registry: TenantRegistry | null = null;

export function loadRegistry(registryPath?: string): TenantRegistry {
  const path = resolve(registryPath ?? process.env.REGISTRY_PATH ?? './src/registry/tenants.json');
  const raw = JSON.parse(readFileSync(path, 'utf8'));

  if (!Array.isArray(raw)) {
    throw new Error(`Registry file at ${path} must be a JSON array`);
  }

  const records: TenantRecord[] = [];
  const errors: string[] = [];

  for (let i = 0; i < raw.length; i++) {
    const result = TenantRecordSchema.safeParse(raw[i]);
    if (result.success) {
      records.push(result.data);
    } else {
      const id = (raw[i] as Record<string, unknown>)?.tenantId ?? `index-${i}`;
      errors.push(`  tenant '${id}': ${result.error.message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Registry validation failed:\n${errors.join('\n')}`);
  }

  rootLogger.info({ count: records.length }, 'registry_loaded');
  _registry = new JsonTenantRegistry(records);
  return _registry;
}

export function getRegistry(): TenantRegistry {
  if (!_registry) throw new Error('Registry not loaded. Call loadRegistry() first.');
  return _registry;
}

/** Every origin allowed to reach the chat endpoint, for the CORS allowlist. */
export function collectChatOrigins(records: TenantRecord[]): string[] {
  return [...new Set(records.filter((r) => r.publicChat).flatMap((r) => r.allowedOrigins))];
}

/** Collects every *Ref env var name referenced in the registry. */
export function collectSecretRefs(records: TenantRecord[]): string[] {
  const refs: string[] = [];
  for (const r of records) {
    if (r.auth.sharedSecretRef) refs.push(r.auth.sharedSecretRef);
    if (r.auth.encryption?.keyRef) refs.push(r.auth.encryption.keyRef);
  }
  return [...new Set(refs)];
}
