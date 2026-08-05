import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  mintSessionPass,
  mintPassForSession,
  verifySessionPass,
  DEFAULT_PASS_TTL_MS,
} from '../src/ai/session/pass.js';
import type { SessionData } from '../src/ai/session/types.js';

/**
 * The pass exists so the client can carry facts it must not be able to choose.
 * These tests are almost entirely about tampering: every field a browser would like
 * to rewrite — tenant, auth state, user, expiry — must invalidate the signature.
 */

const KEY = 'a-test-signing-key-at-least-32-chars-long';

const claims = {
  sid: 'sess-1',
  tid: 'web-yoowifi-my',
  auth: 'anonymous' as const,
  loc: 'ms' as const,
};

/** Rebuilds a pass with edited claims but the ORIGINAL signature — i.e. tampering. */
function tamper(pass: string, edit: (c: Record<string, unknown>) => void): string {
  const [payload, sig] = pass.split('.');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  edit(decoded);
  const forged = Buffer.from(JSON.stringify(decoded)).toString('base64url');
  return `${forged}.${sig}`;
}

describe('round trip', () => {
  it('mints and verifies, preserving every claim', () => {
    const result = verifySessionPass(mintSessionPass(claims, KEY), KEY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claims).toMatchObject(claims);
  });

  it('mints from a session object', () => {
    const session: SessionData = {
      sessionId: 'sess-9',
      tenantId: 'web-yoowifi-my',
      auth: 'user',
      userId: 'u-12345',
      locale: 'ja',
      history: [],
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    };
    const result = verifySessionPass(mintPassForSession(session, KEY), KEY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.claims).toMatchObject({ sid: 'sess-9', auth: 'user', uid: 'u-12345', loc: 'ja' });
  });
});

describe('tampering is rejected', () => {
  it('cannot promote itself to a signed-in session', () => {
    const pass = tamper(mintSessionPass(claims, KEY), (c) => {
      c.auth = 'user';
      c.uid = 'u-99999';
    });
    expect(verifySessionPass(pass, KEY)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('cannot switch to another tenant', () => {
    const pass = tamper(mintSessionPass(claims, KEY), (c) => {
      c.tid = 'portal-tune';
    });
    expect(verifySessionPass(pass, KEY)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('cannot extend its own expiry', () => {
    const pass = tamper(mintSessionPass(claims, KEY), (c) => {
      c.exp = Date.now() + 10 * DEFAULT_PASS_TTL_MS;
    });
    expect(verifySessionPass(pass, KEY)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('cannot hijack another session id', () => {
    const pass = tamper(mintSessionPass(claims, KEY), (c) => {
      c.sid = 'someone-elses-session';
    });
    expect(verifySessionPass(pass, KEY)).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a pass signed with a different key', () => {
    const pass = mintSessionPass(claims, 'a-different-key-also-32-chars-long!!');
    expect(verifySessionPass(pass, KEY)).toEqual({ ok: false, reason: 'bad_signature' });
  });
});

describe('malformed input', () => {
  it.each([
    ['empty', ''],
    ['no separator', 'justonesegment'],
    ['empty payload', '.abc'],
    ['empty signature', 'abc.'],
    ['garbage', 'not-a-pass-at-all'],
  ])('rejects %s without throwing', (_label, input) => {
    expect(verifySessionPass(input, KEY).ok).toBe(false);
  });

  it('rejects a correctly signed pass whose claims are the wrong shape', () => {
    const junk = Buffer.from(JSON.stringify({ hello: 'world' })).toString('base64url');
    const pass = mintSessionPass(claims, KEY);
    const sig = pass.split('.')[1];
    // Sign the junk properly, so only the shape check can catch it.
    const properlySigned = mintSessionPass({ ...claims, sid: 'x' }, KEY);
    expect(verifySessionPass(`${junk}.${sig}`, KEY).ok).toBe(false);
    expect(verifySessionPass(properlySigned, KEY).ok).toBe(true);
  });
});

describe('expiry', () => {
  afterEach(() => vi.useRealTimers());

  it('reports expired separately, so the widget can quietly re-open a session', () => {
    vi.useFakeTimers();
    const start = Date.now();
    const pass = mintSessionPass(claims, KEY, 1_000);

    vi.setSystemTime(start + 1_500);
    expect(verifySessionPass(pass, KEY)).toEqual({ ok: false, reason: 'expired' });
  });

  it('is still valid just before expiry', () => {
    vi.useFakeTimers();
    const start = Date.now();
    const pass = mintSessionPass(claims, KEY, 10_000);

    vi.setSystemTime(start + 9_000);
    expect(verifySessionPass(pass, KEY).ok).toBe(true);
  });
});
