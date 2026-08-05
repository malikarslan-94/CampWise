import { httpPost } from '../lib/httpClient.js';
const PORTAL_EXT_SOURCES = new Set(['tune', 'myrp']);
/**
 * Returns the correct host for this portal tenant.
 * tune/myrp sources route to extApi; all others use the standard dispatcher.
 */
function resolveHost(ctx) {
    if (PORTAL_EXT_SOURCES.has(ctx.record.source) && ctx.record.baseUrls.extApi) {
        return ctx.record.baseUrls.extApi;
    }
    return ctx.record.baseUrls.dispatcher;
}
/**
 * Resolves the effective platform value for a given requestType.
 * platformOverrides take priority over the default platformValue.
 */
function resolvePlatform(requestType, ctx) {
    return ctx.record.platformOverrides?.[requestType] ?? ctx.record.platformValue;
}
/**
 * Builds the portal request body with the shared secret injected as `security`.
 * IMPORTANT: callers MUST call stripSecurity(body) after the httpPost returns so
 * the secret does not persist on any object that outlives the call.
 * `security` must never appear in logs — logContext must never include body.
 */
function buildPortalBody(requestType, payload, ctx) {
    const body = {
        requestType,
        source: ctx.record.source,
        platform: resolvePlatform(requestType, ctx),
        ...payload,
    };
    if (ctx.resolvedSecrets.sharedSecret) {
        body['security'] = ctx.resolvedSecrets.sharedSecret;
    }
    return body;
}
/** Removes the `security` field from a portal body after it has been sent. */
function stripSecurity(body) {
    delete body['security'];
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
export const portalAdapter = {
    async searchPlans(req, ctx) {
        // localPlans uses platform override "crm" for tune/portal family
        const body = buildPortalBody('localPlans', {
            origin: req.originCountry,
            travelingTo: req.destinationCountries,
            deviceType: req.deviceType,
            promoCode: req.promoCode,
            userId: req.userId,
        }, ctx);
        const host = resolveHost(ctx);
        const res = await httpPost(host, {
            body,
            logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'search_plans', family: 'portal' },
        });
        stripSecurity(body);
        const rawPlans = Array.isArray(res.data?.data) ? res.data.data :
            Array.isArray(res.data?.plans) ? res.data.plans : [];
        return { ok: true, plans: rawPlans.map(mapPlan) };
    },
    async getPricing(req, ctx) {
        const chargesUrl = ctx.record.baseUrls.restCharges ?? resolveHost(ctx);
        const body = buildPortalBody('getCharges', {
            planCode: req.planCode,
            packageCode: req.packageCode,
            variationId: req.variationId,
            quantity: req.quantity,
            travelDetails: req.travelDetails,
            promoCode: req.promoCode,
            userId: req.userId,
            appUserId: req.appUserId,
        }, ctx);
        const res = await httpPost(chargesUrl, {
            body,
            logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'get_pricing', family: 'portal' },
        });
        stripSecurity(body);
        const d = (res.data?.data ?? res.data);
        return {
            ok: true,
            totalAmount: Number(d?.totalAmount ?? d?.total_amount ?? 0),
            currency: String(d?.currency ?? 'USD'),
            promoDiscount: d?.promoDiscount !== undefined ? Number(d.promoDiscount) : undefined,
            quoteValidUntil: d?.quoteValidUntil,
        };
    },
    async getCoverage(req, ctx) {
        const body = buildPortalBody('planCountries', {
            planCode: req.planCode,
            countryCode: req.destinationCountry,
        }, ctx);
        const host = resolveHost(ctx);
        const res = await httpPost(host, {
            body,
            logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'get_coverage', family: 'portal' },
        });
        stripSecurity(body);
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
        const body = buildPortalBody('getUserOrders', {
            userId: req.userId,
            phone: req.phone,
            orderId: req.orderId,
        }, ctx);
        const host = resolveHost(ctx);
        const res = await httpPost(host, {
            body,
            logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'check_order_status', family: 'portal' },
        });
        stripSecurity(body);
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
//# sourceMappingURL=portalAdapter.js.map