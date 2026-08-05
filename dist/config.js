import { z } from 'zod';
import { loadRegistry, collectSecretRefs } from './registry/registry.js';
const ConfigSchema = z.object({
    PORT: z.string().regex(/^\d+$/).transform(Number),
    SERVICE_API_KEY: z.string().min(1),
    REGISTRY_PATH: z.string().min(1),
    LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});
let _config = null;
export function loadConfig() {
    const result = ConfigSchema.safeParse(process.env);
    if (!result.success) {
        const missing = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
        throw new Error(`Missing or invalid environment variables:\n${missing}`);
    }
    _config = result.data;
    return _config;
}
/**
 * After the registry is loaded, verifies every *Ref env var named in tenant
 * records actually exists in process.env. Exits with a clear error if not.
 */
export function validateSecretRefs() {
    const registry = loadRegistry();
    const refs = collectSecretRefs(registry.getAllTenants());
    const missing = refs.filter((ref) => !process.env[ref]);
    if (missing.length > 0) {
        throw new Error(`The following secret env vars are referenced in the tenant registry but are not set:\n${missing.map((r) => `  ${r}`).join('\n')}`);
    }
}
export function getConfig() {
    if (!_config)
        throw new Error('Config not loaded. Call loadConfig() first.');
    return _config;
}
//# sourceMappingURL=config.js.map