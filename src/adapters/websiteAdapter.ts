import type { Adapter } from './types.js';
import type { ResolvedContext } from '../resolver/types.js';
import type {
  CanonicalSearchPlansRequest,
  CanonicalSearchPlansResponse,
  CanonicalPricingRequest,
  CanonicalPricingResponse,
  CanonicalCoverageRequest,
  CanonicalCoverageResponse,
  CanonicalOrderStatusRequest,
  CanonicalOrderStatusResponse,
} from '../canonical/contract.js';
import { httpPost } from '../lib/httpClient.js';
import { UpstreamError } from '../lib/errors.js';
import { resolveLanguage, mapPlan } from './shared.js';

function buildEnvelope(ctx: ResolvedContext, extras: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    source: ctx.record.source,
    platform: ctx.record.platformValue,
    language: resolveLanguage(ctx),
    ...extras,
  };
}

export const websiteAdapter: Adapter = {
  async searchPlans(req: CanonicalSearchPlansRequest, ctx: ResolvedContext): Promise<CanonicalSearchPlansResponse> {
    const body = buildEnvelope(ctx, {
      requestType: 'localPlans',
      userId: req.userId,
      origin: req.originCountry,
      travelingTo: req.destinationCountries,
      deviceType: req.deviceType,
      promoCode: req.promoCode,
    });

    const res = await httpPost<Record<string, unknown>>(ctx.record.baseUrls.dispatcher, {
      body,
      logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'search_plans', family: 'website' },
    });

    const rawPlans = Array.isArray(res.data?.data) ? res.data.data as Record<string, unknown>[] :
                     Array.isArray(res.data?.plans) ? res.data.plans as Record<string, unknown>[] : [];

    return {
      ok: true,
      plans: rawPlans.map(mapPlan),
      message: res.data?.message as string | undefined,
    };
  },

  async getPricing(req: CanonicalPricingRequest, ctx: ResolvedContext): Promise<CanonicalPricingResponse> {
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

    const res = await httpPost<Record<string, unknown>>(chargesUrl, {
      body,
      logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'get_pricing', family: 'website' },
    });

    const d = (res.data?.data ?? res.data) as Record<string, unknown>;
    return {
      ok: true,
      totalAmount: Number(d?.totalAmount ?? d?.total_amount ?? 0),
      currency: String(d?.currency ?? 'USD'),
      promoDiscount: d?.promoDiscount !== undefined ? Number(d.promoDiscount) : undefined,
      perCountryBreakdown: Array.isArray(d?.breakdown) ? d.breakdown as never : undefined,
      quoteValidUntil: d?.quoteValidUntil as string | undefined,
      message: res.data?.message as string | undefined,
    };
  },

  async getCoverage(req: CanonicalCoverageRequest, ctx: ResolvedContext): Promise<CanonicalCoverageResponse> {
    const body = buildEnvelope(ctx, {
      requestType: 'planCountries',
      planCode: req.planCode,
      countryCode: req.destinationCountry,
    });

    const res = await httpPost<Record<string, unknown>>(ctx.record.baseUrls.dispatcher, {
      body,
      logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'get_coverage', family: 'website' },
    });

    const rawCountries = Array.isArray(res.data?.data)
      ? (res.data.data as Record<string, unknown>[])
      : [];

    return {
      ok: true,
      countries: rawCountries.map((c) => ({
        countryCode: String(c.countryCode ?? c.country_code ?? ''),
        countryName: String(c.countryName ?? c.country_name ?? ''),
        region: c.region as string | undefined,
        rate: c.rate !== undefined ? Number(c.rate) : undefined,
      })),
      message: res.data?.message as string | undefined,
    };
  },

  async checkOrderStatus(req: CanonicalOrderStatusRequest, ctx: ResolvedContext): Promise<CanonicalOrderStatusResponse> {
    const body = buildEnvelope(ctx, {
      requestType: 'getUserOrders',
      userId: req.userId,
      phone: req.phone,
      orderId: req.orderId,
    });

    const res = await httpPost<Record<string, unknown>>(ctx.record.baseUrls.dispatcher, {
      body,
      logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'check_order_status', family: 'website' },
    });

    const rawOrders = Array.isArray(res.data?.data)
      ? (res.data.data as Record<string, unknown>[])
      : [];

    return {
      ok: true,
      orders: rawOrders.map((o) => ({
        orderId: String(o.orderId ?? o.order_id ?? ''),
        orderStatus: String(o.orderStatus ?? o.status ?? ''),
        planCode: o.planCode as string | undefined,
        startDate: o.startDate as string | undefined,
        endDate: o.endDate as string | undefined,
        deviceType: o.deviceType as string | undefined,
        travelingTo: o.travelingTo as string | undefined,
      })),
      message: res.data?.message as string | undefined,
    };
  },
};
