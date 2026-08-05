import { z } from 'zod';
import { loadRegistry, collectSecretRefs } from './registry/registry.js';

const ConfigSchema = z.object({
  PORT: z.string().regex(/^\d+$/).transform(Number),
  SERVICE_API_KEY: z.string().min(1),
  REGISTRY_PATH: z.string().min(1),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  /**
   * Re-verifies every plan/price against upstream before returning it. Doubles the
   * upstream calls, so it is off by default: YooWifi's rates are added and updated
   * rarely and manually, making the fetch-to-answer drift window negligible.
   * Turn on if pricing ever becomes dynamic.
   */
  GROUNDING_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // ── Chat layer (phase 2) ────────────────────────────────────────────────────
  // Optional here so the MCP server still starts without them. They become
  // mandatory the moment the chat route is mounted — see validateChatConfig().
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  /** HMAC key for signing session passes. */
  SESSION_SIGNING_KEY: z.string().min(32).optional(),
  RECAPTCHA_SECRET: z.string().min(1).optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

let _config: Config | null = null;

export function loadConfig(): Config {
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
export function validateSecretRefs(): void {
  const registry = loadRegistry();
  const refs = collectSecretRefs(registry.getAllTenants());
  const missing = refs.filter((ref) => !process.env[ref]);
  if (missing.length > 0) {
    throw new Error(
      `The following secret env vars are referenced in the tenant registry but are not set:\n${missing.map((r) => `  ${r}`).join('\n')}`,
    );
  }
}

export function getConfig(): Config {
  if (!_config) throw new Error('Config not loaded. Call loadConfig() first.');
  return _config;
}

/**
 * Non-throwing read of the grounding flag, for call sites inside tool handlers.
 * Defaults to false when config has not been loaded (tests, direct handler calls) —
 * the same as the production default.
 */
export function isGroundingEnabled(): boolean {
  return _config?.GROUNDING_ENABLED ?? false;
}

/**
 * Asserts the chat layer has everything it needs. Called at startup by whatever
 * mounts the chat route — a half-configured public chat endpoint is worse than
 * none, so this refuses to start rather than failing on the first user's message.
 */
export function validateChatConfig(): void {
  const config = getConfig();
  const missing = (['ANTHROPIC_API_KEY', 'SESSION_SIGNING_KEY', 'RECAPTCHA_SECRET'] as const).filter(
    (key) => !config[key],
  );

  if (missing.length > 0) {
    throw new Error(
      `The chat layer is enabled but these environment variables are not set:\n${missing
        .map((k) => `  ${k}`)
        .join('\n')}`,
    );
  }
}
