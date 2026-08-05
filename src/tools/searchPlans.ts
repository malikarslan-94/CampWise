import { z } from 'zod';
import { resolve } from '../resolver/resolver.js';
import { groundPlan } from '../lib/grounding.js';
import { toSafeMessage } from '../lib/errors.js';
import { checkRateLimit } from '../middleware/rateLimit.js';
import { requireTenantContext } from '../middleware/tenantAuth.js';
import { getLogger } from '../lib/logger.js';
import { isGroundingEnabled } from '../config.js';
import type { CanonicalSearchPlansRequest } from '../canonical/contract.js';

export const searchPlansToolName = 'search_plans';

/**
 * Model-facing input. `userId` and `promoCode` are deliberately absent — they are
 * filled from TenantContext below. A field exposed here is a field the model can
 * fill from the conversation.
 */
export const searchPlansInputSchema = z.object({
  originCountry: z.string().length(2).describe('ISO-2 country code of the traveler origin, e.g. "MY"'),
  destinationCountries: z.array(z.string().length(2)).min(1).describe('ISO-2 destination country codes'),
  durationDays: z.number().int().positive().optional().describe('Trip duration in days'),
  deviceType: z.enum(['esim', 'device', 'sim']).optional().describe('Preferred connectivity type'),
});

export const searchPlansToolDef = {
  name: searchPlansToolName,
  description:
    'Search available connectivity plans (eSIM, SIM, or pocket WiFi) for a traveler given their origin country, destination country/countries, trip duration, and optional promo code. Returns a ranked list of plans with prices.',
  inputSchema: searchPlansInputSchema,
};

export async function handleSearchPlans(args: unknown) {
  const tenantContext = requireTenantContext();
  const logger = getLogger({ tenantId: tenantContext.tenantId, toolName: searchPlansToolName, requestId: tenantContext.requestId });
  const start = Date.now();

  try {
    const parsed = searchPlansInputSchema.safeParse(args);
    if (!parsed.success) {
      return { ok: false, plans: [], message: `Invalid request: ${parsed.error.message}` };
    }

    // Identity and promo come from the trusted context, never from `args`.
    const req: CanonicalSearchPlansRequest = {
      ...parsed.data,
      userId: tenantContext.userId,
      promoCode: tenantContext.promoCode,
    };

    const ctx = resolve({ ...tenantContext, toolName: searchPlansToolName });
    checkRateLimit(tenantContext.tenantId, ctx.record.rateLimit.requestsPerMinute);

    const result = await ctx.adapter.searchPlans(req, ctx);

    let plans = result.plans;
    if (isGroundingEnabled()) {
      const groundedPlans = [];
      for (const plan of plans) {
        if (await groundPlan(plan, req, ctx)) groundedPlans.push(plan);
      }
      plans = groundedPlans;
    }

    logger.info({ latencyMs: Date.now() - start, planCount: plans.length }, 'tool_complete');
    return { ok: true, plans, message: result.message };
  } catch (err) {
    logger.error({ latencyMs: Date.now() - start, err: String(err) }, 'tool_error');
    return { ok: false, plans: [], message: toSafeMessage(err) };
  }
}
