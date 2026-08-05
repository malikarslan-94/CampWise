import { httpPost } from '../lib/httpClient.js';
import { encrypt } from '../lib/crypto.js';
function resolveLanguage(ctx) {
    const { localeRule } = ctx.record;
    const lang = localeRule.default;
    if (localeRule.remap?.[lang])
        return localeRule.remap[lang];
    return lang;
}
/**
 * Builds the dispatcher body for the legacy-app family.
 * When encryption is enabled, the inner payload is AES-256-CBC encrypted
 * and sent as the `data` field. The outer envelope carries source/platform/language.
 */
function buildDispatchBody(requestType, innerPayload, ctx) {
    const enc = ctx.record.auth.encryption;
    const base = {
        requestType,
        source: ctx.record.source,
        platform: ctx.record.platformValue, // always "app" for this family
        language: resolveLanguage(ctx),
    };
    if (enc?.enabled && ctx.resolvedSecrets.aesKey) {
        base.data = encrypt(innerPayload, ctx.resolvedSecrets.aesKey);
    }
    else {
        Object.assign(base, innerPayload);
    }
    return base;
}
function mapPlan(raw) {
    const variations = Array.isArray(raw.variations)
        ? raw.variations.map((v) => ({
            variationId: (v.variationId ?? v.variation_id ?? v.id),
            packageCode: v.packageCode,
            dataSize: v.dataSize,
            days: v.days,
            price: Number(v.price ?? 0),
        }))
        : [];
    return {
        planCode: String(raw.planCode ?? raw.plan_code ?? ''),
        planName: String(raw.planName ?? raw.plan_name ?? ''),
        productType: String(raw.productType ?? raw.product_type ?? ''),
        dataVolume: raw.dataVolume,
        validityDays: raw.validityDays,
        price: Number(raw.price ?? 0),
        currency: String(raw.currency ?? 'USD'),
        variations,
    };
}
export const legacyAppAdapter = {
    async searchPlans(req, ctx) {
        const inner = {
            origin: req.originCountry,
            travelingTo: req.destinationCountries,
            deviceType: req.deviceType,
            promoCode: req.promoCode,
            userId: req.userId,
        };
        const body = buildDispatchBody('localPlans', inner, ctx);
        const res = await httpPost(ctx.record.baseUrls.dispatcher, {
            body,
            logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'search_plans', family: 'legacy_app' },
        });
        const rawPlans = Array.isArray(res.data?.data) ? res.data.data :
            Array.isArray(res.data?.plans) ? res.data.plans : [];
        return { ok: true, plans: rawPlans.map(mapPlan) };
    },
    async getPricing(_req, ctx) {
        // Legacy app family does not have a server-side charges endpoint in Phase 1.
        // Per spec: return ok:false with a clear message — never fabricate a price.
        return {
            ok: false,
            message: 'Real-time pricing is not available for this platform. Please check the app for current prices.',
        };
    },
    async getCoverage(req, ctx) {
        const inner = {
            planCode: req.planCode,
            countryCode: req.destinationCountry,
        };
        const body = buildDispatchBody('planCountries', inner, ctx);
        const res = await httpPost(ctx.record.baseUrls.dispatcher, {
            body,
            logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'get_coverage', family: 'legacy_app' },
        });
        const rawCountries = Array.isArray(res.data?.data)
            ? res.data.data
            : [];
        return {
            ok: true,
            countries: rawCountries.map((c) => ({
                countryCode: String(c.countryCode ?? c.country_code ?? ''),
                countryName: String(c.countryName ?? c.country_name ?? ''),
                region: c.region,
                rate: c.rate !== undefined ? Number(c.rate) : undefined,
            })),
        };
    },
    async checkOrderStatus(req, ctx) {
        const inner = {
            userId: req.userId,
            phone: req.phone,
            orderId: req.orderId,
        };
        const body = buildDispatchBody('getUserOrders', inner, ctx);
        const res = await httpPost(ctx.record.baseUrls.dispatcher, {
            body,
            logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'check_order_status', family: 'legacy_app' },
        });
        const rawOrders = Array.isArray(res.data?.data) ? res.data.data : [];
        return {
            ok: true,
            orders: rawOrders.map((o) => ({
                orderId: String(o.orderId ?? o.order_id ?? ''),
                orderStatus: String(o.orderStatus ?? o.status ?? ''),
                planCode: o.planCode,
                startDate: o.startDate,
                endDate: o.endDate,
                deviceType: o.deviceType,
                travelingTo: o.travelingTo,
            })),
        };
    },
};
//# sourceMappingURL=legacyAppAdapter.js.map