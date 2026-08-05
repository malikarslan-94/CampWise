import type { TenantRecord } from '../registry/schema.js';
import type { Adapter } from '../adapters/types.js';
import type { SupportedLocale } from '../lib/locale.js';

/**
 * Per-request identity and caller context, stored in AsyncLocalStorage.
 *
 * Everything here is set by a trusted source — the tenantAuth middleware from
 * request headers, or (phase 2) the chat module from a signed session pass.
 * Nothing here is ever populated from tool arguments, i.e. from the model.
 */
export interface TenantContext {
  tenantId: string;
  userId?: string;
  userRole?: string;
  /** Server-side promo code. Never model-supplied — see contract.ts. */
  promoCode?: string;
  /**
   * Normalised caller locale. Unlike tenantId/userId this MAY originate from the
   * client — it is a preference, not a permission. Always store the canonical form
   * from normalizeLocale(); undefined falls back to the tenant's localeRule.default.
   */
  locale?: SupportedLocale;
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
