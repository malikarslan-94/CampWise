import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadConfig, validateChatConfig } from './config.js';
import { loadRegistry, getRegistry, collectChatOrigins } from './registry/registry.js';
import { validateSecretRefs } from './config.js';
import { createMcpServer } from './server.js';
import { tenantAuthMiddleware } from './middleware/tenantAuth.js';
import { rootLogger } from './lib/logger.js';
import { createChatRoutes } from './ai/routes.js';
import { InMemorySessionStore } from './ai/session/store.js';
import { DirectToolInvoker } from './ai/DirectToolInvoker.js';
import { StubResponder } from './ai/stubResponder.js';
import { RecaptchaVerifier } from './ai/recaptcha.js';

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
  // Mounted only when at least one tenant has opted in. A tenant opting in without
  // the chat secrets present is a misconfiguration worth failing on at startup,
  // rather than on the first user's message.
  const chatOrigins = collectChatOrigins(registry.getAllTenants());
  let chatRouter: ((req: IncomingMessage, res: ServerResponse) => Promise<boolean>) | undefined;

  if (chatOrigins.length > 0) {
    validateChatConfig();
    chatRouter = createChatRoutes({
      registry,
      sessions: new InMemorySessionStore(),
      // Phase E: no model yet. Swapped for the Claude tool runner in phase F.
      responder: new StubResponder(new DirectToolInvoker()),
      captcha: new RecaptchaVerifier(config.RECAPTCHA_SECRET!),
      signingKey: config.SESSION_SIGNING_KEY!,
    });
    rootLogger.info({ origins: chatOrigins.length }, 'chat_module_enabled');
  } else {
    rootLogger.info('chat_module_disabled_no_public_tenants');
  }

  // ── HTTP Server ───────────────────────────────────────────────────────────
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    // Health check — no auth required
    if (req.method === 'GET' && req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, version: '1.0.0', tenantsLoaded: tenantCount }));
      return;
    }

    // Chat endpoints authenticate with a signed session pass, not the service key,
    // so they sit in front of the MCP middleware rather than behind it.
    if (chatRouter && (await chatRouter(req, res))) return;

    // All remaining traffic goes through tenant auth middleware
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
