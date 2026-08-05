import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { searchPlansToolDef, handleSearchPlans } from './tools/searchPlans.js';
import { getPricingToolDef, handleGetPricing } from './tools/getPricing.js';
import { getCoverageToolDef, handleGetCoverage } from './tools/getCoverage.js';
import { checkOrderStatusToolDef, handleCheckOrderStatus } from './tools/checkOrderStatus.js';
import { createOrderToolDef } from './tools/createOrder.stub.js';
import { rootLogger } from './lib/logger.js';
export function createMcpServer() {
    const server = new McpServer({
        name: 'yoowifi-mcp-server',
        version: '1.0.0',
    });
    server.tool(searchPlansToolDef.name, searchPlansToolDef.description, searchPlansToolDef.inputSchema.shape, async (args) => {
        const result = await handleSearchPlans(args);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    });
    server.tool(getPricingToolDef.name, getPricingToolDef.description, getPricingToolDef.inputSchema.shape, async (args) => {
        const result = await handleGetPricing(args);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    });
    server.tool(getCoverageToolDef.name, getCoverageToolDef.description, getCoverageToolDef.inputSchema.shape, async (args) => {
        const result = await handleGetCoverage(args);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    });
    server.tool(checkOrderStatusToolDef.name, checkOrderStatusToolDef.description, checkOrderStatusToolDef.inputSchema.shape, async (args) => {
        const result = await handleCheckOrderStatus(args);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    });
    server.tool(createOrderToolDef.name, createOrderToolDef.description, createOrderToolDef.inputSchema.shape, async (_args) => {
        return {
            content: [{ type: 'text', text: JSON.stringify({ ok: false, message: 'Order creation is not available in this phase.' }) }],
            isError: true,
        };
    });
    rootLogger.info({ tools: [searchPlansToolDef.name, getPricingToolDef.name, getCoverageToolDef.name, checkOrderStatusToolDef.name, createOrderToolDef.name] }, 'tools_registered');
    return server;
}
//# sourceMappingURL=server.js.map