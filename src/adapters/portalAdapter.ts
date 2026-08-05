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
import { resolveLanguage, mapPlan } from './shared.js';

const PORTAL_EXT_SOURCES = new Set(['tune', 'myrp']);

/**
 * Returns the correct host for this portal tenant.
 * tune/myrp sources route to extApi; all others use the standard dispatcher.
 */
function resolveHost(ctx: ResolvedContext): string {
  if (PORTAL_EXT_SOURCES.has(ctx.record.source) && ctx.record.baseUrls.extApi) {
    return ctx.record.baseUrls.extApi;
  }
  return ctx.record.baseUrls.dispatcher;
}

/**
 * Resolves the effective platform value for a given requestType.
 * platformOverrides take priority over the default platformValue.
 */
function resolvePlatform(requestType: string, ctx: ResolvedContext): string {
  return ctx.record.platformOverrides?.[requestType] ?? ctx.record.platformValue;
}

/**
 * Builds the portal request body with the shared secret injected as `security`.
 * IMPORTANT: callers MUST call stripSecurity(body) after the httpPost returns so
 * the secret does not persist on any object that outlives the call.
 * `security` must never appear in logs — logContext must never include body.
 */
function buildPortalBody(
  requestType: string,
  payload: Record<string, unknown>,
  ctx: ResolvedContext,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    requestType,
    source: ctx.record.source,
    platform: resolvePlatform(requestType, ctx),
    language: resolveLanguage(ctx),
    ...payload,
  };

  if (ctx.resolvedSecrets.sharedSecret) {
    body['security'] = ctx.resolvedSecrets.sharedSecret;
  }

  return body;
}

/** Removes the `security` field from a portal body after it has been sent. */
function stripSecurity(body: Record<string, unknown>): void {
  delete body['security'];
}

export const portalAdapter: Adapter = {
  async searchPlans(req: CanonicalSearchPlansRequest, ctx: ResolvedContext): Promise<CanonicalSearchPlansResponse> {
    // localPlans uses platform override "crm" for tune/portal family
    const body = buildPortalBody('localPlans', {
      origin: req.originCountry,
      travelingTo: req.destinationCountries,
      deviceType: req.deviceType,
      promoCode: req.promoCode,
      userId: req.userId,
    }, ctx);

    const host = resolveHost(ctx);
    const res = await httpPost<Record<string, unknown>>(host, {
      body,
      logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'search_plans', family: 'portal' },
    });
    stripSecurity(body);

    const rawPlans = Array.isArray(res.data?.data) ? res.data.data as Record<string, unknown>[] :
                     Array.isArray(res.data?.plans) ? res.data.plans as Record<string, unknown>[] : [];

    return { ok: true, plans: rawPlans.map(mapPlan) };
  },

  async getPricing(req: CanonicalPricingRequest, ctx: ResolvedContext): Promise<CanonicalPricingResponse> {
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

    const res = await httpPost<Record<string, unknown>>(chargesUrl, {
      body,
      logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'get_pricing', family: 'portal' },
    });
    stripSecurity(body);

    const d = (res.data?.data ?? res.data) as Record<string, unknown>;
    return {
      ok: true,
      totalAmount: Number(d?.totalAmount ?? d?.total_amount ?? 0),
      currency: String(d?.currency ?? 'USD'),
      promoDiscount: d?.promoDiscount !== undefined ? Number(d.promoDiscount) : undefined,
      quoteValidUntil: d?.quoteValidUntil as string | undefined,
    };
  },

  async getCoverage(req: CanonicalCoverageRequest, ctx: ResolvedContext): Promise<CanonicalCoverageResponse> {
    const body = buildPortalBody('planCountries', {
      planCode: req.planCode,
      countryCode: req.destinationCountry,
    }, ctx);

    const host = resolveHost(ctx);
    const res = await httpPost<Record<string, unknown>>(host, {
      body,
      logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'get_coverage', family: 'portal' },
    });
    stripSecurity(body);

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
    const body = buildPortalBody('getUserOrders', {
      userId: req.userId,
      phone: req.phone,
      orderId: req.orderId,
    }, ctx);

    const host = resolveHost(ctx);
    const res = await httpPost<Record<string, unknown>>(host, {
      body,
      logContext: { tenantId: ctx.tenantContext.tenantId, toolName: 'check_order_status', family: 'portal' },
    });
    stripSecurity(body);

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
