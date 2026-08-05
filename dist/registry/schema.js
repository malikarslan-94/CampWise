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
});
//# sourceMappingURL=schema.js.map