import { z } from 'zod';
export declare const TenantRecordSchema: z.ZodObject<{
    tenantId: z.ZodString;
    displayName: z.ZodString;
    family: z.ZodEnum<["website", "legacy_app", "portal"]>;
    source: z.ZodString;
    platformValue: z.ZodString;
    platformOverrides: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    baseUrls: z.ZodObject<{
        dispatcher: z.ZodString;
        restOrder: z.ZodOptional<z.ZodString>;
        restCharges: z.ZodOptional<z.ZodString>;
        crmHost: z.ZodOptional<z.ZodString>;
        extApi: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        dispatcher: string;
        restOrder?: string | undefined;
        restCharges?: string | undefined;
        crmHost?: string | undefined;
        extApi?: string | undefined;
    }, {
        dispatcher: string;
        restOrder?: string | undefined;
        restCharges?: string | undefined;
        crmHost?: string | undefined;
        extApi?: string | undefined;
    }>;
    auth: z.ZodObject<{
        mode: z.ZodEnum<["shared_secret", "bearer_token", "none"]>;
        sharedSecretRef: z.ZodOptional<z.ZodString>;
        encryption: z.ZodOptional<z.ZodObject<{
            enabled: z.ZodBoolean;
            keyRef: z.ZodString;
            algorithm: z.ZodLiteral<"aes-256-cbc">;
        }, "strip", z.ZodTypeAny, {
            enabled: boolean;
            keyRef: string;
            algorithm: "aes-256-cbc";
        }, {
            enabled: boolean;
            keyRef: string;
            algorithm: "aes-256-cbc";
        }>>;
    }, "strip", z.ZodTypeAny, {
        mode: "shared_secret" | "bearer_token" | "none";
        sharedSecretRef?: string | undefined;
        encryption?: {
            enabled: boolean;
            keyRef: string;
            algorithm: "aes-256-cbc";
        } | undefined;
    }, {
        mode: "shared_secret" | "bearer_token" | "none";
        sharedSecretRef?: string | undefined;
        encryption?: {
            enabled: boolean;
            keyRef: string;
            algorithm: "aes-256-cbc";
        } | undefined;
    }>;
    rateTableId: z.ZodOptional<z.ZodString>;
    localeRule: z.ZodObject<{
        default: z.ZodString;
        remap: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        default: string;
        remap?: Record<string, string> | undefined;
    }, {
        default: string;
        remap?: Record<string, string> | undefined;
    }>;
    allowedTools: z.ZodArray<z.ZodString, "many">;
    rateLimit: z.ZodObject<{
        requestsPerMinute: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        requestsPerMinute: number;
    }, {
        requestsPerMinute: number;
    }>;
    partnerBrand: z.ZodOptional<z.ZodObject<{
        fieldName: z.ZodString;
        value: z.ZodString;
        orderType: z.ZodOptional<z.ZodString>;
        deviceTypeOverride: z.ZodOptional<z.ZodString>;
        shippingTypeOverride: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        value: string;
        fieldName: string;
        orderType?: string | undefined;
        deviceTypeOverride?: string | undefined;
        shippingTypeOverride?: string | undefined;
    }, {
        value: string;
        fieldName: string;
        orderType?: string | undefined;
        deviceTypeOverride?: string | undefined;
        shippingTypeOverride?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    tenantId: string;
    displayName: string;
    family: "website" | "legacy_app" | "portal";
    source: string;
    platformValue: string;
    baseUrls: {
        dispatcher: string;
        restOrder?: string | undefined;
        restCharges?: string | undefined;
        crmHost?: string | undefined;
        extApi?: string | undefined;
    };
    auth: {
        mode: "shared_secret" | "bearer_token" | "none";
        sharedSecretRef?: string | undefined;
        encryption?: {
            enabled: boolean;
            keyRef: string;
            algorithm: "aes-256-cbc";
        } | undefined;
    };
    localeRule: {
        default: string;
        remap?: Record<string, string> | undefined;
    };
    allowedTools: string[];
    rateLimit: {
        requestsPerMinute: number;
    };
    platformOverrides?: Record<string, string> | undefined;
    rateTableId?: string | undefined;
    partnerBrand?: {
        value: string;
        fieldName: string;
        orderType?: string | undefined;
        deviceTypeOverride?: string | undefined;
        shippingTypeOverride?: string | undefined;
    } | undefined;
}, {
    tenantId: string;
    displayName: string;
    family: "website" | "legacy_app" | "portal";
    source: string;
    platformValue: string;
    baseUrls: {
        dispatcher: string;
        restOrder?: string | undefined;
        restCharges?: string | undefined;
        crmHost?: string | undefined;
        extApi?: string | undefined;
    };
    auth: {
        mode: "shared_secret" | "bearer_token" | "none";
        sharedSecretRef?: string | undefined;
        encryption?: {
            enabled: boolean;
            keyRef: string;
            algorithm: "aes-256-cbc";
        } | undefined;
    };
    localeRule: {
        default: string;
        remap?: Record<string, string> | undefined;
    };
    allowedTools: string[];
    rateLimit: {
        requestsPerMinute: number;
    };
    platformOverrides?: Record<string, string> | undefined;
    rateTableId?: string | undefined;
    partnerBrand?: {
        value: string;
        fieldName: string;
        orderType?: string | undefined;
        deviceTypeOverride?: string | undefined;
        shippingTypeOverride?: string | undefined;
    } | undefined;
}>;
export type TenantRecord = z.infer<typeof TenantRecordSchema>;
//# sourceMappingURL=schema.d.ts.map