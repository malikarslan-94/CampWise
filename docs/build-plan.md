# Phase 2 — Build Plan

Architecture and rationale: [end-to-end-flow.md](end-to-end-flow.md).
Evidence behind the decisions: the three client discovery reports (method in
[app-discovery-prompt.md](app-discovery-prompt.md)).

**Legend**

| Tag | Meaning |
|---|---|
| ✅ | Phase 1 code, unchanged |
| ✏️ | Phase 1 code that needs editing |
| ⬜ | New code |

---

## Two workstreams

| | Owner | Scope | Blocking? |
|---|---|---|---|
| **Part 1 — MCP server** | us, this repo | Chat endpoint, sessions, Claude, tools, the widget page itself | No external dependency |
| **Part 2 — App side** | web + mobile teams | Embedding the widget, passing surface + locale | Needed only at Phase G |

Part 1 is ~95% of the work and can proceed to completion without anyone else. Part 2 is small —
roughly a dozen lines per surface — but **nothing reaches a user until it lands**, so raise it
early rather than at the end.

---

# Part 1 — MCP server (this repo)

Everything in Part 1 lives in this repository and requires no backend access from any app team.

## Sequence

```
A ──► B ──► C ──► D ──► E ──► F ──► G ──► H
                              │           ▲
                              └─── I ─────┘
```

| Checkpoint | After | What you have |
|---|---|---|
| Pipeline proven | **E** | Tools callable through the chat path, with no LLM involved |
| Chat works | **F** | Real natural-language answers via curl |
| **v1 ships** | **G** | Users can chat on web + mobile |
| **v2 ships** | **H** | Personal features (order status) |

**A–D are safe to start now.** No open question touches them, and A is worth doing whether or not
the chat layer ever ships.

**Aim for E first.** Proving the pipeline before the LLM is in the way means that when Claude
misbehaves in F, you know it's the prompt and not the plumbing.

---

## Phase A — Harden the existing tools ✅ DONE

**Size: S · No new dependencies · Do first**

Closes real gaps in code that already exists. Independent of every open question.

| # | Task | Status |
|---|---|---|
| A1 | Remove `userId` and `promoCode` from `searchPlansInputSchema` and `getPricingInputSchema` (also `appUserId`, `paymentGateway`). Kept on the canonical contract — set server-side from `TenantContext`, never by the model. | ✅ |
| A2 | `check_order_status`: `userId` **and** `phone` removed from the input schema — both were impersonation vectors. `userId` now read from `TenantContext`; an anonymous context is refused before the adapter is reached. `orderId` stays, since it only narrows a result set already scoped to the context's user. | ✅ |
| A3 | `GROUNDING_ENABLED` in `config.ts` + non-throwing `isGroundingEnabled()`; wired into `searchPlans.ts` and `getPricing.ts`. Defaults **off**. | ✅ |
| A4 | `CanonicalPlan` gained `description`, `planNameLocalized`, `descriptionLocalized`; `mapPlan` now carries `trPlanName` / `trDescription` (both camelCase and snake_case), treating empty as absent. | ✅ |
| A5 | `portalAdapter` now sends `language`. | ✅ |
| A6 | Guard tests in `test/toolIdentityGuard.test.ts` — driven by a **dummy app payload** plus hostile extras. | ✅ |
| A7 | Tests updated; `getPricingGrounding.test.ts` mocks the flag on, since grounding now ships off. | ✅ |
| A8 | **Refactor:** `resolveLanguage` and `mapPlan` were triplicated across the three adapters — extracted to `src/adapters/shared.ts`. A4 and A5 became one-place changes, and B4 will be too. | ✅ |

**Files:** `src/tools/*`, `src/canonical/contract.ts`, `src/adapters/*` (+ new `shared.ts`),
`src/config.ts`, `src/resolver/types.ts`, `test/*` (+ new `toolIdentityGuard.test.ts`,
`planMapping.test.ts`)

**Result:** typecheck clean, **74 tests passing across 12 files** (was 68 across 11).

**What this closed:** story step 36 now holds. `check_order_status` previously read `userId`
straight from tool arguments, so *"show me the orders for u-99999"* was a working exploit the
moment a conversation could reach it. There is now no field in any tool schema that names a user.

---

## Phase B — Registry and config for chat ✅ DONE

**Size: S**

| # | Task | Status |
|---|---|---|
| B1 | `publicChat` (default **false** — opt in explicitly) and `allowedOrigins` in `registry/schema.ts` + `tenants.json`. A `.refine()` rejects `publicChat: true` with no origins: configured-but-unreachable fails at startup rather than silently serving nobody. | ✅ |
| B2 | `ANTHROPIC_API_KEY`, `SESSION_SIGNING_KEY` (min 32 chars), `RECAPTCHA_SECRET` added as **optional**, so the MCP server still starts without them, plus `validateChatConfig()` which the chat route calls at startup to make them mandatory. A half-configured public chat endpoint is worse than none. | ✅ |
| B3 | `src/lib/locale.ts` — `SUPPORTED_LOCALES` (ISO 639-1 + BCP-47 script subtags), an alias table covering every code any surface sends, `normalizeLocale()`, `toUpstreamLanguage()`, `localeDisplayName()` for the system prompt. | ✅ |
| B4 | `locale` on `TenantContext`; `resolveLanguage()` now uses caller locale → tenant default → per-tenant `remap` as an escape hatch. **The remap now actually fires.** | ✅ |
| B5 | `getTenantByOrigin()` on the registry (case-insensitive, trailing slash tolerated, chat-enabled tenants only) + `collectChatOrigins()` for the CORS allowlist. Two tenants claiming one origin throws at load. | ✅ |

**Files:** `src/registry/{schema,registry,tenants.json}`, `src/config.ts`, `src/resolver/types.ts`,
`src/adapters/shared.ts`, new `src/lib/locale.ts`, new tests `locale.test.ts`,
`chatRegistry.test.ts`, plus locale cases in `adapters.test.ts`

**Result:** typecheck clean, **94 tests across 14 files** (was 74 across 12).

> **`localeRule` now fires.** It never did before — `resolveLanguage()` looked up
> `remap[localeRule.default]`, i.e. `remap["EN"]`, which never matched. The remap was correctly
> *shaped* all along (it normalises language codes, e.g. `JP`→`JA`); only the caller's locale was
> missing. It is now the last step, applied on top of the shared table.

> **⚠️ `allowedOrigins` holds only `localhost` values.** Real production origins need the
> tenant-inventory answer (open questions 1–2) — one web build serves `yoowifi.com`, `.id`, `.ph`
> and `garuda.yoowifi.com`, and we do not yet know which of those are one tenant. Deliberately not
> guessed. `app-skylink` and `portal-tune` are `publicChat: false`.

> **⚠️ `UPSTREAM_LANGUAGE` is provisional.** It defaults to the web surface's wire format, which is
> live in production and therefore known to work. Only Japanese (`JA`) is verified against both
> surfaces. The full list the dispatcher accepts is open question 3.

---

## Phase C — Rate limiting rework ✅ DONE

**Size: M**

| # | Task | Status |
|---|---|---|
| C1 | `checkChatRateLimit()` checks five independent dimensions — session/minute, session/day, client/minute, client/day, tenant/minute — cheapest-and-most-specific first, since a runaway loop in one conversation is the realistic failure. The tenant-only `checkRateLimit()` stays for the tool handlers. | ✅ |
| C2 | `ChatRequestIdentity.client` — the mobile app's `deviceFingerprint` where it sends one, IP otherwise. Never IP alone. | ✅ |
| C3 | `consume(key, limit, windowMs, cost)` generalised the token bucket, so minute and day windows are the same primitive. | ✅ |
| C4 | `recordTokenSpend()` / `remainingTokenBudget()` — a per-session daily token budget, checked before the model call and recorded after, since usage is only known then. An oversized call is allowed to complete and the *next* one is refused; rejecting work already done upstream helps nobody. | ✅ |
| C5 | Interface unchanged in shape — `RateLimiter` gained `consume`/`remaining`, still Redis-swappable. | ✅ |
| C6 | **Bucket eviction.** The map previously grew once per unique key forever — a leak on a public endpoint. Now sweeps day-stale buckets and LRU-evicts above a cap. | ✅ |
| C7 | `RateLimitedError` carries a `dimension` so logs can distinguish a per-session trip from a tenant-wide one. Never surfaced to the caller. | ✅ |

**Files:** `src/middleware/rateLimit.ts`, `src/lib/errors.ts`, new `test/chatRateLimit.test.ts`

**Result:** typecheck clean, **104 tests across 15 files** (was 94 across 14).

> **⚠️ `DEFAULT_CHAT_LIMITS` are provisional** — 10/min and 100/day per session, 20/min and
> 200/day per client, 200k tokens/day per session. Picking these precisely before seeing real
> traffic is theatre; they are one exported object, to be tuned after a week of usage.

---

## Phase D — Session layer ✅ DONE

**Size: M**

| # | Task | Status |
|---|---|---|
| D1 | `SessionStore` interface + `InMemorySessionStore`: 30 min idle TTL, 20 turns retained, 10k session cap. Eviction drops **idle sessions before live ones**, then falls back to least-recently-touched; `get()` re-inserts on access so Map order tracks recency. | ✅ |
| D2 | `mintSessionPass` / `mintPassForSession` / `verifySessionPass` — HMAC-SHA256, `timingSafeEqual`, signature checked before expiry. Returns a typed result (`malformed` / `bad_signature` / `expired`) rather than a bare boolean, so the widget can quietly re-open a session on expiry while a forged pass is logged. | ✅ |
| D3 | `SessionData`, `AuthState`, `ConversationTurn` in `src/ai/session/types.ts`. | ✅ |

**Files:** new `src/ai/session/{types,store,pass}.ts`, new `test/sessionPass.test.ts`,
`test/sessionStore.test.ts`

**Result:** typecheck clean, **129 tests across 17 files** (was 104 across 15).

> **History is stored as plain text turns, not the model's own message objects.** A turn's tool
> traffic — `tool_use` blocks and their results — is transient: it lives inside one tool-runner
> loop and is dropped afterwards. Persisting it would mean re-sending every plan list on every
> later turn, which is precisely what exhausts the token budget from phase C4. The assistant's
> final text carries the continuity that matters.

> The pass carries `tenantId`, `auth`, `userId` and `locale` **sealed and signed**. The client can
> read it but cannot rewrite it — `sessionPass.test.ts` pins each tampering attempt separately:
> self-promotion to `auth: "user"`, tenant switching, expiry extension, session hijacking.

---

## Phase E — Chat plumbing, no LLM yet ✅ DONE

**Size: M · First real checkpoint**

| # | Task | Status |
|---|---|---|
| E1 | `POST /chat/session` — tenant from `Origin` (web) or a `surface` field (native, which sends none) → `publicChat` check → reCAPTCHA → mint pass. Locale normalised on the way in. | ✅ |
| E2 | `POST /chat` — gate in order: pass signature → session lookup → rate limits → Zod. Every failure short-circuits **before** the responder, so a rejected request costs nothing. | ✅ |
| E3 | CORS from the same origin map that resolves tenancy — one source of truth. | ✅ |
| E4 | `DirectToolInvoker` fills `tenantContextStorage` from the session and calls the Phase-1 handlers in-process. Refuses auth-required tools on anonymous sessions as a second guard behind menu filtering. | ✅ |
| E5 | Both routes wired into `src/index.ts`, in front of the MCP middleware since they authenticate with a pass rather than the service key. | ✅ |
| E6 | **`ChatResponder` seam** — `StubResponder` now, the Claude tool runner in F. Everything around it is identical either way. | ✅ |
| E7 | **`src/tools/registry.ts`** — one tool table shared by MCP and chat, carrying `requiresAuth` and `hiddenFromChat`. `server.ts` refactored onto it. | ✅ |

**Files:** new `src/ai/{routes,http,recaptcha,stubResponder,DirectToolInvoker}.ts`,
new `src/tools/registry.ts`, `src/server.ts`, `src/index.ts`, new `test/chatRoutes.test.ts`

**Result:** typecheck clean, **147 tests across 18 files** (was 129 across 17).

> **The chat module only mounts when a tenant has opted in.** If any tenant is
> `publicChat: true`, `validateChatConfig()` runs at startup and the server refuses to boot
> without `ANTHROPIC_API_KEY`, `SESSION_SIGNING_KEY` and `RECAPTCHA_SECRET` — a half-configured
> public endpoint is worse than none. With no public tenants it logs and stays off.

> **One behaviour change:** `create_order`'s MCP message now comes from `NotImplementedError`
> rather than a hardcoded string in `server.ts` (dropping a trailing full stop). The old inline
> guard was there in case the stub handler vanished; the registry now blocks it in two
> independent places — `hiddenFromChat` keeps it off the model's menu, and the handler throws.

> **No captcha bypass flag.** Google publishes always-passing test keys for local development;
> a bypass would eventually ship enabled. The verifier is injectable, so tests never hit
> the network, and it **fails closed** — an unreachable verifier cannot tell a human from a
> script, and this endpoint costs money to serve.

---

## Phase F — Claude integration

**Size: M**

| # | Task | Tag |
|---|---|---|
| F1 | Add `@anthropic-ai/sdk`. | ⬜ |
| F2 | System prompt builder — persona, *"only state what the tools return"*, the reply language, and the **never-translate rule** (plan names, plan codes, currency stay exactly as upstream returned them; a translated plan name is one the user cannot find or buy). | ⬜ |
| F3 | Tool definitions generated from the existing Zod schemas. | ⬜ |
| F4 | **Menu filtering by `session.auth`.** The message is never inspected — no classifier decides "is this personal?". Anonymous sessions simply receive three tools. | ⬜ |
| F5 | Tool runner loop; append turns to the session; return `{ sessionId, answer }`. | ⬜ |
| F6 | **Pick the model.** Check current model ids at implementation time — do not inherit `claude-opus-4-8` from the superseded draft. | ⬜ |

**Files:** new `src/ai/claude/*`, `src/ai/prompt.ts`

**Done when:** a curl to `/chat` returns a natural-language answer containing live prices.

---

## Phase G — Widget

**Size: M · v1 ships after this**

| # | Task | Tag |
|---|---|---|
| G1 | One static chat page served from this server. Must work identically embedded by `<script>` in a browser and loaded in a WebView. | ⬜ |
| G2 | Session bootstrap, message send, render, error and retry handling. | ⬜ |
| G3 | reCAPTCHA integration. | ⬜ |
| G4 | **Locale contract:** `init({ locale })` and `setLocale()`. The host passes its **currently selected language** — see below. | ⬜ |
| G5 | Persistent sign-in control (inert until Phase H). | ⬜ |

**Files:** new `public/widget/*`

**Done when:** the widget works on a test page via script tag, and in a WebView.

### The locale contract

**The app already has a selected language. Use that one.** Do not derive it from the device or
browser, and do not scrape another library's storage keys — that breaks on their next upgrade.

| Surface | Where the app's selection lives |
|---|---|
| **Web** | i18next current language (detector order `cookie → htmlTag → localStorage → path → subdomain`, cached to cookie) |
| **Mobile** | `user.language` from the stored profile, set in the Preferences screen. **Not the device locale** — the app has no device-locale detection and hardcodes `en` at boot |

That mobile detail matters: a signed-out mobile user has **no language signal beyond `en`**. If we
invented a locale from the device, the chat would speak a different language than the screen
around it.

```js
YooChat.init({ locale: i18n.language })     // web
YooChat.setLocale('ms')                     // when the user switches mid-session
```

```
/widget?surface=app-yoowifi&locale=ja       // mobile, from user.language
```

Priority: **host-provided → tenant default.** No browser or device guessing in between.

---

## Phase H — v2 sign-in (OTP)

**Size: M**

There is no authentication token anywhere in the YooWifi estate — all three surfaces use the
user's phone number as the credential. So there is nothing to pass through and verify. What does
exist on both apps is an OTP flow, and a successful OTP **is** a possession proof.

| # | Task | Tag |
|---|---|---|
| H1 | `request_sign_in` — a **zero-power tool**: no arguments, no return value, no access granted. Its only effect is telling the widget to surface the login UI. A prompt-injected call achieves nothing beyond an unnecessary prompt. | ⬜ |
| H2 | `POST /chat/otp/request` → proxies `authenticateForLogin { userId, captchaToken, fingerPrint }`. Captcha is **mandatory** — upstream already expects a `captchaToken`. | ⬜ |
| H3 | `POST /chat/otp/verify` → proxies `verifyAndLogin { userId, passCode }`. | ⬜ |
| H4 | **Per-phone-number rate limits** and a resend cap. This endpoint sends SMS; without limits it is an SMS-flooding tool pointed at arbitrary numbers. | ⬜ |
| H5 | On success: bind the verified `userId` into the session, mint a **new pass** with `auth:"user"`. | ⬜ |
| H6 | `check_order_status` joins the menu for authenticated sessions. | ⬜ |

**Files:** new `src/ai/auth/*`, `src/tools/requestSignIn.ts`

**Done when:** OTP verifies, real orders return, and *"show me the orders for u-99999"* returns
the signed-in user's own orders — quietly, with no error.

> **Claude never touches the credential path.** Phone numbers and passcodes move widget → this
> server → upstream. No tool schema carries them. The credential path and the conversation path
> never cross.

---

## Phase I — Ops hardening

**Size: S · Runs in parallel with G and H**

| # | Task |
|---|---|
| I1 | Anthropic Console **monthly spend cap** — external, not code. This is the real backstop against cost abuse; everything else is friction. |
| I2 | Structured logging and metrics across the chat path (pino already tags tenant + requestId). |
| I3 | Abuse testing: farmed session passes, forged origins, OTP flooding, long-conversation token growth. |

---

## Blocked — not a build phase

**Tenant inventory.** Two discovery findings land here, and neither is code:

- One web build serves `yoowifi.com`, `yoowifi.id`, `yoowifi.ph`, and `garuda.yoowifi.com`.
  Are those one tenant with several origins, or several tenants? Different countries usually mean
  different pricing.
- `portal-tune` is probably a `source` value inside the CRM rather than a separate application —
  one CRM serves all brands (Yoowifi, Yogofi, TuneTalk, MyRepublic, Skylink, WBB).

`allowedOrigins` as an array handles *many origins → one tenant*. It does **not** decide whether
they *should* be one tenant.

**This is the only thing that could still change `tenants.json` structurally.** It does not block
A–H, but it does block adding surfaces beyond the two we already know.

Resolve via open questions 1 and 2 in [end-to-end-flow.md §13](end-to-end-flow.md).

---

## Deferred decisions

| Decision | Settle at |
|---|---|
| Which Claude model | **F** — check current model ids then |
| Session TTL / turn-retention numbers | **D** — proposed 30 min / 20 turns, tune after real traffic |
| Exact rate-limit numbers and spend cap | **C** / **I** — guessing before seeing usage is theatre |
| SSE streaming | after **G** — additive; the tool runner supports both |
| Re-enabling grounding | if pricing ever becomes dynamic; the flag from A3 makes it a config change |

---

# Part 2 — App side

Small, but on the critical path: no user reaches the chat until this ships.

**Nothing here touches an app backend.** These are client-side changes in each app's own repo,
following patterns those codebases already use.

## What we provide

The interface between Part 1 and Part 2. Finalised in Phase G, but agree the shape early so the
app teams can plan.

| | |
|---|---|
| **Widget script** | `https://<our-domain>/widget/v1.js` — self-contained, no dependencies |
| **Widget page** (mobile) | `https://<our-domain>/widget?surface=<id>&locale=<code>` |
| **Init** | `YooChat.init({ surface, locale })` |
| **Locale change** | `YooChat.setLocale(code)` |
| **Open/close** (optional) | `YooChat.open()` / `YooChat.close()` |

Each team also needs **their surface identifier** from us — the value that maps to their tenant
record. Blocked on open question 1 (which `source` / `platform` values each app sends); see
[end-to-end-flow.md §13](end-to-end-flow.md).

---

## Web app (`yooweb-newdesign`)

**Size: XS · React 18 + Vite SPA**

| # | Task |
|---|---|
| W1 | Inject the widget script. **Follow the existing pattern** — `index.html:150-207` already does hostname-conditional `document.createElement('script')` + `head.appendChild` for Respond.io. Copy it. |
| W2 | Call `YooChat.init({ surface, locale: i18n.language })` after i18next initialises (`src/main.jsx:24-103`). |
| W3 | Wire `YooChat.setLocale()` into the existing language switcher (`src/components/shared/others/LanguageChange.jsx`). |
| W4 | Decide placement and z-index against the existing Respond.io bubble — see *Conflicts* below. |
| W5 | Confirm the widget survives client-side route changes (React Router SPA — it should, since it lives outside `#root`, but verify). |

**Not needed:** no CSP exists anywhere in that repo, so no allowlisting. Third-party scripts
already load unrestricted.

---

## Mobile app (Expo / React Native)

**Size: S · Ships via OTA, no app-store release**

| # | Task |
|---|---|
| M1 | New screen with `react-native-webview` loading `/widget?surface=…&locale=…`. The dependency is already declared and used for payments (`src/components/Payment/WebPayModal.tsx:67-70`). |
| M2 | Pass `locale` from **`user.language`** (the stored profile value), not the device locale — see *The locale contract* in Phase G. Falls back to `en`, matching app behaviour. |
| M3 | Entry point — tab item, header button, or floating bubble. |
| M4 | JS bridge if native↔web messaging is needed. **A working pattern already exists** in `src/components/YoutubePlayer/YoutubeIframe.tsx:151,388` (`postMessage` / `onMessage`) — copy it rather than prototyping. |
| M5 | Handle Android back button, keyboard avoidance, and safe-area insets around the WebView. |
| M6 | Optionally forward `deviceFingerprint` (`src/helpers/deviceFingerprint.ts`) so rate limiting keys on install id rather than IP — meaningfully better under carrier CGNAT. |
| M7 | Ship via `expo-updates` OTA (`src/initApp.tsx:75-91`). A JS-only WebView entry point needs no store review. |

---

## Conflicts and design questions

Raise these before Phase G, not during.

**Two chat bubbles on the web app.** Respond.io is already embedded and live. Options: replace it,
have ours open from a different entry point, or merge the entry points. This is a product decision
and someone owns Respond.io today — find out who first.

**Navigation handoff.** When the assistant recommends a plan, should tapping it take the user to
that plan's page? That's a meaningful UX win and it needs a callback:

```js
YooChat.init({ onNavigate: (route) => history.push(route) })   // web
```

On mobile, the same thing over the M4 bridge. **Decide now** — retrofitting a callback after the
widget API is public is more disruptive than including it from the start.

**Signed-out mobile users have no language signal.** The app hardcodes `en` at boot and ignores
device locale entirely. So an anonymous mobile user gets an English chat regardless of their
phone's setting. Matching the app is the correct default — but if that's undesirable, the fix
belongs in their app, not in our widget.

---

## External asks

Neither is backend code.

| Ask | Who | Needed by |
|---|---|---|
| Somewhere to host this server on a domain, with TLS | infra | **E** |
| Web: script tag + `init({surface, locale})` + `setLocale()` | web team | **G** |
| Mobile: WebView screen + surface/locale params, shipped OTA | mobile team | **G** |
| The Respond.io coexistence decision | product | **G** |

The locale parameter is one extra argument on web and one URL parameter on mobile — raise it in
the same conversation as the script tag, since it is the same one-line change.

---

# Part 3 — Traceability

Every step of [one-chat-story.md](one-chat-story.md) mapped to the code that implements it, the
phase it belongs to, and whether it exists yet.

**Status:** ✅ built & correct · ✏️ exists, needs editing · ⬜ not built

## Startup

| # | Story step | Implemented by | Phase | Status |
|---|---|---|---|---|
| 0 | Server wakes, checks keys, reads tenant list | `loadConfig()`, `loadRegistry()`, `validateSecretRefs()` — [config.ts](../src/config.ts), [registry.ts](../src/registry/registry.ts), [index.ts](../src/index.ts) | P1 | ✅ |
| 0a | …plus the new keys (`ANTHROPIC_API_KEY`, `SESSION_SIGNING_KEY`, `RECAPTCHA_SECRET`, `GROUNDING_ENABLED`) | `ConfigSchema` — [config.ts](../src/config.ts) | P1 | ✏️ **B2** |

## Part 1 of the story — Ali asks about plans

| # | Story step | Implemented by | Phase | Status |
|---|---|---|---|---|
| 1–2 | Widget loads, Ali clicks | `public/widget/v1.js` + the web team's script tag | P2 | ⬜ **G1 / W1** |
| 3 | Session created; website → company; language handed over | `POST /chat/session` | P2 | ⬜ **E1** |
| 3a | …the origin → tenant map | `allowedOrigins` in [schema.ts](../src/registry/schema.ts) + [tenants.json](../src/registry/tenants.json) | P1 | ✏️ **B1 / B5** |
| 3b | …the app passing its current language | `YooChat.init({locale})` | P2 | ⬜ **G4 / W2 / M2** |
| 4 | Is this website allowed a chat? | `publicChat` flag + check in `/chat/session` | P1 ✏️ + P2 ⬜ | **B1 / E1** |
| 5 | Invisible robot check | reCAPTCHA verify | P2 | ⬜ **E1** |
| 6 | Pass minted (company · auth · language · expiry) | HMAC mint — `src/ai/session/pass.ts` | P2 | ⬜ **D2** |
| 7 | Ali types; widget sends pass + words | widget send | P2 | ⬜ **G2** |
| 8 | Doorman: pass valid? rate limit? sane body? | `POST /chat` gate | P2 | ⬜ **E2** |
| 8a | …the rate limiter itself | [rateLimit.ts](../src/middleware/rateLimit.ts) — currently one bucket per **tenant** | P1 | ✏️ **C1–C4** |
| 9 | Open the notebook | `SessionStore` — `src/ai/session/store.ts` | P2 | ⬜ **D1** |
| 10 | **Pick the menu** from the pass | menu filter | P2 | ⬜ **F4** |
| 11 | Call Claude — rules + history + question + menu | Anthropic SDK + system prompt | P2 | ⬜ **F1–F3** |
| 12 | Claude replies `{name, input}` | tool runner | P2 | ⬜ **F5** |
| 13 | Match name → function | tool table exists in [server.ts](../src/server.ts) ✅, but the chat path needs its own dispatch | P1 ✅ + P2 ⬜ | **E4** |
| **14** | **Do the real work** — validate → resolve → rate limit → adapter → upstream → canonical | `handleSearchPlans` → `resolve()` → `checkRateLimit()` → `websiteAdapter.searchPlans()` → `httpPost()` | **P1** | **✅** |
| 14a | …tenant + language taken **from the pass** | `DirectToolInvoker` fills `tenantContextStorage` | P2 | ⬜ **E4** |
| 14b | …`userId` / `promoCode` gone from the schemas | [searchPlans.ts](../src/tools/searchPlans.ts), [getPricing.ts](../src/tools/getPricing.ts) | P1 | ✏️ **A1** |
| 14c | …translated plan names survive the adapter | [contract.ts](../src/canonical/contract.ts), [websiteAdapter.ts:47](../src/adapters/websiteAdapter.ts#L47) | P1 | ✏️ **A4** |
| 14d | …`portalAdapter` sends a `language` at all | [portalAdapter.ts](../src/adapters/portalAdapter.ts) | P1 | ✏️ **A5** |
| 14e | …grounding **skipped** | [grounding.ts](../src/lib/grounding.ts) — currently unconditional | P1 | ✏️ **A3** |
| 15 | Call Claude again with the plans | tool runner loop | P2 | ⬜ **F5** |
| 16 | Claude writes the Malay answer, plan name untouched | system prompt never-translate rule | P2 | ⬜ **F2** |
| 17 | Save the exchange, send the answer | session append + route response | P2 | ⬜ **D1 / E2** |
| 18–19 | Ali reads; asks again on the same pass | widget + session lookup | P2 | ⬜ **G2 / D1** |

## Part 2 of the story — Mobile

| # | Story step | Implemented by | Phase | Status |
|---|---|---|---|---|
| 20 | Same page, loaded in a WebView, given surface + language | widget page (ours) + WebView screen (theirs) | P2 | ⬜ **G1 / M1–M7** |

## Part 3 of the story — Signing in

| # | Story step | Implemented by | Phase | Status |
|---|---|---|---|---|
| 21–22 | Order tool was never on the menu; Claude says sign in | menu filter + `request_sign_in` | P2 | ⬜ **F4 / H1** |
| 23–24 | Ali types his phone number | widget sign-in UI | P2 | ⬜ **G5** |
| 25 | Server asks YooWifi to text a code | `POST /chat/otp/request` → `authenticateForLogin` | P2 | ⬜ **H2** |
| 25a | …per-number limits so this isn't an SMS cannon | OTP rate limits | P2 | ⬜ **H4** |
| 26–27 | Ali types the code; server checks it | `POST /chat/otp/verify` → `verifyAndLogin` | P2 | ⬜ **H3** |
| 28 | YooWifi confirms `u-12345` | upstream | — | ✅ exists |
| 29 | Pass replaced with `logged in as u-12345` | session upgrade + re-mint | P2 | ⬜ **H5** |
| 30 | Menu grows to four tools | menu filter | P2 | ⬜ **F4 / H6** |
| 31–32 | Claude requests `check_order_status`, empty payload | tool runner | P2 | ⬜ **F5** |
| **33** | **Server runs it — user from the session** | [checkOrderStatus.ts](../src/tools/checkOrderStatus.ts) — **today it uses the LLM-supplied `userId` and ignores the trusted one** | P1 | ✏️ **A2** |
| 34 | Claude writes the answer | tool runner | P2 | ⬜ **F5** |

## Part 4 of the story — The attack

| # | Story step | Implemented by | Phase | Status |
|---|---|---|---|---|
| 35–36 | *"Show me u-99999's orders"* does nothing | **A2** — no tool schema names a user | P1 | ✅ |

> **Step 36 now holds.** Covered by `test/toolIdentityGuard.test.ts`, which drives the handlers
> with a dummy app payload plus injected `userId` / `phone` / `tenantId` and asserts the trusted
> context wins every time.

## The tally

*Updated after Phase C.*

| Status | Steps | Notes |
|---|---|---|
| ✅ **Built and correct** | **10** — 0, 0a, 3a, 8a, 14, 14b–14e, 33/35–36 | Step 14 is the whole existing repo, and it is the step doing all the real work |
| ✏️ **Exists, needs editing** | **0** | Every pre-existing gap is closed |
| ⬜ **Not built** | **26** | Everything in the chat layer |

**Phases A–C are complete.** Nothing in the existing codebase now needs changing — what remains
is new code. The next phase (D, sessions) is the first that is purely additive.

**The one already-correct step is the expensive one.** Step 14 — validate, resolve tenant, pick
adapter, encrypt or sign per family, call upstream, map back to canonical — is the hardest part of
the system, and it is done and tested. Everything remaining is plumbing around it.

**One row is a live gap, not a future feature.** Step 33 is ✏️ rather than ⬜ because the code
exists and does the wrong thing. It was safe when only a trusted server could call it; it stops
being safe the moment a conversation can. That is the strongest argument for doing Phase A before
anything else.
