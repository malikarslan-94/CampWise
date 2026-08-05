import { z } from 'zod';
import { resolve } from '../resolver/resolver.js';
import { toSafeMessage } from '../lib/errors.js';
import { checkRateLimit } from '../middleware/rateLimit.js';
import { requireTenantContext } from '../middleware/tenantAuth.js';
import { getLogger } from '../lib/logger.js';
import { CanonicalOrderStatusRequestSchema } from '../canonical/contract.js';
export const checkOrderStatusToolName = 'check_order_status';
export const checkOrderStatusInputSchema = z.object({
    userId: z.string().describe('User ID to look up orders for'),
    phone: z.string().optional().describe('Phone number (alternative lookup)'),
    orderId: z.string().optional().describe('Specific order ID to retrieve'),
});
export const checkOrderStatusToolDef = {
    name: checkOrderStatusToolName,
    description: 'Look up the status and details of a user\'s existing orders by user ID or order ID.',
    inputSchema: checkOrderStatusInputSchema,
};
export async function handleCheckOrderStatus(args) {
    const tenantContext = requireTenantContext();
    const logger = getLogger({ tenantId: tenantContext.tenantId, toolName: checkOrderStatusToolName, requestId: tenantContext.requestId });
    const start = Date.now();
    try {
        const parsed = CanonicalOrderStatusRequestSchema.safeParse(args);
        if (!parsed.success) {
            return { ok: false, orders: [], message: `Invalid request: ${parsed.error.message}` };
        }
        const ctx = resolve({ ...tenantContext, toolName: checkOrderStatusToolName });
        checkRateLimit(tenantContext.tenantId, ctx.record.rateLimit.requestsPerMinute);
        const result = await ctx.adapter.checkOrderStatus(parsed.data, ctx);
        logger.info({ latencyMs: Date.now() - start, orderCount: result.orders.length }, 'tool_complete');
        return result;
    }
    catch (err) {
        logger.error({ latencyMs: Date.now() - start, err: String(err) }, 'tool_error');
        return { ok: false, orders: [], message: toSafeMessage(err) };
    }
}
//# sourceMappingURL=checkOrderStatus.js.map