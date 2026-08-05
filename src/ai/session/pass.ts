import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SupportedLocale } from '../../lib/locale.js';
import type { AuthState, SessionData } from './types.js';

/**
 * The session pass.
 *
 * A signed ticket the client holds and returns with every message. It carries the
 * facts the client must not be able to choose — which tenant, and whether they are
 * signed in — in a form they can read but cannot rewrite.
 *
 * That asymmetry is the whole point. If the browser could send `auth: "user"`, it
 * would; if it could send a tenant id, a forged one would reach another tenant's
 * upstream. Instead it holds an opaque string, and the server decides what it means.
 *
 * Signed rather than a bare random id — even though history lives server-side —
 * because a cheap signature check rejects forged and expired passes without touching
 * the session store, which matters on a public endpoint under a flood.
 */

export const DEFAULT_PASS_TTL_MS = 30 * 60_000;

export interface SessionPassClaims {
  /** sessionId */
  sid: string;
  /** tenantId */
  tid: string;
  auth: AuthState;
  /** userId — present only when auth is 'user' */
  uid?: string;
  /** locale */
  loc?: SupportedLocale;
  /** expiry, epoch ms */
  exp: number;
}

export type PassVerification =
  | { ok: true; claims: SessionPassClaims }
  | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

function sign(payload: string, key: string): Buffer {
  return createHmac('sha256', key).update(payload).digest();
}

export function mintSessionPass(
  claims: Omit<SessionPassClaims, 'exp'> & { exp?: number },
  key: string,
  ttlMs: number = DEFAULT_PASS_TTL_MS,
): string {
  const full: SessionPassClaims = { ...claims, exp: claims.exp ?? Date.now() + ttlMs };
  const payload = Buffer.from(JSON.stringify(full)).toString('base64url');
  return `${payload}.${sign(payload, key).toString('base64url')}`;
}

/** Mints a pass describing an existing session. Used on create and on auth upgrade. */
export function mintPassForSession(
  session: SessionData,
  key: string,
  ttlMs: number = DEFAULT_PASS_TTL_MS,
): string {
  return mintSessionPass(
    {
      sid: session.sessionId,
      tid: session.tenantId,
      auth: session.auth,
      uid: session.userId,
      loc: session.locale,
    },
    key,
    ttlMs,
  );
}

export function verifySessionPass(pass: string, key: string): PassVerification {
  if (typeof pass !== 'string' || pass.length === 0) {
    return { ok: false, reason: 'malformed' };
  }

  const dot = pass.indexOf('.');
  if (dot <= 0 || dot === pass.length - 1) return { ok: false, reason: 'malformed' };

  const payload = pass.slice(0, dot);
  const provided = Buffer.from(pass.slice(dot + 1), 'base64url');
  const expected = sign(payload, key);

  // Length check first: timingSafeEqual throws on a mismatch, and a differing length
  // is not a secret worth protecting — the signature's content is.
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { ok: false, reason: 'bad_signature' };
  }

  let claims: SessionPassClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (
    typeof claims?.sid !== 'string' ||
    typeof claims?.tid !== 'string' ||
    (claims.auth !== 'anonymous' && claims.auth !== 'user') ||
    typeof claims?.exp !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }

  // Expiry is checked after the signature so an attacker learns nothing from timing
  // about whether a forged pass had a valid-looking expiry.
  if (Date.now() > claims.exp) return { ok: false, reason: 'expired' };

  return { ok: true, claims };
}
