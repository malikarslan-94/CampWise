import { describe, it, expect, vi, afterEach } from 'vitest';
import { InMemorySessionStore, appendTurn } from '../src/ai/session/store.js';

/**
 * The store bounds three things that would otherwise grow without limit on a public
 * endpoint: how long a conversation lives, how much of it is re-sent to the model,
 * and how many conversations exist at once.
 */

afterEach(() => vi.useRealTimers());

describe('creation', () => {
  it('starts anonymous with the tenant and locale it was given', () => {
    const store = new InMemorySessionStore();
    const session = store.create({ tenantId: 'web-yoowifi-my', locale: 'ms' });

    expect(session.auth).toBe('anonymous');
    expect(session.tenantId).toBe('web-yoowifi-my');
    expect(session.locale).toBe('ms');
    expect(session.userId).toBeUndefined();
    expect(session.history).toEqual([]);
  });

  it('gives every session a distinct id', () => {
    const store = new InMemorySessionStore();
    const ids = new Set(
      Array.from({ length: 50 }, () => store.create({ tenantId: 't' }).sessionId),
    );
    expect(ids.size).toBe(50);
  });
});

describe('idle expiry', () => {
  it('forgets a session nobody has touched', () => {
    vi.useFakeTimers();
    const start = Date.now();
    const store = new InMemorySessionStore({ idleTtlMs: 1_000 });
    const { sessionId } = store.create({ tenantId: 't' });

    vi.setSystemTime(start + 1_500);
    expect(store.get(sessionId)).toBeUndefined();
    expect(store.size()).toBe(0);
  });

  it('activity keeps a session alive past the raw TTL', () => {
    vi.useFakeTimers();
    const start = Date.now();
    const store = new InMemorySessionStore({ idleTtlMs: 1_000 });
    const { sessionId } = store.create({ tenantId: 't' });

    vi.setSystemTime(start + 800);
    expect(store.get(sessionId)).toBeDefined(); // touches lastSeenAt

    vi.setSystemTime(start + 1_600); // >TTL since creation, <TTL since last touch
    expect(store.get(sessionId)).toBeDefined();
  });
});

describe('history retention', () => {
  it('keeps only the most recent turns — history is re-sent on every model call', () => {
    const store = new InMemorySessionStore({ maxTurns: 4 });
    const session = store.create({ tenantId: 't' });

    for (let i = 0; i < 10; i++) appendTurn(session, 'user', `message ${i}`);
    store.save(session);

    expect(session.history).toHaveLength(4);
    expect(session.history[0].content).toBe('message 6');
    expect(session.history[3].content).toBe('message 9');
  });

  it('records role and content in order', () => {
    const store = new InMemorySessionStore();
    const session = store.create({ tenantId: 't' });

    appendTurn(session, 'user', 'Nak pergi Jepun');
    appendTurn(session, 'assistant', 'Japan Unlimited eSIM, RM45');
    store.save(session);

    expect(store.get(session.sessionId)?.history.map((t) => t.role)).toEqual([
      'user',
      'assistant',
    ]);
  });
});

describe('capacity', () => {
  it('drops idle sessions before live ones when at capacity', () => {
    vi.useFakeTimers();
    const start = Date.now();
    const store = new InMemorySessionStore({ maxSessions: 5, idleTtlMs: 1_000 });

    const stale = Array.from({ length: 4 }, () => store.create({ tenantId: 't' }));

    // Long enough that the first four are idle, then start a fresh conversation.
    vi.setSystemTime(start + 1_500);
    const live = store.create({ tenantId: 't' });

    // This create hits the cap and triggers eviction.
    store.create({ tenantId: 't' });

    expect(store.get(live.sessionId)).toBeDefined();
    for (const s of stale) expect(store.get(s.sessionId)).toBeUndefined();
  });

  it('never exceeds maxSessions under sustained creation', () => {
    const store = new InMemorySessionStore({ maxSessions: 10 });
    for (let i = 0; i < 100; i++) store.create({ tenantId: 't' });
    expect(store.size()).toBeLessThanOrEqual(10);
  });
});

describe('auth upgrade', () => {
  it('persists a verified user against the session', () => {
    const store = new InMemorySessionStore();
    const session = store.create({ tenantId: 'web-yoowifi-my' });

    session.auth = 'user';
    session.userId = 'u-12345';
    store.save(session);

    const reloaded = store.get(session.sessionId);
    expect(reloaded).toMatchObject({ auth: 'user', userId: 'u-12345' });
  });

  it('delete removes it entirely', () => {
    const store = new InMemorySessionStore();
    const { sessionId } = store.create({ tenantId: 't' });
    store.delete(sessionId);
    expect(store.get(sessionId)).toBeUndefined();
  });
});
