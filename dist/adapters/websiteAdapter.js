import { httpPost } from '../lib/httpClient.js';
function resolveLanguage(ctx) {
    const { localeRule } = ctx.record;
    const lang = localeRule.default;
    if (localeRule.remap?.[lang])
        return localeRule.remap[lang];
    return lang;
}
function buildEnvelope(ctx, extras = {}) {
    return {
        source: ctx.record.source,
        platform: ctx.record.platformValue,
        language: resolveLanguage(ctx),
        ...extras,
    };
}
// Maps a raw upstream plan object to the canonical shape.
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
export const websiteAdapter = {
    async searchPlans(req, ctx) {
        const body = buildEnvelope(ctx, {
            requestType: 'localPlans',
            userId: req.userId,
            origin: req.originCountry,
            travelingTo: req.destinationCountries,
            deviceType: req.deviceType,
            promoCode: req.promoCode,
        });
        const res = await httpPost(ctx.record.baseUrls.dispatcher, {
            body,
            logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'search_plans', family: 'website' },
        });
        const rawPlans = Array.isArray(res.data?.data) ? res.data.data :
            Array.isArray(res.data?.plans) ? res.data.plans : [];
        return {
            ok: true,
            plans: rawPlans.map(mapPlan),
            message: res.data?.message,
        };
    },
    async getPricing(req, ctx) {
        const chargesUrl = ctx.record.baseUrls.restCharges;
        if (!chargesUrl) {
            return { ok: false, message: 'Pricing endpoint not configured for this tenant.' };
        }
        const body = {
            orderType: 'buy-esim',
            memberId: req.userId,
            quantity: req.quantity,
            planCode: req.planCode,
            packageCode: req.packageCode,
            variationId: req.variationId,
            travelDetails: req.travelDetails,
            pgw: req.paymentGateway,
            userId: req.userId,
            appUserId: req.appUserId,
            promoCode: req.promoCode,
            source: ctx.record.source,
            platform: ctx.record.platformValue,
        };
        const res = await httpPost(chargesUrl, {
            body,
            logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'get_pricing', family: 'website' },
        });
        const d = (res.data?.data ?? res.data);
        return {
            ok: true,
            totalAmount: Number(d?.totalAmount ?? d?.total_amount ?? 0),
            currency: String(d?.currency ?? 'USD'),
            promoDiscount: d?.promoDiscount !== undefined ? Number(d.promoDiscount) : undefined,
            perCountryBreakdown: Array.isArray(d?.breakdown) ? d.breakdown : undefined,
            quoteValidUntil: d?.quoteValidUntil,
            message: res.data?.message,
        };
    },
    async getCoverage(req, ctx) {
        const body = buildEnvelope(ctx, {
            requestType: 'planCountries',
            planCode: req.planCode,
            countryCode: req.destinationCountry,
        });
        const res = await httpPost(ctx.record.baseUrls.dispatcher, {
            body,
            logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'get_coverage', family: 'website' },
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
            message: res.data?.message,
        };
    },
    async checkOrderStatus(req, ctx) {
        const body = buildEnvelope(ctx, {
            requestType: 'getUserOrders',
            userId: req.userId,
            phone: req.phone,
            orderId: req.orderId,
        });
        const res = await httpPost(ctx.record.baseUrls.dispatcher, {
            body,
            logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'check_order_status', family: 'website' },
        });
        const rawOrders = Array.isArray(res.data?.data)
            ? res.data.data
            : [];
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
            message: res.data?.message,
        };
    },
};
//# sourceMappingURL=websiteAdapter.js.map