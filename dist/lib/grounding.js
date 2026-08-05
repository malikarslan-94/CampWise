import { getLogger } from './logger.js';
const PRICE_TOLERANCE = 0; // exact match required
/**
 * Re-verifies that a plan still exists and its price matches the original result.
 * Calls the adapter's searchPlans with a narrowed request (same origin/destination)
 * and looks for the planCode in the returned list.
 *
 * Returns false if the plan is not found or the price diverges.
 */
export async function groundPlan(plan, originalRequest, ctx) {
    const logger = getLogger({
        tenantId: ctx.tenantContext.tenantId,
        toolName: ctx.tenantContext.toolName,
        requestId: ctx.tenantContext.requestId,
    });
    try {
        const verifyReq = {
            originCountry: originalRequest.originCountry,
            destinationCountries: originalRequest.destinationCountries,
        };
        const verifyRes = await ctx.adapter.searchPlans(verifyReq, ctx);
        if (!verifyRes.ok)
            return false;
        const match = verifyRes.plans.find((p) => p.planCode === plan.planCode);
        if (!match) {
            logger.warn({ planCode: plan.planCode, event: 'grounding_mismatch', reason: 'plan_not_found' }, 'grounding_mismatch');
            return false;
        }
        if (Math.abs(match.price - plan.price) > PRICE_TOLERANCE) {
            logger.warn({ planCode: plan.planCode, event: 'grounding_mismatch', reason: 'price_changed', originalPrice: plan.price, newPrice: match.price }, 'grounding_mismatch');
            return false;
        }
        return true;
    }
    catch (err) {
        logger.warn({ planCode: plan.planCode, event: 'grounding_mismatch', reason: 'error', err: String(err) }, 'grounding_mismatch');
        return false;
    }
}
/**
 * Re-verifies a pricing result by re-calling the charges endpoint with the same
 * request and confirming the total has not changed.
 *
 * Returns false if the upstream rejects, returns ok:false, or the totalAmount
 * differs from the original result. Only called when the original result.ok is true.
 */
export async function groundPricingResult(originalResult, req, ctx) {
    const logger = getLogger({
        tenantId: ctx.tenantContext.tenantId,
        requestId: ctx.tenantContext.requestId,
        planCode: req.planCode,
    });
    try {
        const verifyRes = await ctx.adapter.getPricing(req, ctx);
        if (!verifyRes.ok) {
            logger.warn({ planCode: req.planCode, event: 'pricing_grounding_failed', reason: 'upstream_not_ok' }, 'pricing_grounding_failed');
            return false;
        }
        if (originalResult.totalAmount !== undefined &&
            verifyRes.totalAmount !== undefined &&
            Math.abs(verifyRes.totalAmount - originalResult.totalAmount) > PRICE_TOLERANCE) {
            logger.warn({
                planCode: req.planCode,
                event: 'pricing_grounding_failed',
                reason: 'price_changed',
                originalAmount: originalResult.totalAmount,
                newAmount: verifyRes.totalAmount,
            }, 'pricing_grounding_failed');
            return false;
        }
        return true;
    }
    catch (err) {
        logger.warn({ planCode: req.planCode, event: 'pricing_grounding_failed', reason: 'error', err: String(err) }, 'pricing_grounding_failed');
        return false;
    }
}
//# sourceMappingURL=grounding.js.map