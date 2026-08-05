import { TenantRecord } from './schema.js';
/** Swappable interface so a DB-backed loader can replace this without changing callers. */
export interface TenantRegistry {
    getTenant(tenantId: string): TenantRecord;
    getAllTenants(): TenantRecord[];
}
export declare function loadRegistry(registryPath?: string): TenantRegistry;
export declare function getRegistry(): TenantRegistry;
/** Collects every *Ref env var name referenced in the registry. */
export declare function collectSecretRefs(records: TenantRecord[]): string[];
//# sourceMappingURL=registry.d.ts.map