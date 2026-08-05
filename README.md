# YooWifi MCP Server — Phase 1

Production-grade [Model Context Protocol](https://modelcontextprotocol.io) server exposing YooWifi connectivity-plan operations as tenant-agnostic logical tools. Designed to power AI-driven plan recommendation across 19+ client surfaces without any tenant knowledge leaking into the LLM layer.

## Architecture overview

Two ways in, one pipeline underneath:

```
Chat widget                            External MCP client
(web <script> · mobile WebView)         │  X-YooWifi-Service-Key
  │  session pass (tenant + auth sealed) │  + X-YooWifi-Tenant-Id
  ▼                                      ▼
┌─────────────────────────────────────────────────────┐
│                  This server (HTTP)                 │
│                                                     │
│  POST /chat  ← chat module (Phase 2, to build)      │
│    gate → session → Claude ⇄ tool runner            │
│                    │                                │
│         DirectToolInvoker (in-process)              │
│                    │        MCP transport ──────────┤
│                    ▼            ↓ tenantAuth        │
│  ┌─────────────────────────────────────────────┐    │
│  │  Tool: search_plans / get_pricing / ...     │    │
│  │         ↓ resolve(tenantContext)             │    │
│  │  Resolver  →  Registry lookup               │    │
│  │               ↓                             │    │
│  │  Adapter (website | legacy_app | portal)    │    │
│  │               ↓                             │    │
│  │  Upstream APIs (per-tenant, hidden from LLM)│    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

Everything below the tool layer is shared: both entry points resolve a tenant, pick an adapter,
and call upstream through the identical pipeline. Full walkthrough:
[docs/end-to-end-flow.md](docs/end-to-end-flow.md).

### Key layers

| Layer | Responsibility |
|-------|---------------|
| **Tools** (`src/tools/`) | MCP tool definitions + handlers. Tenant-agnostic: no endpoints, no adapter logic here. |
| **Resolver** (`src/resolver/`) | Looks up the tenant record, checks tool allowance, picks the correct adapter, reads secrets from env. |
| **Registry** (`src/registry/`) | Validates and serves tenant config from `tenants.json`. Implements `TenantRegistry` interface — swap to DB-backed with zero callers changes. |
| **Adapters** (`src/adapters/`) | One per API family. Translates canonical requests → that family's real API call, maps response → canonical. |
| **Canonical contract** (`src/canonical/`) | Single Zod-validated shape every adapter conforms to. |
| **Middleware** | `tenantAuth` — validates service key + tenant headers, stores `TenantContext` in AsyncLocalStorage. `rateLimit` — per-tenant token bucket (in-memory; interface-backed for Redis swap). |

### Adapter families

| Family | Adapter | Notes |
|--------|---------|-------|
| `website` | `websiteAdapter` | Thin wrapper: dispatcher + restCharges endpoints, no encryption |
| `legacy_app` | `legacyAppAdapter` | AES-256-CBC encrypted payload when `encryption.enabled`; no server-side pricing |
| `portal` | `portalAdapter` | Shared-secret auth, platform overrides per requestType, extApi host routing for tune/myrp sources |

### Tenant context flow

Every tool handler reads its `TenantContext` from `AsyncLocalStorage`, so nothing has to be
prop-drilled through MCP's call stack. **The LLM never sees it.** Two things populate it:

**External MCP clients** — `tenantAuth` middleware reads three headers:
- `X-YooWifi-Service-Key` — authenticates the calling service (validated against `SERVICE_API_KEY`)
- `X-YooWifi-Tenant-Id` — which tenant surface this call is for
- `X-YooWifi-User-Id` / `X-YooWifi-User-Role` — optional user context

**The chat module** (Phase 2) — `DirectToolInvoker` builds the same `TenantContext` from the
**session pass**, never from anything the model wrote. The tenant is sealed into the pass when
the session is created and cannot change mid-conversation.

## Tools (Phase 1 — read-only)

| Tool | Description | Chat availability |
|------|-------------|-------------------|
| `search_plans` | Search connectivity plans by origin, destination, duration, type. Grounds results before returning. | v1 — anonymous OK |
| `get_pricing` | Server-authoritative pricing for a plan + trip config. | v1 — anonymous OK |
| `get_coverage` | Countries covered by a plan, or coverage check for a destination. | v1 — anonymous OK |
| `check_order_status` | Order history/status by user ID or order ID. | **v2** — needs a verified user |
| `create_order` | **Stub** — registered but throws `NotImplemented`. Phase 2. | not exposed |

The first three expose only data already public on the client surfaces, so an anonymous chat
session can use them safely. `check_order_status` returns personal data and is withheld until a
session carries a **user id verified by upstream** — see
[docs/end-to-end-flow.md §2](docs/end-to-end-flow.md).

> ⚠️ **Before any of these are exposed to a browser**, `userId` and `promoCode` must be removed
> from the LLM-facing input schemas of `search_plans` / `get_pricing`, and `check_order_status`
> must take its `userId` from the session rather than from tool args. Any field in a tool schema
> is a field the model can fill from the conversation. See the prerequisites list in
> [docs/end-to-end-flow.md §9](docs/end-to-end-flow.md).

## How to run

```bash
# 1. Install
npm install

# 2. Configure
cp .env.example .env
# Edit .env — fill in SERVICE_API_KEY and any per-tenant secret refs

# 3. Start
npm start          # compiled JS
# or
npm run dev        # tsx watch (development)
```

The server starts on `PORT` (default 3000). Health check: `GET /healthz`.

## How to add a new tenant

1. Add a record to `src/registry/tenants.json` following the schema in `src/registry/schema.ts`.
2. Set any referenced secret env vars (`sharedSecretRef`, `encryption.keyRef`) in your environment.
3. Restart the server — it validates all refs at startup and exits with a clear error listing any that are missing.

No code changes required.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | yes | HTTP server port |
| `SERVICE_API_KEY` | yes | Shared key the AI service sends in `X-YooWifi-Service-Key` |
| `REGISTRY_PATH` | yes | Path to `tenants.json` |
| `LOG_LEVEL` | yes | `trace` / `debug` / `info` / `warn` / `error` / `fatal` |
| `SECRET_<NAME>` | per tenant | Shared secret for portal tenants (name matches `auth.sharedSecretRef`) |
| `AESKEY_<NAME>` | per tenant | AES-256-CBC key for legacy-app tenants (name matches `auth.encryption.keyRef`) |

Phase 2 will add: `ANTHROPIC_API_KEY`, `SESSION_SIGNING_KEY` (HMAC key for session passes),
`RECAPTCHA_SECRET` (reusing the reCAPTCHA already present on the web surface), and
`GROUNDING_ENABLED`. Startup validation must cover these the same way it covers tenant secret
refs — missing key, refuse to start.

## Logging

Structured logs go to **stdout**, one JSON object per line (pino). There is no log
file — in production, capture stdout with your process manager or log collector.

```bash
LOG_LEVEL=debug LOG_PRETTY=1 npm run dev     # readable, every step
npm start 2>&1 | tee server.log              # keep a copy
npm start | grep step14_chat_complete        # just the outcomes
```

| Variable | Values | Meaning |
|---|---|---|
| `LOG_LEVEL` | `trace` … `fatal` (default `info`) | `debug` traces every step of a request; `info` records outcomes worth alerting on |
| `LOG_PRETTY` | `1` | Human-readable dev format instead of JSON. Leave unset in production |

Every chat log line carries `tenantId`, `sessionId` and `requestId` where known, so
one conversation can be followed end to end. A single `/chat` request emits, in order:

```
step6_message_received     messageChars=36
step7_pass_verified        tenantId=… auth=anonymous
step8_session_loaded       historyTurns=0 locale=vi
step9_rate_limit_passed    clientKey=ip
step11_responder_start     auth=anonymous
tool_invoked               toolName=search_plans argKeys=[…]
upstream_call              host=coreapi.yoowifi.com status=200 latencyMs=239
tool_finished              ok=true
step13_session_saved       historyTurns=2
step14_chat_complete       latencyMs=241 answerChars=3738
```

Tool **argument names** are logged, never their values — the names show what the
model asked for without recording whatever a user typed.

## Smoke test

Drives a dummy app payload through every stage of the chat pipeline **up to but not
including the model**, printing what each one produced.

```bash
npm run smoke            # includes two live calls to coreapi.yoowifi.com
npm run smoke:offline    # skips them
npm run smoke -- --quiet # stage summaries only, no step logs
```

Runs with no `.env` — it supplies dev defaults for anything unset. See
[scripts/smoke-chat.ts](scripts/smoke-chat.ts).

## Tests

```bash
npm test          # run once
npm run test:watch  # watch mode
```

All upstream HTTP is mocked. Coverage: registry validation, resolver, all three adapters (canonical-in → correct upstream body, upstream-out → canonical mapping), portal source routing, legacy encryption, grounding, rate limiting, tenant auth, tool input validation.

## Building

```bash
npm run build     # outputs to dist/
npm run typecheck # tsc --noEmit
```

---

## Product requirement (the actual goal)

> This section records the real business need this project serves, so future work stays anchored to it.

YooWifi wants to **empower its client apps with AI** so that users can interact conversationally instead of browsing menus. The canonical use case:

> A user opens the chat on any YooWifi surface (website, Skylink mobile app, partner portal) and types:
> *"I'm traveling from country A to country B — which plan suits me best?"*
> The system must find the plans YooWifi actually provides for that route, price them correctly for that surface, and answer in natural language — with **zero risk of the AI inventing plans or prices**.

Constraints that shaped the design:

- **~19 client surfaces**, each with its own upstream API dialect, secrets, and pricing rules — the AI layer must never know which one it's serving (tenant isolation).
- **Server-authoritative data only** — the model may only state what a tool returned. Grounding (`src/lib/grounding.ts`) re-verifies plans and prices against the live backend; it is implemented, and **disabled for v1** by decision (see Phase 2 below) because YooWifi's rates change rarely and manually.
- Adding a new surface must require **config only, no code changes**.

**Current status:** this repo implements the *data/tool layer* — Phase 1, read-only, built and tested. The conversational layer is **not yet built**; the agreed architecture for it is below. Until it exists, no user-facing AI feature works end to end. The full request journey (user prompt → answer) is documented in [docs/end-to-end-flow.md](docs/end-to-end-flow.md).

---

## Phase 2 — the chat layer (agreed architecture, not yet built)

> **New here? Start with [docs/one-chat-story.md](docs/one-chat-story.md)** — the whole system in
> plain words, following one user's message from start to finish.
>
> Supersedes the earlier separate-process "AI Service" plan and the four-box draft.
> Full walkthrough with sequence diagrams: **[docs/end-to-end-flow.md](docs/end-to-end-flow.md)**.
> Validated against discovery reports from all three client surfaces — method in
> **[docs/app-discovery-prompt.md](docs/app-discovery-prompt.md)**, remaining questions in
> **[docs/discovery-questions.md](docs/discovery-questions.md)**.

### The constraint that shaped it

The original design assumed each client app's backend would proxy chat requests — holding the
API key and asserting tenant and user from its own login session. **Discovery confirmed no such
backend exists on any customer-facing surface.** Both the web app and the mobile app are pure
clients calling `coreapi.yoowifi.com` directly. That box is gone:

```
browser / app  →  this server (/chat → session → Claude ⇄ tools)  →  upstream
```

| Job the app backend did | Who does it now |
|---|---|
| Held a secret app key | **Gone** — replaced by a session pass this server mints and signs |
| Said which tenant this is | **This server**, from the request's origin/surface |
| Said who the user is | **Nobody in v1.** In v2, an OTP verified by upstream |

### The surfaces

| Surface | Delivery | In v1? |
|---|---|---|
| **Web** | `<script>` tag — no CSP, third-party widgets already injected this way | ✅ |
| **Mobile** (Expo/RN) | **WebView + expo-updates OTA** — no app-store release needed; a WebView↔native bridge is already proven in that codebase | ✅ |
| **CRM / admin** | out of scope — staff/reseller ops console with write operations | ❌ |

One chat page serves both live surfaces; only the delivery mechanism differs.

### Two session types

| | Anonymous (v1) | Authenticated (v2) |
|---|---|---|
| Tools | `search_plans`, `get_pricing`, `get_coverage` | + `check_order_status` |
| Identity | none — none of those tools needs one | `userId` confirmed by an **OTP**, held in the session |
| Blocked on | nothing — ships today | nothing external; reuses existing OTP endpoints |

Anonymous is safe by construction: those three tools return the same data anyone sees browsing
logged out — confirmed on both surfaces, where plan endpoints require no user id. Forcing a login
just to ask *"which plan for Japan?"* would kill the headline use case.

### How identity works — OTP, because no token exists

Discovery's biggest finding: **there is no authentication token anywhere in the YooWifi estate.**
All three surfaces use the user's **phone number** as the credential, resent as a plain field on
every request. So there is nothing to pass through and verify.

What *does* exist on both apps is an OTP flow on the dispatcher, and a successful OTP is a genuine
possession proof:

```
widget → this server → upstream:  authenticateForLogin { userId, captchaToken, fingerPrint }
                                  ↓ upstream sends an SMS passcode
widget → this server → upstream:  verifyAndLogin { userId, passCode }
                                  ↓ upstream returns the user
this server: bind that userId into the session, mint a new pass with auth: "user"
```

**Claude sees none of it.** No phone number, no passcode, no user id passes through any tool
schema — the credential path and the conversation path never cross. Security is exactly as strong
as the apps' own login, because it *is* the apps' own login.

The user is never the one who says who the user is. *"Show me orders for u-99999"* does nothing,
because the tool has no user field for the model to fill.

### Design decisions on record

| Decision | Rationale |
|---|---|
| **Three boxes, no app backend** | Confirmed by discovery on both customer surfaces. Not a workaround — the shape of the estate. |
| **Tenant from origin/surface, never a client-supplied tenant id** | Removes the field a user could tamper with. |
| **`publicChat` allowlist per tenant** | Origin (web) and surface parameter (mobile) are both forgeable by a script. Don't make forging impossible — make it **worthless**: only tenants whose data is already public are reachable from the chat endpoint. B2B and the CRM stay off it. |
| **Identity via OTP, not a token** | No token exists anywhere. The OTP flow already exists on both apps and is buildable entirely on our side. |
| **Credential flow never touches Claude** | Phone numbers and passcodes move widget → this server → upstream. No tool schema carries them. |
| **`userId` / `promoCode` removed from LLM-facing tool schemas** | Any field in a tool schema is a field the model can fill from the conversation. `userId` made impersonation a one-sentence prompt; `promoCode` made `/chat` a code-guessing oracle. |
| **Tool menu filtered by session state; the message is never inspected** | Enforcement belongs in the dumb, trusted layer; language understanding belongs in the smart, untrusted one. Claude refusing is not the protection — Claude having nothing to refuse *with* is. |
| **`request_sign_in` is a zero-power tool** | No arguments, no return, no access. A prompt-injected call achieves only an unnecessary prompt. |
| **One deployment, chat as a module (`src/ai/`)** | No HTTP hop between `/chat` and the tool handlers; `DirectToolInvoker` fills `tenantContextStorage` in-process. |
| **Tool runner + direct invocation, not Anthropic's server-side MCP connector** | The connector authenticates with a bearer token only — it cannot carry our per-request tenant headers. Don't restructure `tenantAuth` to chase it. |
| **Mobile via WebView + OTA** | Bridge pattern already proven in that codebase; ships without app-store review. |
| **CRM excluded** | Write operations (`chargeCustomer`, `refund`, `activateEsim`, `bulkOrders`) and client-side-only role enforcement. Different product. |
| **Locale normalized once at our boundary** | Surfaces disagree on locale codes, but that's input normalization, not per-tenant plumbing. |
| **Grounding disabled for v1** | Plans and rates change rarely and manually at YooWifi. Halves upstream calls and latency. Code stays behind a flag. |
| **Request/response for v1, not SSE** | Streaming would have to be plumbed through every surface. Additive later. |
| **Session state interface-backed** | Matches the registry/rate-limiter swap pattern already used in Phase 1. |

### Build plan

Phased, ordered by dependency, with per-phase deliverables and done-when criteria:
**[docs/build-plan.md](docs/build-plan.md)**. Phases A–D are safe to start now; the first real
checkpoint is E (the whole pipeline working before the LLM is involved).

### Prerequisites before the chat layer ships

All in this repo. **None require backend access.** Detailed breakdown in the build plan above.

1. **`publicChat` + `allowedOrigins` per tenant** — `src/registry/schema.ts` + `tenants.json`, enforced at session creation.
2. **Remove `userId` and `promoCode`** from `searchPlansInputSchema` and `getPricingInputSchema`. They stay on the canonical contract — set server-side, not by the model.
3. **`check_order_status` takes `userId` from the session**, not from tool args. Today `handleCheckOrderStatus` uses the LLM-supplied value and ignores the trusted `TenantContext` one.
4. **Re-key rate limiting** — `checkRateLimit(tenantId, ...)` is currently one bucket per tenant (60/min for the *whole* Malaysia website). Under public traffic one abuser exhausts it for every real user. Key on session + IP/device + tenant, add a per-session token budget, and add per-phone-number limits for OTP.
5. **`GROUNDING_ENABLED` flag** in `src/config.ts` — grounding is unconditional today in `searchPlans.ts` and `getPricing.ts`.
6. **Session store** — interface-backed: ~30 min idle TTL, ~20 turns retained, bounded size with LRU eviction. Redis once more than one instance runs.
7. **Origin/surface → tenant map**, driving tenant derivation and the CORS allowlist.
8. **`/chat` route** — pass minting and verification, gate, Claude tool runner, `DirectToolInvoker`, menu filtering.
9. **Chat widget** — one page served from this server; script tag on web, WebView on mobile.
10. **Locale plumbing** — `locale` on `TenantContext` and the pass, one normalization table, the reply-language rule in the system prompt.
11. **`description` and the translated plan name on `CanonicalPlan`** + adapter mapping — upstream returns `trPlanName`/`trDescription` and [`websiteAdapter.ts:47`](src/adapters/websiteAdapter.ts#L47) discards them, so translated names never reach Claude. `CanonicalPlan` also has no `description` at all.
12. **(v2)** OTP proxying, captcha enforcement, per-number rate limits, session upgrade, `request_sign_in`.

> **Note on `localeRule`:** it exists in the schema and all three tenants but never fires —
> `resolveLanguage()` looks up `remap[localeRule.default]`, i.e. `remap["EN"]`, so the language
> sent upstream is always the tenant default. The remap itself is correctly *shaped* (it
> normalizes language codes, e.g. `JP`→`JA`); only the plumbing of the user's locale is missing.
> `portalAdapter` sends no `language` at all.

### Open questions

None block v1. Full list in [docs/end-to-end-flow.md §13](docs/end-to-end-flow.md); the ones worth
asking the core API team:

- Which `source` / `platform` values does each app send to the dispatcher?
- Is `portal-tune` a distinct app, or a `source` inside the CRM? (One CRM serves all brands, so
  "~19 surfaces" is likely ~19 brand configurations across three or four apps.)
- Which language codes does the dispatcher accept?
- Does upstream validate `source` server-side? (Evidence suggests not — which makes our resolver
  the only thing keeping brands separate in our path.)

### The one non-code ask

Deployment, not backend code: somewhere to host this server on a domain, a `<script>` tag added to
the web app, and a WebView entry point shipped via OTA on mobile.

### Accepted risks

| Risk | Mitigation |
|---|---|
| **Public `/chat` used as a free LLM proxy** — the most likely abuse in practice. A bot check guards session *creation*, not session *use*; passes can be farmed. | Hard per-session token budget (not just request counts), per-IP/device and per-tenant limits, and a monthly spend cap on the Anthropic Console as the real backstop. |
| **OTP endpoint used to send unwanted SMS** | Captcha before every send (upstream already expects a `captchaToken`), strict per-number and per-session limits, a cap on resends. |
| **Internet-facing process holds every secret** — `ANTHROPIC_API_KEY` and all tenant secrets in one `process.env`. One-deployment was accepted when only known backends could reach it; browser-facing changes that premise. | Keys in env only, never in code. Nothing sensitive logged. Short session TTL. Rotation is an env change plus restart. Pino tags every request with tenant/requestId. |
| **IP-based limits are weak both ways** — Malaysian mobile CGNAT shares IPs across real users; attackers rotate proxies cheaply. | Never limit on IP alone; combine session + IP + tenant, use the mobile device fingerprint where available, and prefer token budgets to request counts. |

### Also still pending from Phase 1's scope

- `create_order` — registered as a stub; the Phase 2 write path needs idempotency, payment-gateway handling, per-tenant order flows, and explicit user confirmation (an LLM must not place an order on its own).
- Redis-backed rate limiter and DB-backed registry when tenant count grows.

### If backend access ever arrives

The four-box model comes back and is strictly stronger: the app backend asserts tenant and user
from its own login session, removing the bot check, the OTP flow, and the `publicChat`
restriction — and B2B portals become safe to include. The header contract in
`src/middleware/tenantAuth.ts` is already built for exactly this. Everything downstream of
`/chat` is identical in both models, so switching is a change to session creation, not a rebuild.

Note that the **CRM is the only surface that does have such a backend**, and it is also the one
excluded from v1.
# CampWise
