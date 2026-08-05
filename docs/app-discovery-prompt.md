# App discovery prompt

Paste the block below into an AI coding assistant **opened inside a client app's repository**
(the YooWifi website, the Skylink mobile app, a partner portal — one repo at a time).

**Sections F and G are surface-specific.** F only applies to native mobile apps, G only to
portals and admin consoles. The prompt tells the assistant to skip whichever doesn't apply, so
you can paste the whole thing regardless of repo type.

**Reports collected so far:** the YooWifi web app (`yooweb-newdesign`) — see
[findings-web.md](findings-web.md) if saved. Outstanding: Skylink mobile app, partner portal,
admin console.

It makes the assistant investigate that codebase and produce a structured report answering the
questions in [discovery-questions.md](discovery-questions.md). Run it once per surface and
collect the reports — the answers drive every open decision in
[end-to-end-flow.md](end-to-end-flow.md).

**It is read-only.** The prompt explicitly forbids modifying anything.

---

## The prompt — copy everything below this line

---

You are investigating this codebase to produce an **integration report**. This is a read-only
task: **do not modify, create, or delete any file.** Investigate and report only.

## Context

My team is building an AI chat assistant that will be embedded into this application. Users will
type questions like *"I'm going to Japan for 7 days, which eSIM should I get?"* and get answers
in natural language, backed by live plan and pricing data.

The chat service runs on a **separate server we control**. Before we build the integration, I
need to know exactly how this application is put together — how it talks to its backend, how it
authenticates users, and how it handles language. My design currently assumes this app has **no
backend of its own that we can add code to**, and I need that assumption confirmed or corrected.

Answer from **evidence in this repository**, not from general knowledge about how apps usually
work.

## Rules

1. **Cite evidence.** Every factual claim gets a `path/to/file.ts:42` reference. A claim without
   a citation is a guess, and guesses are worse than nothing here.
2. **Never invent.** If you cannot determine something, write `UNKNOWN` and say what you looked
   for and where. Do not infer from convention.
3. **Distinguish these three:** *confirmed present*, *confirmed absent* (you looked and it isn't
   there), and *couldn't determine*. They lead to different decisions on my side.
4. **Config over assumption.** Prefer what `.env.example`, config files, CI, and deployment
   manifests actually say over what the code appears to imply.
5. **Never print secret values.** Report that `API_KEY` exists and where it's referenced. Never
   output its value, even from a committed `.env`.
6. Keep answers short. A sentence and a citation beats a paragraph.

## What to investigate

### A. Architecture and network calls

- What is this — web app, mobile app, admin portal? What framework and language? Is there a
  build/deploy config that shows where it's hosted?
- **Trace every outbound HTTP call.** List each distinct base URL and where it's configured.
- For each base URL: does it point at a **first-party backend belonging to this app** (a BFF,
  API routes, a server folder, serverless functions) or **directly at a shared/core API**?
- **Is there any server-side code in this repository at all?** Look for API route folders,
  server components that fetch, middleware, serverless functions, a `server/` or `backend/`
  directory. This is the single most important question in the report.
- If server-side code exists: could a new endpoint be added there — is it a real backend, or
  just static-site build tooling?
- Is there a proxy or rewrite layer (Next.js rewrites, nginx conf, Vite proxy, `_redirects`)
  that forwards browser calls to an API?

### B. Authentication and user identity

- Trace the **login flow** end to end: which screen, which endpoint, what's sent, what comes back.
- What credential does the app hold after login — JWT, opaque session token, cookie, something
  else? Quote its **shape**, never its value.
- **Where is it stored?** localStorage, sessionStorage, httpOnly cookie, secure native storage,
  in-memory?
- **How is it attached to API calls?** Exact header name and format (e.g. `Authorization:
  Bearer <t>`, or a custom header).
- Is there a **token refresh** flow? What triggers it, and what's the token lifetime if stated
  anywhere?
- Is there an endpoint that returns **the current user's profile/identity** given the token
  (`/me`, `/profile`, `getUserProfile`, similar)? **Name it exactly and quote its response
  shape.** This one matters a lot to me.
- Is there any **token validation or introspection** endpoint?
- Can any part of the app be used **without logging in**? Which parts?
- Are user ids ever sent from the client as a plain parameter (e.g. `userId` in a request body
  or query string) rather than derived from the token? List every such call site.

### C. Language and localisation

- Is there an i18n setup? Which library, and where do translation files live?
- **What is the full list of supported languages/locales?**
- **How is the user's current language determined** — browser setting, user preference, URL
  path, device locale, a stored value? Cite the exact code.
- Is the language sent to the API? Which field or header, and what values does it take (`EN`,
  `en-US`, `ms`)?
- Do plan names, product descriptions, or prices come back from the API already translated, or
  are they translated client-side?
- Is currency ever converted or reformatted client-side, or displayed exactly as the API returns
  it?

### D. Embedding a chat widget

- Where is the **HTML shell / entry point** — the file where a `<script>` tag would go?
- Is there a **Content-Security-Policy**? Quote it. Look in meta tags, server config, hosting
  config (`netlify.toml`, `vercel.json`, nginx), and any security middleware.
- What **domain(s)** does this app serve from? Check deploy configs, env files, README.
- For a mobile app: is any part rendered in a **WebView**, or is it fully native? If there's a
  WebView, what URL does it load?
- Is there an existing chat, support widget, or third-party embed already? If so, how was it
  integrated — that's the template we'd follow.
- Is there a design system, component library, or brand tokens a widget should match?

### E. Infrastructure and protection

- Any CDN or WAF in front of this app — Cloudflare, Akamai, AWS WAF? Cite the config.
- Any existing captcha/bot protection (Turnstile, reCAPTCHA, hCaptcha)? Where is it used?
- Any client-side rate limiting, retry, or backoff logic?
- Does the client hold any **API key or secret** that ships in the bundle? Name the variable and
  where it's used — **never the value**.

### F. NATIVE MOBILE APPS ONLY — skip if this is a web app

> A native app sends no `Origin` header, so the mechanism a web surface uses to identify itself
> to our server does not exist here. These questions decide what replaces it.

- What platform and framework — native iOS/Android, React Native, Flutter, Cordova/Capacitor?
- **How does the app identify itself to the API?** Any app-level shared secret, API key, HMAC
  signing, or per-build identifier in requests? Where is it stored and how is it injected at
  build time?
- Is request payload **encryption or signing** used (AES, HMAC)? Which fields, which algorithm,
  and where does the key come from? Quote the mechanism, never the key.
- Is there **certificate pinning**? Against which hosts?
- Is any **app attestation** used — Play Integrity, SafetyNet, App Attest, DeviceCheck?
- **Where are credentials stored** — Keychain / EncryptedSharedPreferences / Keystore, or plain
  `UserDefaults` / `SharedPreferences` / AsyncStorage?
- **Is there any WebView in the app?** If yes: which screens, what URLs does it load, and is
  there a **JS bridge** between web and native (`postMessage`, `addJavascriptInterface`,
  `WKScriptMessageHandler`)? A WebView plus a bridge is the cheapest path to embedding a chat UI.
- Is any part of the UI **server-driven** — remote config, feature flags, or content fetched and
  rendered at runtime? This decides whether a chat feature can ship without an app-store release.
- What is the **release cadence**, and is there a forced-update mechanism? Anything shipped in the
  binary cannot be hot-fixed.
- Does the app have a **device id / installation id** it sends to the API?
- What is the **minimum supported OS version**?

### G. PORTALS AND ADMIN CONSOLES ONLY — skip otherwise

> These surfaces carry data that must never reach a public chat. These questions decide what an
> assistant may be allowed to see or do here at all.

- **Is this a partner-facing (B2B) portal or an internal staff/admin console?** State which, with
  evidence.
- **Is login per-user, or a single shared credential** for a whole partner organisation? If
  per-user, are users scoped to one organisation?
- **What roles/permissions exist?** List every role found and where they're enforced —
  client-side only, or server-checked?
- **Can one logged-in user see data belonging to more than one tenant/partner/organisation?** This
  is the most important question in this section.
- Does this surface show **rates or pricing that differ from the public website** — wholesale,
  partner, or negotiated rates?
- What **write operations** exist — creating orders, issuing refunds, activating/suspending SIMs,
  editing users? List them, with the endpoint for each.
- Is there **audit logging** of user actions? Where does it go?
- Does it expose **bulk data** — customer lists, exports, reports?
- Are there **impersonation or "act as user"** features?
- Any IP allowlist, VPN requirement, or SSO/SAML/OIDC in front of this portal?

## Output format

Produce exactly this, in markdown:

```
# Integration Report — <app name>

## 0. Verdict (answer these four first)

| Question | Answer | Evidence |
|---|---|---|
| Does this app have its own backend where an endpoint could be added? | YES / NO / UNKNOWN | file:line |
| Is there a real auth token (JWT/session) attached to API calls, or is identity a client-held plain user id? | TOKEN / PLAIN-ID / UNKNOWN | file:line |
| Is there an endpoint that returns the current user **given only that credential**? | YES / NO / UNKNOWN | file:line |
| How could a chat UI be embedded here? | SCRIPT TAG / WEBVIEW / NATIVE ONLY / UNKNOWN | file:line |
| Does anything block a third-party embed (CSP, app review, no WebView)? | YES / NO / UNKNOWN | file:line |
| **(portals/admin only)** Can one logged-in user see more than one tenant's data? | YES / NO / N-A | file:line |

## 1. What this app is
<2–3 sentences: type, stack, hosting.>

## 2. Architecture
| Base URL | Configured at | First-party backend or shared/core API? |
|---|---|---|

<Then: does server-side code exist in this repo? Where? Could an endpoint be added?>

## 3. Authentication
- Login flow: <steps + citations>
- Credential type: <...>
- Storage: <...>
- Sent as: <exact header format>
- Refresh flow: <...>
- Identity endpoint (`/me`-equivalent): <exact name + response shape, or CONFIRMED ABSENT>
- Anonymous access: <which parts work logged out>
- Client-supplied user ids: <list every call site, or NONE FOUND>

## 4. Language
- i18n library + location: <...>
- Supported locales: <full list>
- How current locale is determined: <...>
- Locale sent to API as: <field/header + value format>
- Server-translated or client-translated content: <...>
- Currency handling: <...>

## 5. Widget embedding
- Entry point file: <path>
- CSP: <quoted, or CONFIRMED ABSENT>
- Domain(s): <...>
- WebView (mobile only): <...>
- Existing third-party embeds: <...>
- Design system: <...>

## 6. Infrastructure
- CDN / WAF: <...>
- Existing bot protection: <...>
- Client-held secrets: <variable names + locations, NO VALUES>

## 6a. Native mobile (only if applicable — else write N/A)
- Platform / framework: <...>
- How the app identifies itself to the API: <...>
- Payload encryption / signing: <mechanism, no keys>
- Cert pinning / attestation: <...>
- Credential storage: <...>
- WebView present: <which screens, what URLs, JS bridge yes/no>
- Server-driven UI / remote config: <...>
- Release cadence + forced update: <...>
- Device/installation id: <...>

## 6b. Portal / admin (only if applicable — else write N/A)
- Partner-facing or internal staff: <...>
- Login: per-user or shared credential: <...>
- Roles found + where enforced: <...>
- **Cross-tenant visibility:** <YES/NO + evidence>
- Non-public rates shown: <...>
- Write operations: <list + endpoints>
- Audit logging: <...>
- Bulk data / exports: <...>
- Impersonation features: <...>
- Network restrictions (VPN, IP allowlist, SSO): <...>

## 7. Unknowns
<Every UNKNOWN, with what you searched for and where. Be specific — this list tells me what
to ask a human.>

## 8. Surprises
<Anything you found that a person planning this integration would not expect. Security issues,
unusual patterns, dead code, contradictions between config and implementation. This section is
often the most valuable — do not leave it empty out of politeness.>
```

## Before you finish

Re-read your report and check:
- Does every factual claim have a `file:line` citation?
- Did you write `UNKNOWN` anywhere you were actually guessing?
- Did you confirm the four verdict questions by **looking**, rather than inferring from the
  project type?
- Are all six sections of the output present, including §8?

---

## End of prompt

---

## After you collect the reports

Map each report's §0 verdict onto the design:

| Finding across reports | What it changes |
|---|---|
| **Any** app has an addable backend | The four-box model is back on the table for that surface — strictly stronger. Revisit [end-to-end-flow.md §10](end-to-end-flow.md). |
| An identity (`/me`) endpoint exists | Unblocks v2 — authenticated sessions and `check_order_status`. This is discovery question B1. |
| No script tag possible on a surface | That surface has no delivery path. Drop it from v1 scope. |
| A restrictive CSP exists | Our origin must be allowlisted before anything works. |
| Client already holds an API key in the bundle | The existing security posture is looser than assumed — recalibrate, and mention it. |
| Client sends plain `userId` parameters | Confirms the same class of issue we're fixing in our own tool schemas. Worth reporting back to that team. |
| Locale determination differs per surface | The supported-locale enum must be the union, with per-tenant defaults. |
