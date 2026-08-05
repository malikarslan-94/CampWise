import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadRegistry } from '../src/registry/registry.js';
import { createChatRoutes, type ChatResponder } from '../src/ai/routes.js';
import { InMemorySessionStore } from '../src/ai/session/store.js';
import { verifySessionPass, mintSessionPass } from '../src/ai/session/pass.js';
import type { CaptchaVerifier } from '../src/ai/recaptcha.js';

/**
 * The dummy app payload, driven through real HTTP.
 *
 * This is the harness the widget will eventually replace: exactly the request a
 * client app will send, asserted at every stage — tenancy derived, locale
 * normalised, pass minted and honoured, limits enforced. When the widget arrives it
 * swaps in for this fixture and the pipeline under test does not change.
 */

const KEY = 'test-signing-key-at-least-32-characters';

const passingCaptcha: CaptchaVerifier = { verify: async () => true };
const failingCaptcha: CaptchaVerifier = { verify: async () => false };

/** Records what the responder was handed, so we can assert on the session it saw. */
class SpyResponder implements ChatResponder {
  seen: Array<{ tenantId: string; locale?: string; auth: string; message: string }> = [];
  tokensUsed?: number;

  async respond({ session, message }: Parameters<ChatResponder['respond']>[0]) {
    this.seen.push({
      tenantId: session.tenantId,
      locale: session.locale,
      auth: session.auth,
      message,
    });
    return { answer: 'ok', tokensUsed: this.tokensUsed };
  }
}

const baseTenant = {
  displayName: 'Test',
  family: 'website',
  source: 'urwifi',
  platformValue: 'web',
  baseUrls: { dispatcher: 'https://api.example.com' },
  auth: { mode: 'none' },
  localeRule: { default: 'EN' },
  allowedTools: ['search_plans'],
  rateLimit: { requestsPerMinute: 60 },
};

function buildRegistry() {
  const dir = mkdtempSync(join(tmpdir(), 'yoowifi-chat-'));
  const path = join(dir, 'tenants.json');
  writeFileSync(
    path,
    JSON.stringify([
      {
        ...baseTenant,
        tenantId: 'web-public',
        publicChat: true,
        allowedOrigins: ['https://shop.example'],
      },
      { ...baseTenant, tenantId: 'portal-private', publicChat: false, allowedOrigins: [] },
    ]),
  );
  return loadRegistry(path);
}

let server: Server;
let baseUrl: string;
let responder: SpyResponder;
let sessions: InMemorySessionStore;

async function start(captcha: CaptchaVerifier = passingCaptcha) {
  responder = new SpyResponder();
  sessions = new InMemorySessionStore();

  const router = createChatRoutes({
    registry: buildRegistry(),
    sessions,
    responder,
    captcha,
    signingKey: KEY,
  });

  server = createServer(async (req, res) => {
    if (await router(req, res)) return;
    res.writeHead(404).end();
  });

  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const ORIGIN = { Origin: 'https://shop.example' };

async function openSession(extra: Record<string, unknown> = {}) {
  const res = await post('/chat/session', { captchaToken: 'tok', ...extra }, ORIGIN);
  return { res, body: (await res.json()) as { pass: string; sessionId: string } };
}

beforeEach(async () => {
  if (server) server.close();
  await start();
});

// ── Session creation ──────────────────────────────────────────────────────────

describe('POST /chat/session', () => {
  it('derives the tenant from Origin and seals it into the pass', async () => {
    const { res, body } = await openSession();
    expect(res.status).toBe(200);

    const verified = verifySessionPass(body.pass, KEY);
    expect(verified.ok).toBe(true);
    if (!verified.ok) return;
    expect(verified.claims.tid).toBe('web-public');
    expect(verified.claims.auth).toBe('anonymous');
  });

  it('normalises the locale the app supplied', async () => {
    const { body } = await openSession({ locale: 'vn' }); // mobile's code for Vietnamese
    const verified = verifySessionPass(body.pass, KEY);
    if (!verified.ok) return expect.unreachable();
    expect(verified.claims.loc).toBe('vi');
  });

  it('ignores a locale it does not recognise rather than guessing', async () => {
    const { body } = await openSession({ locale: 'klingon' });
    const verified = verifySessionPass(body.pass, KEY);
    if (!verified.ok) return expect.unreachable();
    expect(verified.claims.loc).toBeUndefined();
  });

  it('refuses an unknown origin', async () => {
    const res = await post('/chat/session', { captchaToken: 'tok' }, { Origin: 'https://evil.example' });
    expect(res.status).toBe(403);
  });

  it('refuses a tenant that has not opted in, even when named directly', async () => {
    const res = await post('/chat/session', { captchaToken: 'tok', surface: 'portal-private' });
    expect(res.status).toBe(403);
  });

  it('accepts a surface id when there is no Origin — native apps send none', async () => {
    const res = await post('/chat/session', { captchaToken: 'tok', surface: 'web-public' });
    expect(res.status).toBe(200);
  });

  it('refuses when the bot check fails', async () => {
    server.close();
    await start(failingCaptcha);
    const res = await post('/chat/session', { captchaToken: 'tok' }, ORIGIN);
    expect(res.status).toBe(403);
  });

  it('requires a captcha token at all', async () => {
    const res = await post('/chat/session', {}, ORIGIN);
    expect(res.status).toBe(400);
  });
});

// ── The gate ──────────────────────────────────────────────────────────────────

describe('POST /chat', () => {
  it('answers a valid request and hands the responder the session', async () => {
    const { body } = await openSession({ locale: 'ms' });
    const res = await post('/chat', { pass: body.pass, message: 'Nak pergi Jepun' }, ORIGIN);

    expect(res.status).toBe(200);
    expect(responder.seen[0]).toMatchObject({
      tenantId: 'web-public',
      locale: 'ms',
      auth: 'anonymous',
      message: 'Nak pergi Jepun',
    });
  });

  it('rejects a forged pass without reaching the responder', async () => {
    const forged = mintSessionPass(
      { sid: 'whatever', tid: 'portal-private', auth: 'user' },
      'a-completely-different-signing-key-abc',
    );
    const res = await post('/chat', { pass: forged, message: 'hi' }, ORIGIN);

    expect(res.status).toBe(401);
    expect(responder.seen).toHaveLength(0);
  });

  it('rejects an expired pass and says so, so the widget can reopen quietly', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    const { body } = await openSession();

    vi.setSystemTime(start + 31 * 60_000);
    vi.useRealTimers();

    const expired = mintSessionPass(
      { sid: 'x', tid: 'web-public', auth: 'anonymous', exp: Date.now() - 1000 },
      KEY,
    );
    const res = await post('/chat', { pass: expired, message: 'hi' }, ORIGIN);
    expect(res.status).toBe(401);
    expect((await res.json()).reason).toBe('expired');
    expect(body.pass).toBeTruthy();
  });

  it('rejects a pass whose session has gone', async () => {
    const { body } = await openSession();
    sessions.delete(JSON.parse(Buffer.from(body.pass.split('.')[0], 'base64url').toString()).sid);

    const res = await post('/chat', { pass: body.pass, message: 'hi' }, ORIGIN);
    expect(res.status).toBe(401);
  });

  it('rejects an empty or oversized message', async () => {
    const { body } = await openSession();
    expect((await post('/chat', { pass: body.pass, message: '' }, ORIGIN)).status).toBe(400);
    expect(
      (await post('/chat', { pass: body.pass, message: 'x'.repeat(5000) }, ORIGIN)).status,
    ).toBe(400);
  });

  it('keeps history across turns on the same pass', async () => {
    const { body } = await openSession();
    await post('/chat', { pass: body.pass, message: 'first' }, ORIGIN);
    await post('/chat', { pass: body.pass, message: 'second' }, ORIGIN);

    const stored = sessions.get(body.sessionId);
    expect(stored?.history.map((t) => t.content)).toEqual(['first', 'ok', 'second', 'ok']);
  });

  it('lets a caller switch language mid-conversation', async () => {
    const { body } = await openSession({ locale: 'en' });
    await post('/chat', { pass: body.pass, message: 'hi', locale: 'jp' }, ORIGIN);
    expect(responder.seen[0].locale).toBe('ja');
  });

  it('rate limits, and does so before reaching the responder', async () => {
    const { body } = await openSession();

    let limited = false;
    for (let i = 0; i < 40; i++) {
      const res = await post('/chat', { pass: body.pass, message: `m${i}` }, ORIGIN);
      if (res.status === 429) {
        limited = true;
        break;
      }
    }

    expect(limited).toBe(true);
    expect(responder.seen.length).toBeLessThan(40);
  });
});

// ── CORS ──────────────────────────────────────────────────────────────────────

describe('CORS', () => {
  it('allows a configured origin', async () => {
    const res = await fetch(`${baseUrl}/chat`, { method: 'OPTIONS', headers: ORIGIN });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://shop.example');
  });

  it('sends no allow-origin for an unconfigured one', async () => {
    const res = await fetch(`${baseUrl}/chat`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    });
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
