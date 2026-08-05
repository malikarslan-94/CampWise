import { AsyncLocalStorage } from 'node:async_hooks';
import { getConfig } from '../config.js';
import { getLogger } from '../lib/logger.js';
import { randomUUID } from 'node:crypto';
export const tenantContextStorage = new AsyncLocalStorage();
export function getTenantContext() {
    return tenantContextStorage.getStore();
}
export function requireTenantContext() {
    const ctx = tenantContextStorage.getStore();
    if (!ctx)
        throw new Error('Tenant context missing from AsyncLocalStorage');
    return ctx;
}
/**
 * Validates the incoming request's service key and tenant headers, then
 * stores a TenantContext in AsyncLocalStorage for the duration of the call.
 *
 * Returns false and writes a 401/400 response if validation fails.
 */
export async function tenantAuthMiddleware(req, res, next) {
    const config = getConfig();
    const logger = getLogger({});
    const serviceKey = req.headers['x-yoowifi-service-key'];
    if (!serviceKey || serviceKey !== config.SERVICE_API_KEY) {
        logger.warn({ event: 'auth_failed', reason: 'invalid_service_key' }, 'auth_failed');
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
    }
    const tenantId = req.headers['x-yoowifi-tenant-id'];
    if (!tenantId) {
        logger.warn({ event: 'auth_failed', reason: 'missing_tenant_id' }, 'auth_failed');
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing X-YooWifi-Tenant-Id header' }));
        return;
    }
    const ctx = {
        tenantId,
        userId: req.headers['x-yoowifi-user-id'] ?? undefined,
        userRole: req.headers['x-yoowifi-user-role'] ?? undefined,
        requestId: randomUUID(),
    };
    await tenantContextStorage.run(ctx, next);
}
//# sourceMappingURL=tenantAuth.js.map