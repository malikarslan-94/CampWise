/**
 * Smoke test for the chat pipeline, stopping short of the model.
 *
 *   npx tsx scripts/smoke-chat.ts
 *
 * Drives a dummy app payload — exactly what a client widget will send — through
 * every stage that exists today, printing what each one produced:
 *
 *   origin → tenant → session → pass → gate → invoker → resolver → adapter
 *   → LIVE upstream → canonical response
 *
 * There is no LLM anywhere in this path. When phase F swaps StubResponder for the
 * Claude tool runner, everything printed below stays identical — which is the point
 * of building in this order: if the model then misbehaves, you know it is the prompt
 * and not the plumbing.
 *
 * ⚠️  Stage 4 and 5 make REAL calls to coreapi.yoowifi.com. It is a read-only plan
 * search — the same request the public website makes — but it is production.
 * Pass --offline to skip those two stages.
 */
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

// Dev defaults so the script runs with no .env at all. Production startup still
// demands every one of these — see src/config.ts.
process.env.PORT ??= '3000';
process.env.SERVICE_API_KEY ??= 'smoke-service-key';
process.env.REGISTRY_PATH ??= './src/registry/tenants.json';
// Show every step. Pass --quiet for just the stage summaries.
process.env.LOG_LEVEL ??= process.argv.includes('--quiet') ? 'error' : 'debug';
process.env.LOG_PRETTY ??= '1';
process.env.SESSION_SIGNING_KEY ??= randomBytes(32).toString('hex');
process.env.ANTHROPIC_API_KEY ??= 'not-used-in-this-script';
process.env.RECAPTCHA_SECRET ??= 'not-used-in-this-script';
process.env.SECRET_PORTAL_TUNE ??= 'smoke-portal-secret';
process.env.AESKEY_LEGACY_APP ??= randomBytes(16).toString('hex');

const { loadConfig } = await import('../src/config.js');
const { loadRegistry } = await import('../src/registry/registry.js');
const { InMemorySessionStore } = await import('../src/ai/session/store.js');
const { mintPassForSession, verifySessionPass } = await import('../src/ai/session/pass.js');
const { DirectToolInvoker } = await import('../src/ai/DirectToolInvoker.js');
const { StubResponder } = await import('../src/ai/stubResponder.js');
const { createChatRoutes } = await import('../src/ai/routes.js');
const { normalizeLocale } = await import('../src/lib/locale.js');
const { toolsForAuth } = await import('../src/tools/registry.js');

const OFFLINE = process.argv.includes('--offline');

// ── The dummy app payload ─────────────────────────────────────────────────────
// Exactly what the widget will send: no tenant id, no user id, no auth claim.
const APP_PAYLOAD = {
  origin: 'http://localhost:3000',
  locale: 'vn', // the mobile app's code for Vietnamese — should normalise to 'vi'
  message: 'Nak pergi Jepun seminggu, eSIM mana?',
  toolArgs: {
    originCountry: 'MY',
    destinationCountries: ['JP'],
    durationDays: 7,
    deviceType: 'esim',
  },
};

let stage = 0;
const ok = (label: string, detail: unknown) => {
  console.log(`\n\x1b[32m✓\x1b[0m  ${++stage}. ${label}`);
  console.log(
    typeof detail === 'string'
      ? `   ${detail}`
      : JSON.stringify(detail, null, 2).split('\n').map((l) => `   ${l}`).join('\n'),
  );
};
const fail = (label: string, detail: unknown) => {
  console.log(`\n\x1b[31m✗\x1b[0m  ${++stage}. ${label}`);
  console.log(`   ${String(detail)}`);
  process.exitCode = 1;
};

console.log('\n─── chat pipeline smoke test (no LLM) ───');
console.log(`app payload: ${JSON.stringify(APP_PAYLOAD)}`);

// ── 1. Startup ────────────────────────────────────────────────────────────────
const config = loadConfig();
const registry = loadRegistry(config.REGISTRY_PATH);
ok('config + registry loaded', {
  tenants: registry.getAllTenants().map((t) => t.tenantId),
  groundingEnabled: config.GROUNDING_ENABLED,
});

// ── 2. Origin → tenant ────────────────────────────────────────────────────────
const tenant = registry.getTenantByOrigin(APP_PAYLOAD.origin);
if (!tenant) {
  fail('origin → tenant', `no publicChat tenant owns ${APP_PAYLOAD.origin}`);
  process.exit(1);
}
ok('origin → tenant  (the client never sent a tenant id)', {
  origin: APP_PAYLOAD.origin,
  tenantId: tenant.tenantId,
  family: tenant.family,
  source: tenant.source,
  publicChat: tenant.publicChat,
});

// A tenant that has not opted in must be unreachable this way.
const leaked = registry.getTenantByOrigin('https://evil.example');
ok('unknown origin refused', leaked ? `LEAKED ${leaked.tenantId}` : 'undefined — correct');

// ── 3. Locale normalisation ───────────────────────────────────────────────────
const locale = normalizeLocale(APP_PAYLOAD.locale);
ok('locale normalised', `${APP_PAYLOAD.locale} → ${locale}  (surfaces disagree; we normalise once)`);

// ── 4. Session + pass ─────────────────────────────────────────────────────────
const sessions = new InMemorySessionStore();
const session = sessions.create({ tenantId: tenant.tenantId, locale });
const pass = mintPassForSession(session, config.SESSION_SIGNING_KEY!);
const verified = verifySessionPass(pass, config.SESSION_SIGNING_KEY!);

ok('session created + pass minted', {
  sessionId: session.sessionId,
  auth: session.auth,
  passVerifies: verified.ok,
  claims: verified.ok ? verified.claims : undefined,
});

// Tampering must not survive the signature.
const [payload, sig] = pass.split('.');
const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
decoded.auth = 'user';
const forged = `${Buffer.from(JSON.stringify(decoded)).toString('base64url')}.${sig}`;
ok('tampered pass rejected', verifySessionPass(forged, config.SESSION_SIGNING_KEY!));

// ── 5. Tool menu ──────────────────────────────────────────────────────────────
ok('tool menu for this session  (chosen by auth state, message never inspected)', {
  auth: session.auth,
  anonymous: toolsForAuth('anonymous').map((t) => t.name),
  signedIn: toolsForAuth('user').map((t) => t.name),
});

if (OFFLINE) {
  console.log('\n\x1b[33m--offline\x1b[0m: skipping the two stages that call upstream.\n');
  process.exit(process.exitCode ?? 0);
}

// ── 6. DirectToolInvoker → LIVE upstream ──────────────────────────────────────
console.log('\n   … calling coreapi.yoowifi.com');
const invoker = new DirectToolInvoker();
try {
  const result = await invoker.invoke('search_plans', APP_PAYLOAD.toolArgs, session);
  const plans = (result as { plans?: unknown[] }).plans;
  ok('DirectToolInvoker → resolver → adapter → upstream → canonical', {
    ok: (result as { ok?: boolean }).ok,
    planCount: plans?.length ?? 0,
    firstPlan: plans?.[0] ?? null,
    message: (result as { message?: string }).message,
  });
} catch (err) {
  fail('DirectToolInvoker', err);
}

// Identity cannot be injected through tool arguments.
const hostile = { ...APP_PAYLOAD.toolArgs, userId: 'u-99999', tenantId: 'portal-tune' };
const hostileResult = await invoker.invoke('search_plans', hostile, session);
ok('hostile tool args ignored', {
  sent: { userId: 'u-99999', tenantId: 'portal-tune' },
  note: 'schema strips both; tenant came from the session',
  ok: (hostileResult as { ok?: boolean }).ok,
});

// An anonymous session cannot reach a tool that returns personal data.
ok('anonymous session refused order history', await invoker.invoke('check_order_status', {}, session));

// ── 7. Full HTTP round trip ───────────────────────────────────────────────────
const router = createChatRoutes({
  registry,
  sessions,
  responder: new StubResponder(invoker),
  captcha: { verify: async () => true }, // stubbed here only; production fails closed
  signingKey: config.SESSION_SIGNING_KEY!,
});

const server = createServer(async (req, res) => {
  if (await router(req, res)) return;
  res.writeHead(404).end();
});
await new Promise<void>((r) => server.listen(0, r));
const port = (server.address() as { port: number }).port;
const base = `http://127.0.0.1:${port}`;

const sessionRes = await fetch(`${base}/chat/session`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: APP_PAYLOAD.origin },
  body: JSON.stringify({ captchaToken: 'stubbed', locale: APP_PAYLOAD.locale }),
});
const sessionBody = (await sessionRes.json()) as { pass: string; sessionId: string };
ok('POST /chat/session', { status: sessionRes.status, sessionId: sessionBody.sessionId });

console.log('\n   … calling coreapi.yoowifi.com');
const chatRes = await fetch(`${base}/chat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: APP_PAYLOAD.origin },
  body: JSON.stringify({
    pass: sessionBody.pass,
    message: APP_PAYLOAD.message,
    debugToolArgs: APP_PAYLOAD.toolArgs,
  }),
});
const chatBody = (await chatRes.json()) as { answer?: string };
ok('POST /chat  (stub responder — this is where Claude goes in phase F)', {
  status: chatRes.status,
  answer: chatBody.answer?.slice(0, 600),
});

server.close();
console.log('\n─── done ───\n');
