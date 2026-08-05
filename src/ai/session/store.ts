import { randomUUID } from 'node:crypto';
import type { SupportedLocale } from '../../lib/locale.js';
import type { AuthState, ConversationTurn, SessionData } from './types.js';

/**
 * Conversation storage.
 *
 * Swappable interface, same pattern as the registry and the rate limiter. The
 * in-memory implementation is correct for a single instance; the moment a second
 * one runs, a follow-up message can land on a different process and find no session,
 * so Redis becomes necessary. That — not session count — is the trigger.
 */
export interface SessionStore {
  create(init: CreateSessionInput): SessionData;
  /** Returns undefined when unknown or idle-expired. Touches lastSeenAt on a hit. */
  get(sessionId: string): SessionData | undefined;
  save(session: SessionData): void;
  delete(sessionId: string): void;
  size(): number;
}

export interface CreateSessionInput {
  tenantId: string;
  locale?: SupportedLocale;
  auth?: AuthState;
  userId?: string;
}

export interface SessionStoreOptions {
  /** Idle expiry. A conversation nobody has touched in this long is over. */
  idleTtlMs?: number;
  /**
   * Turns retained. History is re-sent on every model call, so this is a direct
   * cost control as much as a memory one — an unbounded conversation bills for
   * itself repeatedly.
   */
  maxTurns?: number;
  /** Hard ceiling on concurrent sessions; oldest-touched are evicted past it. */
  maxSessions?: number;
}

export const DEFAULT_SESSION_OPTIONS: Required<SessionStoreOptions> = {
  idleTtlMs: 30 * 60_000,
  maxTurns: 20,
  maxSessions: 10_000,
};

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionData>();
  private readonly opts: Required<SessionStoreOptions>;

  constructor(options: SessionStoreOptions = {}) {
    this.opts = { ...DEFAULT_SESSION_OPTIONS, ...options };
  }

  create(init: CreateSessionInput): SessionData {
    const now = Date.now();
    const session: SessionData = {
      sessionId: randomUUID(),
      tenantId: init.tenantId,
      auth: init.auth ?? 'anonymous',
      userId: init.userId,
      locale: init.locale,
      history: [],
      createdAt: now,
      lastSeenAt: now,
    };

    this.evictIfNeeded();
    this.sessions.set(session.sessionId, session);
    return session;
  }

  get(sessionId: string): SessionData | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) return undefined;

    if (Date.now() - session.lastSeenAt > this.opts.idleTtlMs) {
      this.sessions.delete(sessionId);
      return undefined;
    }

    session.lastSeenAt = Date.now();
    // Re-insert so Map iteration order tracks recency, making eviction LRU.
    this.sessions.delete(sessionId);
    this.sessions.set(sessionId, session);
    return session;
  }

  save(session: SessionData): void {
    session.lastSeenAt = Date.now();
    if (session.history.length > this.opts.maxTurns) {
      session.history = session.history.slice(-this.opts.maxTurns);
    }
    this.sessions.set(session.sessionId, session);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  size(): number {
    return this.sessions.size;
  }

  /** Drops idle sessions first; only then evicts by recency. */
  private evictIfNeeded(): void {
    if (this.sessions.size < this.opts.maxSessions) return;

    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastSeenAt > this.opts.idleTtlMs) this.sessions.delete(id);
    }

    while (this.sessions.size >= this.opts.maxSessions) {
      const oldest = this.sessions.keys().next();
      if (oldest.done) break;
      this.sessions.delete(oldest.value);
    }
  }
}

/** Appends a turn, trimming to the store's retention limit on save. */
export function appendTurn(
  session: SessionData,
  role: ConversationTurn['role'],
  content: string,
): void {
  session.history.push({ role, content, at: Date.now() });
}
