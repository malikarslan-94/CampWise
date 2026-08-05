import type { SupportedLocale } from '../../lib/locale.js';

/**
 * Whether the caller has proved who they are.
 *
 * `anonymous` is the normal case, not a degraded one — most people asking "which
 * plan for Japan?" are not signed in, and the tools that answer that question need
 * no identity. Only `user` unlocks tools that return personal data.
 */
export type AuthState = 'anonymous' | 'user';

/**
 * One stored turn of conversation.
 *
 * Deliberately plain text, not the model's own message objects. A turn's tool
 * traffic — the tool_use blocks and their results — is transient: it exists inside
 * one tool-runner loop and is dropped afterwards. Persisting it would mean re-sending
 * every plan list on every subsequent turn, which is exactly what exhausts the token
 * budget. The assistant's final text carries the continuity that matters.
 */
export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  at: number;
}

/**
 * Everything the server knows about one conversation.
 *
 * `tenantId`, `auth` and `userId` are set here and nowhere else — never from a tool
 * argument, never from a request body. This object is the answer to "who is asking,
 * and on whose behalf", and the model never sees it.
 */
export interface SessionData {
  sessionId: string;
  tenantId: string;
  auth: AuthState;
  /** Present only when auth is 'user'. Set by OTP verification, never by the client. */
  userId?: string;
  locale?: SupportedLocale;
  history: ConversationTurn[];
  createdAt: number;
  lastSeenAt: number;
}
