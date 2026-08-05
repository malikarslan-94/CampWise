import { randomUUID } from 'node:crypto';
import { tenantContextStorage } from '../middleware/tenantAuth.js';
import type { TenantContext } from '../resolver/types.js';
import { getTool } from '../tools/registry.js';
import { getLogger } from '../lib/logger.js';
import { toSafeMessage } from '../lib/errors.js';
import type { SessionData } from './session/types.js';

/**
 * Runs a tool on behalf of a chat session.
 *
 * This is the seam. Phase 1 deliberately put the tenant context in AsyncLocalStorage
 * rather than threading it through call signatures, which decoupled *what the tools
 * need* from *how it arrives*. The MCP middleware fills that store from request
 * headers; this fills it from a signed session pass. Everything below — validation,
 * resolver, adapters, upstream — cannot tell the difference and does not need to.
 *
 * Swappable so a future deployment split can put an HTTP/MCP bridge here instead,
 * with no change to any caller.
 */
export interface ToolInvoker {
  invoke(toolName: string, args: unknown, session: SessionData): Promise<unknown>;
}

export class DirectToolInvoker implements ToolInvoker {
  async invoke(toolName: string, args: unknown, session: SessionData): Promise<unknown> {
    const tool = getTool(toolName);

    // The model named something that does not exist. Feed the error back rather than
    // throwing — it can recover on the next turn.
    if (!tool || tool.hiddenFromChat) {
      return { ok: false, message: `Unknown tool '${toolName}'.` };
    }

    // Belt and braces. The menu should never have offered this, but a tool that
    // returns someone's personal data must not run on an unauthenticated session
    // even if the menu were built wrongly.
    if (tool.requiresAuth && session.auth !== 'user') {
      return { ok: false, message: 'This action requires you to be signed in.' };
    }

    /**
     * Everything identifying comes from the session — never from `args`, which the
     * model wrote. `locale` is the one exception, and it is safe: it is a preference,
     * not a permission.
     */
    const context: TenantContext = {
      tenantId: session.tenantId,
      userId: session.auth === 'user' ? session.userId : undefined,
      locale: session.locale,
      requestId: randomUUID(),
      toolName,
    };

    const logger = getLogger({
      tenantId: context.tenantId,
      toolName,
      requestId: context.requestId,
      sessionId: session.sessionId,
    });

    // Argument NAMES only. The values came from the model and may contain anything
    // a user typed; the names are enough to see what it asked for.
    logger.debug(
      {
        argKeys: args && typeof args === 'object' ? Object.keys(args as object) : [],
        locale: context.locale ?? null,
        auth: session.auth,
      },
      'tool_invoked',
    );

    const start = Date.now();
    try {
      const result = await tenantContextStorage.run(context, () => tool.handler(args));
      const ok = (result as { ok?: boolean })?.ok;
      logger.info({ latencyMs: Date.now() - start, ok: ok ?? null }, 'tool_finished');
      return result;
    } catch (err) {
      // Handlers already sanitise their own failures; this catches anything that
      // escaped, so no endpoint or secret can reach the model in an error string.
      logger.error({ latencyMs: Date.now() - start, err: String(err) }, 'tool_failed');
      return { ok: false, message: toSafeMessage(err) };
    }
  }
}
