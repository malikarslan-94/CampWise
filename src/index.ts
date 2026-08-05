import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig } from './config.js';
import { loadRegistry, getRegistry } from './registry/registry.js';
import { validateSecretRefs } from './config.js';
import { createMcpServer } from './server.js';
import { tenantAuthMiddleware } from './middleware/tenantAuth.js';
import { rootLogger } from './lib/logger.js';

async function main() {
  // ── Startup validation ────────────────────────────────────────────────────
  const config = loadConfig();
  loadRegistry(config.REGISTRY_PATH);
  validateSecretRefs();

  const registry = getRegistry();
  const tenantCount = registry.getAllTenants().length;

  // ── MCP Server ────────────────────────────────────────────────────────────
  const mcpServer = createMcpServer();

  // ── Chat module ───────────────────────────────────────────────────────────
  // Not mounted. Everything it needs is built — `createChatRoutes` in ai/routes.ts
  // takes a registry, a session store, a captcha verifier and a ChatResponder — but
  // no responder exists until the Claude tool runner lands in phase F. Wiring it up
  // is one call there, plus validateChatConfig() to make the chat secrets mandatory
  // at startup for any tenant with publicChat enabled.

  // ── HTTP Server ───────────────────────────────────────────────────────────
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Health check — no auth required
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, version: '1.0.0', tenantsLoaded: tenantCount }));
      return;
    }

    // All MCP traffic goes through tenant auth middleware
    await tenantAuthMiddleware(req, res, async () => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });

      res.on('close', () => {
        transport.close().catch(() => {});
        // mcpServer is a process-lifetime singleton — do NOT close it here.
      });

      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, await readBody(req));
    });
  });

  httpServer.listen(config.PORT, () => {
    rootLogger.info(
      { port: config.PORT, tenantsLoaded: tenantCount, version: '1.0.0' },
      'server_started',
    );
  });

  // ── Graceful shutdown ─────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    rootLogger.info({ signal }, 'shutdown_initiated');
    httpServer.close(() => {
      rootLogger.info('http_server_closed');
      mcpServer.close().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

main().catch((err) => {
  rootLogger.fatal({ err: String(err) }, 'startup_failed');
  process.exit(1);
});
