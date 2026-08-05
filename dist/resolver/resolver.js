import { getRegistry } from '../registry/registry.js';
import { websiteAdapter } from '../adapters/websiteAdapter.js';
import { legacyAppAdapter } from '../adapters/legacyAppAdapter.js';
import { portalAdapter } from '../adapters/portalAdapter.js';
import { ToolNotAllowedError } from '../lib/errors.js';
const ADAPTER_MAP = {
    website: websiteAdapter,
    legacy_app: legacyAppAdapter,
    portal: portalAdapter,
};
/**
 * Portal-specific role scoping hook.
 * Returns a filtered tool list based on userRole, or the record's allowedTools
 * if no role restriction applies. Extend this as portal role requirements grow.
 */
function portalToolsForRole(record, userRole) {
    if (record.family !== 'portal')
        return record.allowedTools;
    if (userRole === 'partner') {
        // Partners may only search plans and check coverage; not order status
        return record.allowedTools.filter((t) => t === 'search_plans' || t === 'get_coverage');
    }
    return record.allowedTools;
}
export function resolve(tenantContext) {
    const registry = getRegistry();
    const record = registry.getTenant(tenantContext.tenantId);
    // Tool allowance check (tool is optional at resolve-time; checked by tools themselves)
    const effectiveTools = record.family === 'portal'
        ? portalToolsForRole(record, tenantContext.userRole)
        : record.allowedTools;
    if (tenantContext.toolName && !effectiveTools.includes(tenantContext.toolName)) {
        throw new ToolNotAllowedError(tenantContext.toolName, tenantContext.tenantId);
    }
    const adapter = ADAPTER_MAP[record.family];
    // Resolve secrets from env at call time — never cached in memory beyond this call
    const resolvedSecrets = {};
    if (record.auth.sharedSecretRef) {
        resolvedSecrets.sharedSecret = process.env[record.auth.sharedSecretRef];
    }
    if (record.auth.encryption?.keyRef) {
        resolvedSecrets.aesKey = process.env[record.auth.encryption.keyRef];
    }
    return { record, adapter, resolvedSecrets, tenantContext };
}
//# sourceMappingURL=resolver.js.map