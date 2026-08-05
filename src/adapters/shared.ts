import type { ResolvedContext } from '../resolver/types.js';
import type { CanonicalPlan } from '../canonical/contract.js';
import { toUpstreamLanguage } from '../lib/locale.js';

/**
 * Resolves the language code to send upstream.
 *
 * Precedence: the caller's normalised locale, else the tenant's configured default.
 * The tenant's `remap` is applied last, as a per-tenant escape hatch for an upstream
 * that wants a different code than the shared table produces.
 */
export function resolveLanguage(ctx: ResolvedContext): string {
  const { localeRule } = ctx.record;
  const locale = ctx.tenantContext.locale;
  const lang = locale ? toUpstreamLanguage(locale) : localeRule.default;
  return localeRule.remap?.[lang] ?? lang;
}

/** Coerces an optional upstream field to a string, treating empty as absent. */
function optionalString(v: unknown): string | undefined {
  return v === undefined || v === null || v === '' ? undefined : String(v);
}

/**
 * Maps a raw upstream plan object to the canonical shape.
 *
 * Upstream returns both a base name/description and pre-translated variants
 * (`trPlanName` / `trDescription`) when the request carried a language. Both are
 * carried through — the caller decides which to show, and the model is told never
 * to translate either, since a translated plan name is one the user cannot find.
 */
export function mapPlan(raw: Record<string, unknown>): CanonicalPlan {
  const variations = Array.isArray(raw.variations)
    ? (raw.variations as Record<string, unknown>[]).map((v) => ({
        variationId: (v.variationId ?? v.variation_id ?? v.id) as string | number,
        packageCode: v.packageCode as string | undefined,
        dataSize: v.dataSize as string | undefined,
        days: v.days as number | undefined,
        price: Number(v.price ?? 0),
      }))
    : [];

  return {
    planCode: String(raw.planCode ?? raw.plan_code ?? ''),
    planName: String(raw.planName ?? raw.plan_name ?? ''),
    planNameLocalized: optionalString(raw.trPlanName ?? raw.tr_plan_name),
    productType: String(raw.productType ?? raw.product_type ?? ''),
    description: optionalString(raw.description),
    descriptionLocalized: optionalString(raw.trDescription ?? raw.tr_description),
    dataVolume: raw.dataVolume as string | undefined,
    validityDays: raw.validityDays as number | undefined,
    price: Number(raw.price ?? 0),
    currency: String(raw.currency ?? 'USD'),
    variations,
  };
}
