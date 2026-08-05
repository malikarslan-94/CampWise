import type { CanonicalPlan, CanonicalSearchPlansRequest, CanonicalPricingRequest, CanonicalPricingResponse } from '../canonical/contract.js';
import type { ResolvedContext } from '../resolver/types.js';
/**
 * Re-verifies that a plan still exists and its price matches the original result.
 * Calls the adapter's searchPlans with a narrowed request (same origin/destination)
 * and looks for the planCode in the returned list.
 *
 * Returns false if the plan is not found or the price diverges.
 */
export declare function groundPlan(plan: CanonicalPlan, originalRequest: CanonicalSearchPlansRequest, ctx: ResolvedContext): Promise<boolean>;
/**
 * Re-verifies a pricing result by re-calling the charges endpoint with the same
 * request and confirming the total has not changed.
 *
 * Returns false if the upstream rejects, returns ok:false, or the totalAmount
 * differs from the original result. Only called when the original result.ok is true.
 */
export declare function groundPricingResult(originalResult: CanonicalPricingResponse, req: CanonicalPricingRequest, ctx: ResolvedContext): Promise<boolean>;
//# sourceMappingURL=grounding.d.ts.map