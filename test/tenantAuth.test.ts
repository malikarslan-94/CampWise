import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';

vi.mock('../src/config.js', () => ({
  getConfig: () => ({ SERVICE_API_KEY: 'valid-key', PORT: 3000, REGISTRY_PATH: './tenants.json', LOG_LEVEL: 'info' }),
  loadConfig: () => ({ SERVICE_API_KEY: 'valid-key', PORT: 3000, REGISTRY_PATH: './tenants.json', LOG_LEVEL: 'info' }),
}));

import { tenantAuthMiddleware, getTenantContext } from '../src/middleware/tenantAuth.js';

function makeReq(headers: Record<string, string>): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

interface FakeRes {
  res: ServerResponse;
  state: { statusCode: number; body: string };
}

function makeRes(): FakeRes {
  const state = { statusCode: 200, body: '' };
  const res = {
    writeHead: (code: number) => { state.statusCode = code; },
    end: (data: string) => { state.body = data; },
    on: () => {},
  } as unknown as ServerResponse;
  return { res, state };
}

describe('tenantAuthMiddleware', () => {
  it('rejects missing service key with 401', async () => {
    const { res, state } = makeRes();
    let nextCalled = false;
    await tenantAuthMiddleware(makeReq({}), res, async () => { nextCalled = true; });
    expect(state.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  it('rejects wrong service key with 401', async () => {
    const { res, state } = makeRes();
    await tenantAuthMiddleware(makeReq({ 'x-yoowifi-service-key': 'wrong' }), res, async () => {});
    expect(state.statusCode).toBe(401);
  });

  it('rejects missing tenant ID with 400', async () => {
    const { res, state } = makeRes();
    await tenantAuthMiddleware(
      makeReq({ 'x-yoowifi-service-key': 'valid-key' }),
      res,
      async () => {},
    );
    expect(state.statusCode).toBe(400);
  });

  it('calls next and sets tenant context when valid', async () => {
    const { res } = makeRes();
    let capturedCtx: unknown;
    await tenantAuthMiddleware(
      makeReq({ 'x-yoowifi-service-key': 'valid-key', 'x-yoowifi-tenant-id': 'web-test' }),
      res,
      async () => { capturedCtx = getTenantContext(); },
    );
    expect((capturedCtx as Record<string, unknown>)?.tenantId).toBe('web-test');
  });
});
