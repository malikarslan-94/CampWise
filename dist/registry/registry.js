import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TenantRecordSchema } from './schema.js';
import { TenantNotFoundError } from '../lib/errors.js';
import { rootLogger } from '../lib/logger.js';
class JsonTenantRegistry {
    map;
    constructor(records) {
        this.map = new Map(records.map((r) => [r.tenantId, r]));
    }
    getTenant(tenantId) {
        const record = this.map.get(tenantId);
        if (!record)
            throw new TenantNotFoundError(tenantId);
        return record;
    }
    getAllTenants() {
        return Array.from(this.map.values());
    }
}
let _registry = null;
export function loadRegistry(registryPath) {
    const path = resolve(registryPath ?? process.env.REGISTRY_PATH ?? './src/registry/tenants.json');
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(raw)) {
        throw new Error(`Registry file at ${path} must be a JSON array`);
    }
    const records = [];
    const errors = [];
    for (let i = 0; i < raw.length; i++) {
        const result = TenantRecordSchema.safeParse(raw[i]);
        if (result.success) {
            records.push(result.data);
        }
        else {
            const id = raw[i]?.tenantId ?? `index-${i}`;
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
export function getRegistry() {
    if (!_registry)
        throw new Error('Registry not loaded. Call loadRegistry() first.');
    return _registry;
}
/** Collects every *Ref env var name referenced in the registry. */
export function collectSecretRefs(records) {
    const refs = [];
    for (const r of records) {
        if (r.auth.sharedSecretRef)
            refs.push(r.auth.sharedSecretRef);
        if (r.auth.encryption?.keyRef)
            refs.push(r.auth.encryption.keyRef);
    }
    return [...new Set(refs)];
}
//# sourceMappingURL=registry.js.map