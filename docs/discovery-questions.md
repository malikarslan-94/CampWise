# Discovery — questions to answer before building the chat layer

Purpose: confirm the architecture in [end-to-end-flow.md](end-to-end-flow.md) matches how YooWifi's
apps and APIs **actually** work. Every design decision we've made rests on an assumption; this
document lists each assumption, the question that tests it, and **what changes if the answer is
different from what we expect**.

Answer these before writing chat code. A wrong assumption found now costs an afternoon; found
after the chat layer is built it costs a rewrite.

**How to use:**

- **For questions a codebase can answer** (A, C, E, and parts of B) — use
  [app-discovery-prompt.md](app-discovery-prompt.md). Paste that prompt into an AI assistant
  opened inside each client app's repo; it produces a structured report with file:line evidence.
  Run it once per surface.
- **For questions only a person can answer** (B1, D, G) — send those sections to the YooWifi core
  API / platform team.
- **Section F** — fill in yourself from the existing config and product knowledge.

---

## A. How each app connects to its backend

> Unblocks: whether the three-box model is right at all, or whether a four-box proxy is available
> after all. This is the highest-value section — everything else is downstream of it.

| # | Question | Why it matters | If the answer is "yes/available" |
|---|---|---|---|
| A1 | For each surface (website, Skylink app, each portal): does the frontend talk to a **backend of its own**, or straight to `coreapi.yoowifi.com`? | The whole three-box design exists because we assumed no app backend is reachable. | A per-app backend that can host ~20 lines of proxy makes the **four-box model** viable, which is strictly stronger — no bot check, no token round trip, no `publicChat` restriction, and B2B portals become safe. |
| A2 | If there is an app backend — who owns it, and is adding one endpoint genuinely impossible, or just unowned right now? | We've scoped v1 around "no backend access." Worth confirming that's a hard constraint, not an unasked question. | Same as A1. |
| A3 | Does the frontend hold any secret/API key today when it calls upstream? If so, how is it protected? | Tells us what the existing security posture actually is, and whether upstream already accepts anonymous browser traffic. | If browsers already call upstream directly, some of our concerns are already the status quo and the bar is lower than assumed. |
| A4 | Is there a CDN / WAF / Cloudflare in front of the surfaces? | Rate limiting and bot protection may already exist and be reusable. | We may not need Turnstile — reuse what's there. |

---

## B. Authentication and identity

> Unblocks: `check_order_status` and every other personal feature (v2). Does **not** block v1.

| # | Question | Why it matters | Impact |
|---|---|---|---|
| B1 | **What do I call to check a user's login token?** Endpoint, request shape, response shape. | This is *the* v2 dependency. This server cannot verify an identity claim itself — it has no user table. | No such endpoint → **no personal features at all** without app-backend access. v2 is blocked; v1 unaffected. |
| B2 | What kind of token is it — JWT, opaque session id, something else? Is it signed, and can it be validated offline? | An offline-validatable JWT means no round trip per session; an opaque token means one call to upstream. | Changes latency and whether we need to store the token at all. |
| B3 | How long do user tokens live, and is there a refresh flow? | Sessions outliving tokens is the most common bug in this design. | Short-lived tokens → we must handle expiry mid-conversation and ask the widget to refresh. |
| B4 | Is the login system **shared across all surfaces**, or does each tenant have its own? | Determines whether token verification also proves tenancy. | Per-tenant auth is *better* — a Skylink token can't verify against the portal, so faking the tenant self-destructs. |
| B5 | Is there any existing "get current user" / profile endpoint? | Often serves as a token validator even when no dedicated one exists. | An affirmative here may answer B1 by proxy. |
| B6 | Do the B2B portals use user logins, or a single shared partner credential? | Affects whether portal users can ever be individually identified. | Shared credential → per-user features are impossible for portals regardless of anything else. |

---

## C. Language and locale

> Unblocks: multi-language answers. Note the current code has `localeRule` but it never fires —
> see D5.

| # | Question | Why it matters | Impact |
|---|---|---|---|
| C1 | Which languages does YooWifi support today, per surface? | We need a supported-locale enum to validate against; unknown values fall back to the tenant default. | Defines the enum and the system-prompt instruction. |
| C2 | Does upstream return plan names/descriptions in multiple languages? What value does the `language` envelope field accept? | Determines whether "answer in Malay" means translating, or requesting Malay data upstream. | If upstream is English-only, Claude translates descriptions — and must still **not** translate plan names, codes, or currency. |
| C3 | What was `localeRule.remap` meant to do? The config reads `{"JP": "JA"}` — destination country → language — but the code looks up by *language*, so it never matches. | Either the config or the code is wrong; we need to know which was intended. | "Traveling to Japan → Japanese content" vs "user's UI language" are different features. |
| C4 | Does each surface know its user's current UI language, and can the widget read it? | This is the input to everything above. | If not available, fall back to `navigator.language`, then tenant default. |
| C5 | Are prices ever shown in different currencies per locale? | Currency must never be converted or re-symboled by the model. | Confirms the "never localise currency" rule in the system prompt. |

---

## D. Upstream API surface

> Unblocks: correctness of what's already built, and what's safe to expose.

| # | Question | Why it matters | Impact |
|---|---|---|---|
| D1 | Are plan/price lookups genuinely public — same data an anonymous visitor sees? | The entire anonymous-session design rests on this. | If any of the three v1 tools returns non-public data, **v1 needs auth** and the plan changes fundamentally. |
| D2 | Are `portal-tune` (B2B) rates confidential vs the public website rates? | Drives the `publicChat` allowlist. | Confirms B2B tenants must stay off the browser-facing endpoint. |
| D3 | How often do plans and prices actually change? Manual or automated? | We disabled grounding on the assumption that changes are rare and manual. | Frequent/automated changes → **re-enable grounding**, at least for `get_pricing`. |
| D4 | Is there rate limiting or abuse protection on `coreapi.yoowifi.com`? What are the limits? | Our chat traffic will multiply upstream calls. | Tight upstream limits may require caching plan lookups. |
| D5 | Is `promoCode` validated server-side, and does a wrong code fail loudly or silently? | We're removing `promoCode` from the model-facing schema so chat can't be used to guess codes. | Confirms the removal is necessary (it almost certainly is). |
| D6 | Are there per-user or member-tier prices? | `get_pricing` currently accepts an optional `userId`. | If pricing is user-dependent, anonymous pricing is *generic* pricing — the answer must say so, not imply it's the user's final price. |
| D7 | What's a realistic p50/p95 latency for the dispatcher endpoint? | Total chat latency = Claude round trips + upstream calls. | Slow upstream strengthens the case for SSE streaming sooner. |

---

## E. Delivering the widget

> Unblocks: whether users can reach the chat at all. **This is the one non-code dependency.**

| # | Question | Impact if "no" |
|---|---|---|
| E1 | Can a `<script>` tag be added to the client surfaces, and by whom? | **Hard blocker.** No delivery path exists without this. |
| E2 | Do the sites have a Content-Security-Policy? Can our origin be added to it? | Widget silently fails to load. |
| E3 | Where will this server be hosted, on what domain, with TLS? | Needed for CORS and for the widget's origin. |
| E4 | Is there a design system / brand guideline the widget must follow? | Rework later. |
| E5 | For the native Skylink app — is the chat in a WebView or native UI? | WebView sends an `Origin`; native does not. Native needs a different tenant-identification mechanism entirely. |

---

## F. Tenant inventory

> Fill in from existing config + product knowledge. `tenants.json` currently has **3** tenants;
> the README describes **~19 surfaces**.

| # | Question | Impact |
|---|---|---|
| F1 | What is the real list of surfaces, and which family does each belong to (`website` / `legacy_app` / `portal`)? | 3 configured vs 19 claimed — we're either incomplete or the 19 collapses into fewer configs. |
| F2 | Which are public-facing consumer surfaces vs B2B partner portals? | Directly sets `publicChat` per tenant. |
| F3 | Which surfaces are actually in scope for chat in v1? | Scoping the first release. |
| F4 | Does each surface have a distinct origin/domain? | Origin-based tenant derivation needs one-to-one mapping. Shared domains break it. |

---

## G. Cost, limits, compliance

| # | Question | Impact |
|---|---|---|
| G1 | What monthly budget is acceptable for Claude API spend? | Sets the Anthropic Console spend cap — our real backstop against abuse. |
| G2 | Expected chat volume — daily active users, messages per session? | Sizes rate limits and session-store capacity. |
| G3 | Any data-residency or PII rules? Can conversation content leave the region? | Chat content goes to the Anthropic API. Must be confirmed before launch, not after. |
| G4 | Retention policy for conversation history? | Sets session TTL and whether anything is persisted at all. |
| G5 | Does anything require conversations to be auditable/logged? | Changes the session store from ephemeral to persisted. |

---

## Our current assumptions — flag any that are wrong

These are what the design in [end-to-end-flow.md](end-to-end-flow.md) is built on. If any is
false, tell us before we build.

1. No app backend is available to proxy chat requests.
2. Plans, pricing, and coverage are public data — an anonymous visitor sees the same values.
3. B2B portal rates are **not** public and must stay off any browser-reachable endpoint.
4. Plans and prices change rarely and manually, so grounding can be disabled for v1.
5. Each client surface has a distinct origin we can map to a tenant.
6. Users are already logged in to their surface and hold a token we can pass through (v2).
7. A `<script>` tag can be added to at least one surface.
8. Conversation content is allowed to be sent to the Anthropic API.

---

## Answer-first priority

If bandwidth to ask is limited, these four decide the most:

1. **A1** — is there an app backend after all? *(could replace the whole session design)*
2. **B1** — what verifies a login token? *(gates every personal feature)*
3. **D1** — is plan/price data genuinely public? *(gates anonymous chat, i.e. all of v1)*
4. **E1** — can we get a script tag on the page? *(gates delivery entirely)*

Everything else can be defaulted and tuned later.
