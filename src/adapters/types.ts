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

export interface Adapter {
  searchPlans(
    req: CanonicalSearchPlansRequest,
    ctx: ResolvedContext,
  ): Promise<CanonicalSearchPlansResponse>;

  getPricing(
    req: CanonicalPricingRequest,
    ctx: ResolvedContext,
  ): Promise<CanonicalPricingResponse>;

  getCoverage(
    req: CanonicalCoverageRequest,
    ctx: ResolvedContext,
  ): Promise<CanonicalCoverageResponse>;

  checkOrderStatus(
    req: CanonicalOrderStatusRequest,
    ctx: ResolvedContext,
  ): Promise<CanonicalOrderStatusResponse>;
}
