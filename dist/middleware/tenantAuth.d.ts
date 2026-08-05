import type { IncomingMessage, ServerResponse } from 'node:http';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantContext } from '../resolver/types.js';
export declare const tenantContextStorage: AsyncLocalStorage<TenantContext>;
export declare function getTenantContext(): TenantContext | undefined;
export declare function requireTenantContext(): TenantContext;
/**
 * Validates the incoming request's service key and tenant headers, then
 * stores a TenantContext in AsyncLocalStorage for the duration of the call.
 *
 * Returns false and writes a 401/400 response if validation fails.
 */
export declare function tenantAuthMiddleware(req: IncomingMessage, res: ServerResponse, next: () => Promise<void>): Promise<void>;
//# sourceMappingURL=tenantAuth.d.ts.map