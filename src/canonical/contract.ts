import { z } from 'zod';

// ── Shared ────────────────────────────────────────────────────────────────────

export const CanonicalVariationSchema = z.object({
  variationId: z.union([z.string(), z.number()]),
  packageCode: z.string().optional(),
  dataSize: z.string().optional(),
  days: z.number().int().positive().optional(),
  price: z.number(),
});
export type CanonicalVariation = z.infer<typeof CanonicalVariationSchema>;

export const CanonicalPlanSchema = z.object({
  planCode: z.string(),
  planName: z.string(),
  /** Upstream's pre-translated name (`trPlanName`), when the request carried a language. */
  planNameLocalized: z.string().optional(),
  productType: z.string(),
  description: z.string().optional(),
  /** Upstream's pre-translated description (`trDescription`). */
  descriptionLocalized: z.string().optional(),
  dataVolume: z.string().optional(),
  validityDays: z.number().int().positive().optional(),
  price: z.number(),
  currency: z.string(),
  variations: z.array(CanonicalVariationSchema),
});
export type CanonicalPlan = z.infer<typeof CanonicalPlanSchema>;

// ── search_plans ──────────────────────────────────────────────────────────────

// NOTE: `userId` and `promoCode` below are set SERVER-SIDE from TenantContext.
// They are deliberately absent from the model-facing tool input schemas — any field
// a tool exposes is a field the model can fill from the conversation, which would
// make impersonation and promo-code guessing a one-sentence prompt.
export const CanonicalSearchPlansRequestSchema = z.object({
  originCountry: z.string().length(2, 'Must be ISO-2 country code'),
  destinationCountries: z.array(z.string().length(2)).min(1),
  durationDays: z.number().int().positive().optional(),
  deviceType: z.enum(['esim', 'device', 'sim']).optional(),
  promoCode: z.string().optional(),
  userId: z.string().optional(),
});
export type CanonicalSearchPlansRequest = z.infer<typeof CanonicalSearchPlansRequestSchema>;

export const CanonicalSearchPlansResponseSchema = z.object({
  ok: z.boolean(),
  plans: z.array(CanonicalPlanSchema),
  message: z.string().optional(),
});
export type CanonicalSearchPlansResponse = z.infer<typeof CanonicalSearchPlansResponseSchema>;

// ── get_pricing ───────────────────────────────────────────────────────────────

export const TravelDetailSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  countryCode: z.string(),
  countryName: z.string().optional(),
});
export type TravelDetail = z.infer<typeof TravelDetailSchema>;

export const CanonicalPricingRequestSchema = z.object({
  planCode: z.string(),
  packageCode: z.string().optional(),
  variationId: z.union([z.string(), z.number()]).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  destinationCountries: z.array(z.string().length(2)).min(1),
  travelDetails: z.array(TravelDetailSchema),
  quantity: z.number().int().positive(),
  promoCode: z.string().optional(),
  userId: z.string().optional(),
  appUserId: z.string().optional(),
  paymentGateway: z.string().optional(),
});
export type CanonicalPricingRequest = z.infer<typeof CanonicalPricingRequestSchema>;

export const PerCountryBreakdownSchema = z.object({
  countryCode: z.string(),
  days: z.number(),
  rate: z.number(),
  charges: z.number(),
});

export const CanonicalPricingResponseSchema = z.object({
  ok: z.boolean(),
  totalAmount: z.number().optional(),
  currency: z.string().optional(),
  promoDiscount: z.number().optional(),
  perCountryBreakdown: z.array(PerCountryBreakdownSchema).optional(),
  quoteValidUntil: z.string().optional(),
  message: z.string().optional(),
});
export type CanonicalPricingResponse = z.infer<typeof CanonicalPricingResponseSchema>;

// ── get_coverage ──────────────────────────────────────────────────────────────

export const CanonicalCoverageRequestSchema = z.object({
  planCode: z.string().optional(),
  destinationCountry: z.string().length(2).optional(),
});
export type CanonicalCoverageRequest = z.infer<typeof CanonicalCoverageRequestSchema>;

export const CoverageCountrySchema = z.object({
  countryCode: z.string(),
  countryName: z.string(),
  region: z.string().optional(),
  rate: z.number().optional(),
});

export const CanonicalCoverageResponseSchema = z.object({
  ok: z.boolean(),
  countries: z.array(CoverageCountrySchema),
  message: z.string().optional(),
});
export type CanonicalCoverageResponse = z.infer<typeof CanonicalCoverageResponseSchema>;

// ── check_order_status ────────────────────────────────────────────────────────

export const CanonicalOrderStatusRequestSchema = z.object({
  userId: z.string(),
  phone: z.string().optional(),
  orderId: z.string().optional(),
});
export type CanonicalOrderStatusRequest = z.infer<typeof CanonicalOrderStatusRequestSchema>;

export const OrderSchema = z.object({
  orderId: z.string(),
  orderStatus: z.string(),
  planCode: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  deviceType: z.string().optional(),
  travelingTo: z.string().optional(),
});

export const CanonicalOrderStatusResponseSchema = z.object({
  ok: z.boolean(),
  orders: z.array(OrderSchema),
  message: z.string().optional(),
});
export type CanonicalOrderStatusResponse = z.infer<typeof CanonicalOrderStatusResponseSchema>;
