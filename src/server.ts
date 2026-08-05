import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TOOLS } from './tools/registry.js';
import { toSafeMessage } from './lib/errors.js';
import { rootLogger } from './lib/logger.js';

/**
 * Registers every tool from the shared registry onto the MCP transport.
 *
 * The chat module reaches the same handlers through DirectToolInvoker, so both
 * entry points resolve tenancy and call upstream through one pipeline. One table,
 * two doors.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'yoowifi-mcp-server',
    version: '1.0.0',
  });

  for (const tool of TOOLS) {
    server.tool(tool.name, tool.description, tool.inputSchema.shape, async (args) => {
      try {
        const result = await tool.handler(args);
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } catch (err) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ ok: false, message: toSafeMessage(err) }) }],
          isError: true,
        };
      }
    });
  }

  rootLogger.info({ tools: TOOLS.map((t) => t.name) }, 'tools_registered');

  return server;
}
