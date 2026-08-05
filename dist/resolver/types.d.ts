import type { TenantRecord } from '../registry/schema.js';
import type { Adapter } from '../adapters/types.js';
export interface TenantContext {
    tenantId: string;
    userId?: string;
    userRole?: string;
    requestId?: string;
    toolName?: string;
}
export interface ResolvedSecrets {
    sharedSecret?: string;
    aesKey?: string;
    bearerToken?: string;
}
export interface ResolvedContext {
    record: TenantRecord;
    adapter: Adapter;
    resolvedSecrets: ResolvedSecrets;
    tenantContext: TenantContext;
}
//# sourceMappingURL=types.d.ts.map