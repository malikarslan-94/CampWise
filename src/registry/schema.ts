import { z } from 'zod';

export const TenantRecordSchema = z.object({
  tenantId: z.string().min(1),
  displayName: z.string().min(1),
  family: z.enum(['website', 'legacy_app', 'portal']),
  source: z.string().min(1),
  platformValue: z.string().min(1),
  platformOverrides: z.record(z.string(), z.string()).optional(),
  baseUrls: z.object({
    dispatcher: z.string().url(),
    restOrder: z.string().url().optional(),
    restCharges: z.string().url().optional(),
    crmHost: z.string().optional(),
    extApi: z.string().optional(),
  }),
  auth: z.object({
    mode: z.enum(['shared_secret', 'bearer_token', 'none']),
    sharedSecretRef: z.string().optional(),
    encryption: z
      .object({
        enabled: z.boolean(),
        keyRef: z.string(),
        algorithm: z.literal('aes-256-cbc'),
      })
      .optional(),
  }),
  rateTableId: z.string().optional(),
  localeRule: z.object({
    default: z.string(),
    remap: z.record(z.string(), z.string()).optional(),
  }),
  allowedTools: z.array(z.string()).min(1),
  /**
   * Whether this tenant is reachable from the browser-facing chat endpoint.
   *
   * Origin (web) and the surface parameter (mobile) are both forgeable by a script,
   * so we do not try to make forging impossible — we make it worthless. Only tenants
   * whose data is already public on their own site are opted in here. B2B portals
   * (confidential partner rates) and the staff CRM stay false, so a forged origin can
   * only ever reach another public price list.
   *
   * Defaults to false: a tenant must opt in explicitly.
   */
  publicChat: z.boolean().default(false),
  /**
   * Exact origins that resolve to this tenant, e.g. "https://yoowifi.com".
   * Drives both tenant derivation and the CORS allowlist. Required when
   * publicChat is true — see refineTenantRecord below.
   */
  allowedOrigins: z.array(z.string()).default([]),
  rateLimit: z.object({
    requestsPerMinute: z.number().int().positive(),
  }),
  partnerBrand: z
    .object({
      fieldName: z.string(),
      value: z.string(),
      orderType: z.string().optional(),
      deviceTypeOverride: z.string().optional(),
      shippingTypeOverride: z.string().optional(),
    })
    .optional(),
})
  // A chat-enabled tenant with no origins is unreachable and, worse, looks configured.
  // Fail at startup rather than silently serving nobody.
  .refine((r) => !r.publicChat || r.allowedOrigins.length > 0, {
    message: 'publicChat is true but allowedOrigins is empty — the tenant would be unreachable',
    path: ['allowedOrigins'],
  });

export type TenantRecord = z.infer<typeof TenantRecordSchema>;
