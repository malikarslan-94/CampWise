import { z } from 'zod';
import { resolve } from '../resolver/resolver.js';
import { toSafeMessage } from '../lib/errors.js';
import { checkRateLimit } from '../middleware/rateLimit.js';
import { requireTenantContext } from '../middleware/tenantAuth.js';
import { getLogger } from '../lib/logger.js';
import type { CanonicalOrderStatusRequest } from '../canonical/contract.js';

export const checkOrderStatusToolName = 'check_order_status';

/**
 * Model-facing input. There is deliberately NO way to name a user.
 *
 * `userId` and `phone` both used to be here, and both were impersonation vectors:
 * whoever fills that field gets those orders, and once a conversation can fill it,
 * "show me the orders for u-99999" is a working exploit. Whose orders to return is
 * decided by TenantContext alone.
 *
 * `orderId` is safe to expose — it only narrows the result set, which is still
 * scoped to the context's user by the upstream call.
 */
export const checkOrderStatusInputSchema = z.object({
  orderId: z.string().optional().describe('Narrow the result to one specific order'),
});

export const checkOrderStatusToolDef = {
  name: checkOrderStatusToolName,
  description:
    "Look up the status and details of the current user's existing orders. Returns only the signed-in user's own orders; it cannot look up anyone else.",
  inputSchema: checkOrderStatusInputSchema,
};

export async function handleCheckOrderStatus(args: unknown) {
  const tenantContext = requireTenantContext();
  const logger = getLogger({ tenantId: tenantContext.tenantId, toolName: checkOrderStatusToolName, requestId: tenantContext.requestId });
  const start = Date.now();

  try {
    const parsed = checkOrderStatusInputSchema.safeParse(args);
    if (!parsed.success) {
      return { ok: false, orders: [], message: `Invalid request: ${parsed.error.message}` };
    }

    // Whose orders — from the trusted context only. Never from `args`.
    if (!tenantContext.userId) {
      return {
        ok: false,
        orders: [],
        message: 'Order history requires a signed-in user.',
      };
    }

    const req: CanonicalOrderStatusRequest = {
      userId: tenantContext.userId,
      orderId: parsed.data.orderId,
    };

    const ctx = resolve({ ...tenantContext, toolName: checkOrderStatusToolName });
    checkRateLimit(tenantContext.tenantId, ctx.record.rateLimit.requestsPerMinute);

    const result = await ctx.adapter.checkOrderStatus(req, ctx);

    logger.info({ latencyMs: Date.now() - start, orderCount: result.orders.length }, 'tool_complete');
    return result;
  } catch (err) {
    logger.error({ latencyMs: Date.now() - start, err: String(err) }, 'tool_error');
    return { ok: false, orders: [], message: toSafeMessage(err) };
  }
}
