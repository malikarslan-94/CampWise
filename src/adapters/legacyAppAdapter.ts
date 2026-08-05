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
import { encrypt } from '../lib/crypto.js';
import { resolveLanguage, mapPlan } from './shared.js';

/**
 * Builds the dispatcher body for the legacy-app family.
 * When encryption is enabled, the inner payload is AES-256-CBC encrypted
 * and sent as the `data` field. The outer envelope carries source/platform/language.
 */
function buildDispatchBody(
  requestType: string,
  innerPayload: Record<string, unknown>,
  ctx: ResolvedContext,
): Record<string, unknown> {
  const enc = ctx.record.auth.encryption;
  const base: Record<string, unknown> = {
    requestType,
    source: ctx.record.source,
    platform: ctx.record.platformValue, // always "app" for this family
    language: resolveLanguage(ctx),
  };

  if (enc?.enabled && ctx.resolvedSecrets.aesKey) {
    base.data = encrypt(innerPayload, ctx.resolvedSecrets.aesKey);
  } else {
    Object.assign(base, innerPayload);
  }

  return base;
}

export const legacyAppAdapter: Adapter = {
  async searchPlans(req: CanonicalSearchPlansRequest, ctx: ResolvedContext): Promise<CanonicalSearchPlansResponse> {
    const inner = {
      origin: req.originCountry,
      travelingTo: req.destinationCountries,
      deviceType: req.deviceType,
      promoCode: req.promoCode,
      userId: req.userId,
    };

    const body = buildDispatchBody('localPlans', inner, ctx);
    const res = await httpPost<Record<string, unknown>>(ctx.record.baseUrls.dispatcher, {
      body,
      logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'search_plans', family: 'legacy_app' },
    });

    const rawPlans = Array.isArray(res.data?.data) ? res.data.data as Record<string, unknown>[] :
                     Array.isArray(res.data?.plans) ? res.data.plans as Record<string, unknown>[] : [];

    return { ok: true, plans: rawPlans.map(mapPlan) };
  },

  async getPricing(_req: CanonicalPricingRequest, ctx: ResolvedContext): Promise<CanonicalPricingResponse> {
    // Legacy app family does not have a server-side charges endpoint in Phase 1.
    // Per spec: return ok:false with a clear message — never fabricate a price.
    return {
      ok: false,
      message: 'Real-time pricing is not available for this platform. Please check the app for current prices.',
    };
  },

  async getCoverage(req: CanonicalCoverageRequest, ctx: ResolvedContext): Promise<CanonicalCoverageResponse> {
    const inner = {
      planCode: req.planCode,
      countryCode: req.destinationCountry,
    };

    const body = buildDispatchBody('planCountries', inner, ctx);
    const res = await httpPost<Record<string, unknown>>(ctx.record.baseUrls.dispatcher, {
      body,
      logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'get_coverage', family: 'legacy_app' },
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
    };
  },

  async checkOrderStatus(req: CanonicalOrderStatusRequest, ctx: ResolvedContext): Promise<CanonicalOrderStatusResponse> {
    const inner = {
      userId: req.userId,
      phone: req.phone,
      orderId: req.orderId,
    };

    const body = buildDispatchBody('getUserOrders', inner, ctx);
    const res = await httpPost<Record<string, unknown>>(ctx.record.baseUrls.dispatcher, {
      body,
      logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'check_order_status', family: 'legacy_app' },
    });

    const rawOrders = Array.isArray(res.data?.data) ? (res.data.data as Record<string, unknown>[]) : [];

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
    };
  },
};
