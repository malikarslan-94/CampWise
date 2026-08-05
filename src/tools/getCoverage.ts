import { z } from 'zod';
import { resolve } from '../resolver/resolver.js';
import { toSafeMessage } from '../lib/errors.js';
import { checkRateLimit } from '../middleware/rateLimit.js';
import { requireTenantContext } from '../middleware/tenantAuth.js';
import { getLogger } from '../lib/logger.js';
import { CanonicalCoverageRequestSchema } from '../canonical/contract.js';

export const getCoverageToolName = 'get_coverage';

export const getCoverageInputSchema = z.object({
  planCode: z.string().optional().describe('Plan code to retrieve coverage for'),
  destinationCountry: z.string().length(2).optional().describe('ISO-2 destination country to check coverage'),
});

export const getCoverageToolDef = {
  name: getCoverageToolName,
  description:
    'Get the list of countries/regions a plan covers, or check connectivity coverage for a destination country.',
  inputSchema: getCoverageInputSchema,
};

export async function handleGetCoverage(args: unknown) {
  const tenantContext = requireTenantContext();
  const logger = getLogger({ tenantId: tenantContext.tenantId, toolName: getCoverageToolName, requestId: tenantContext.requestId });
  const start = Date.now();

  try {
    const parsed = CanonicalCoverageRequestSchema.safeParse(args);
    if (!parsed.success) {
      return { ok: false, countries: [], message: `Invalid request: ${parsed.error.message}` };
    }

    const ctx = resolve({ ...tenantContext, toolName: getCoverageToolName });
    checkRateLimit(tenantContext.tenantId, ctx.record.rateLimit.requestsPerMinute);

    const result = await ctx.adapter.getCoverage(parsed.data, ctx);

    logger.info({ latencyMs: Date.now() - start, countryCount: result.countries.length }, 'tool_complete');
    return result;
  } catch (err) {
    logger.error({ latencyMs: Date.now() - start, err: String(err) }, 'tool_error');
    return { ok: false, countries: [], message: toSafeMessage(err) };
  }
}
