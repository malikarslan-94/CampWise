import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import type { TenantRegistry } from '../registry/registry.js';
import type { TenantRecord } from '../registry/schema.js';
import { normalizeLocale } from '../lib/locale.js';
import { getLogger } from '../lib/logger.js';
import { RateLimitedError } from '../lib/errors.js';
import {
  checkChatRateLimit,
  recordTokenSpend,
  remainingTokenBudget,
  type ChatLimits,
} from '../middleware/rateLimit.js';
import type { SessionStore } from './session/store.js';
import { appendTurn } from './session/store.js';
import { mintPassForSession, verifySessionPass, DEFAULT_PASS_TTL_MS } from './session/pass.js';
import type { SessionData } from './session/types.js';
import type { CaptchaVerifier } from './recaptcha.js';
import { readJsonBody, sendJson, applyCors, clientIp } from './http.js';

/**
 * Produces the answer for one user message. Phase E ships a stub; phase F swaps in
 * the Claude tool runner. Everything around it — the gate, sessions, tenancy — is
 * identical either way, which is the point of proving the pipeline first.
 */
export interface ChatResponder {
  respond(input: {
    session: SessionData;
    message: string;
    /** Phase E only — lets the stub drive a tool call without a model. */
    args?: Record<string, unknown>;
  }): Promise<ChatReply>;
}

export interface ChatReply {
  answer: string;
  /** Model tokens spent, for the per-session budget. Omitted by the stub. */
  tokensUsed?: number;
}

export interface ChatRoutesDeps {
  registry: TenantRegistry;
  sessions: SessionStore;
  responder: ChatResponder;
  captcha: CaptchaVerifier;
  signingKey: string;
  limits?: ChatLimits;
  passTtlMs?: number;
}

// ── Request shapes ────────────────────────────────────────────────────────────

const CreateSessionBody = z.object({
  /** Used when there is no Origin header — native apps do not send one. */
  surface: z.string().min(1).optional(),
  locale: z.string().max(35).optional(),
  captchaToken: z.string().min(1),
  /** Mobile's per-install id; a better rate-limit key than a CGNAT-shared IP. */
  deviceId: z.string().min(1).max(128).optional(),
});

const ChatBody = z.object({
  pass: z.string().min(1),
  message: z.string().min(1).max(4_000),
  /** Callers may switch language mid-conversation. */
  locale: z.string().max(35).optional(),
  deviceId: z.string().min(1).max(128).optional(),
  /**
   * Phase E only: lets the stub responder drive a real tool call without a model.
   * Harmless by construction — tool arguments cannot carry identity or tenancy, so
   * the worst a caller does with this is search for plans.
   */
  debugToolArgs: z.record(z.string(), z.unknown()).optional(),
});

// ── Routes ────────────────────────────────────────────────────────────────────

export function createChatRoutes(deps: ChatRoutesDeps) {
  const passTtl = deps.passTtlMs ?? DEFAULT_PASS_TTL_MS;
  const allowedOrigins = new Set(
    deps.registry
      .getAllTenants()
      .filter((t) => t.publicChat)
      .flatMap((t) => t.allowedOrigins.map((o) => o.toLowerCase().replace(/\/+$/, ''))),
  );

  /**
   * Resolves which tenant this request belongs to.
   *
   * Web: from the Origin header. Native: from a `surface` field, which IS
   * client-controlled — and that is acceptable only because `publicChat` guarantees
   * every reachable tenant already publishes its prices. Forging it buys another
   * public catalogue. Tenants whose data is not public are simply not in this map.
   */
  function resolveTenant(req: IncomingMessage, surface?: string): TenantRecord | undefined {
    const origin = req.headers.origin;
    if (origin) return deps.registry.getTenantByOrigin(origin);
    if (!surface) return undefined;

    try {
      const record = deps.registry.getTenant(surface);
      return record.publicChat ? record : undefined;
    } catch {
      return undefined;
    }
  }

  async function handleCreateSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const logger = getLogger({});
    logger.debug({ origin: req.headers.origin ?? null }, 'step1_session_requested');

    const parsed = CreateSessionBody.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      logger.warn({ reason: 'invalid_body' }, 'step2_session_rejected');
      return sendJson(res, 400, { error: 'Invalid request' });
    }

    const tenant = resolveTenant(req, parsed.data.surface);
    if (!tenant) {
      logger.warn(
        { reason: 'unknown_surface', origin: req.headers.origin ?? null, surface: parsed.data.surface ?? null },
        'step2_session_rejected',
      );
      return sendJson(res, 403, { error: 'Chat is not available here' });
    }
    logger.debug(
      {
        tenantId: tenant.tenantId,
        via: req.headers.origin ? 'origin' : 'surface',
        publicChat: tenant.publicChat,
      },
      'step2_tenant_resolved',
    );

    const ip = clientIp(req);
    if (!(await deps.captcha.verify(parsed.data.captchaToken, ip))) {
      logger.warn({ tenantId: tenant.tenantId, reason: 'captcha' }, 'step3_session_rejected');
      return sendJson(res, 403, { error: 'Verification failed' });
    }
    logger.debug({ tenantId: tenant.tenantId }, 'step3_captcha_passed');

    const locale = normalizeLocale(parsed.data.locale);
    logger.debug(
      { supplied: parsed.data.locale ?? null, normalized: locale ?? null },
      'step4_locale_normalized',
    );

    const session = deps.sessions.create({ tenantId: tenant.tenantId, locale });

    logger.info(
      {
        tenantId: tenant.tenantId,
        sessionId: session.sessionId,
        locale: locale ?? null,
        auth: session.auth,
      },
      'step5_session_created',
    );

    sendJson(res, 200, {
      sessionId: session.sessionId,
      pass: mintPassForSession(session, deps.signingKey, passTtl),
      expiresInMs: passTtl,
    });
  }

  async function handleChat(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const gateLogger = getLogger({});
    const requestStart = Date.now();

    const parsed = ChatBody.safeParse(await readJsonBody(req));
    if (!parsed.success) {
      gateLogger.warn({ reason: 'invalid_body' }, 'step6_chat_rejected');
      return sendJson(res, 400, { error: 'Invalid request' });
    }
    gateLogger.debug({ messageChars: parsed.data.message.length }, 'step6_message_received');

    const verification = verifySessionPass(parsed.data.pass, deps.signingKey);
    if (!verification.ok) {
      // 'expired' is routine — the widget silently opens a new session. A bad
      // signature is not, and is worth seeing in the logs.
      const level = verification.reason === 'expired' ? 'debug' : 'warn';
      gateLogger[level]({ reason: verification.reason }, 'step7_pass_rejected');
      return sendJson(res, 401, { error: 'Session expired', reason: verification.reason });
    }
    gateLogger.debug(
      { tenantId: verification.claims.tid, auth: verification.claims.auth },
      'step7_pass_verified',
    );

    const session = deps.sessions.get(verification.claims.sid);
    if (!session) {
      gateLogger.debug({ reason: 'unknown_session' }, 'step8_session_rejected');
      return sendJson(res, 401, { error: 'Session expired', reason: 'unknown_session' });
    }

    const logger = getLogger({ tenantId: session.tenantId, sessionId: session.sessionId });
    logger.debug(
      { historyTurns: session.history.length, auth: session.auth, locale: session.locale ?? null },
      'step8_session_loaded',
    );

    const tenant = deps.registry.getTenant(session.tenantId);
    const client = parsed.data.deviceId ?? clientIp(req);

    try {
      checkChatRateLimit(
        { sessionId: session.sessionId, tenantId: session.tenantId, client },
        tenant.rateLimit.requestsPerMinute,
        deps.limits,
      );
    } catch (err) {
      if (err instanceof RateLimitedError) {
        logger.warn({ dimension: err.dimension }, 'step9_rate_limited');
        return sendJson(res, 429, { error: 'Too many requests. Please wait a moment.' });
      }
      throw err;
    }
    logger.debug(
      { clientKey: parsed.data.deviceId ? 'deviceId' : 'ip' },
      'step9_rate_limit_passed',
    );

    // A caller may switch language mid-conversation. Safe to accept: a preference,
    // not a permission. Unrecognised values are ignored rather than guessed at.
    const locale = normalizeLocale(parsed.data.locale);
    if (locale && locale !== session.locale) {
      logger.debug({ from: session.locale ?? null, to: locale }, 'step10_locale_changed');
      session.locale = locale;
    }

    logger.debug({ auth: session.auth }, 'step11_responder_start');
    const start = Date.now();
    const reply = await deps.responder.respond({
      session,
      message: parsed.data.message,
      args: parsed.data.debugToolArgs,
    });
    logger.debug({ latencyMs: Date.now() - start }, 'step12_responder_done');

    appendTurn(session, 'user', parsed.data.message);
    appendTurn(session, 'assistant', reply.answer);
    deps.sessions.save(session);
    logger.debug({ historyTurns: session.history.length }, 'step13_session_saved');

    if (reply.tokensUsed) {
      recordTokenSpend(session.sessionId, reply.tokensUsed, deps.limits);
      logger.debug(
        { tokensUsed: reply.tokensUsed, remaining: remainingTokenBudget(session.sessionId, deps.limits) },
        'step13_tokens_recorded',
      );
    }

    logger.info(
      {
        latencyMs: Date.now() - requestStart,
        tokensUsed: reply.tokensUsed ?? null,
        answerChars: reply.answer.length,
      },
      'step14_chat_complete',
    );

    sendJson(res, 200, { sessionId: session.sessionId, answer: reply.answer });
  }

  /**
   * Returns true when it handled the request. Kept as a plain predicate so it can be
   * dropped into the existing node:http server without pulling in a framework.
   */
  return async function chatRouter(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? '';
    if (!url.startsWith('/chat')) return false;

    applyCors(req, res, allowedOrigins);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      return true;
    }

    try {
      if (url === '/chat/session') {
        await handleCreateSession(req, res);
      } else if (url === '/chat') {
        await handleChat(req, res);
      } else {
        sendJson(res, 404, { error: 'Not found' });
      }
    } catch (err) {
      getLogger({}).error({ event: 'chat_route_error', err: String(err) }, 'chat_route_error');
      if (!res.headersSent) sendJson(res, 400, { error: 'Request could not be processed' });
    }

    return true;
  };
}
