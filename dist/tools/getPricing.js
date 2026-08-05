import { z } from 'zod';
import { resolve } from '../resolver/resolver.js';
import { toSafeMessage } from '../lib/errors.js';
import { checkRateLimit } from '../middleware/rateLimit.js';
import { requireTenantContext } from '../middleware/tenantAuth.js';
import { getLogger } from '../lib/logger.js';
import { CanonicalPricingRequestSchema } from '../canonical/contract.js';
import { groundPricingResult } from '../lib/grounding.js';
export const getPricingToolName = 'get_pricing';
export const getPricingInputSchema = z.object({
    planCode: z.string().describe('The plan code to price'),
    packageCode: z.string().optional(),
    variationId: z.union([z.string(), z.number()]).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Trip start date YYYY-MM-DD'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Trip end date YYYY-MM-DD'),
    destinationCountries: z.array(z.string().length(2)).min(1),
    travelDetails: z.array(z.object({
        startDate: z.string(),
        endDate: z.string(),
        countryCode: z.string(),
        countryName: z.string().optional(),
    })),
    quantity: z.number().int().positive().default(1),
    promoCode: z.string().optional(),
    userId: z.string().optional(),
    appUserId: z.string().optional(),
    paymentGateway: z.string().optional(),
});
export const getPricingToolDef = {
    name: getPricingToolName,
    description: 'Get the authoritative server-calculated total price for a specific plan and trip configuration, including any promo discount. Use this to confirm exact pricing before recommending a plan to buy.',
    inputSchema: getPricingInputSchema,
};
export async function handleGetPricing(args) {
    const tenantContext = requireTenantContext();
    const logger = getLogger({ tenantId: tenantContext.tenantId, toolName: getPricingToolName, requestId: tenantContext.requestId });
    const start = Date.now();
    try {
        const parsed = CanonicalPricingRequestSchema.safeParse(args);
        if (!parsed.success) {
            return { ok: false, message: `Invalid request: ${parsed.error.message}` };
        }
        const ctx = resolve({ ...tenantContext, toolName: getPricingToolName });
        checkRateLimit(tenantContext.tenantId, ctx.record.rateLimit.requestsPerMinute);
        const result = await ctx.adapter.getPricing(parsed.data, ctx);
        // Ground the price when the adapter returns an authoritative quote.
        // Re-verify via a second call; mismatch or error → reject rather than return stale data.
        if (result.ok) {
            const grounded = await groundPricingResult(result, parsed.data, ctx);
            if (!grounded) {
                logger.warn({ latencyMs: Date.now() - start, planCode: parsed.data.planCode }, 'pricing_grounding_failed');
                return { ok: false, message: 'Price could not be verified, please try again.' };
            }
        }
        logger.info({ latencyMs: Date.now() - start, ok: result.ok }, 'tool_complete');
        return result;
    }
    catch (err) {
        logger.error({ latencyMs: Date.now() - start, err: String(err) }, 'tool_error');
        return { ok: false, message: toSafeMessage(err) };
    }
}
//# sourceMappingURL=getPricing.js.map