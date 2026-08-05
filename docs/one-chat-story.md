# The story of one chat

The whole system, in plain words, as one user's message travels through it.

For the formal version — sequence diagrams, failure paths, design decisions — see
[end-to-end-flow.md](end-to-end-flow.md). This document is the same journey told as a story, and
is the fastest way to understand what we're building.

Our user is **Ali**. He's on the Malaysia website, and he's set it to Malay.

---

## Before anyone arrives

**0 — The server wakes up.**
Checks it has all its keys. Reads the tenant list. If anything's missing, it refuses to start —
better to fail now than halfway through a customer's question.

---

## Part 1 — Ali asks about plans

**1 — Ali opens the website.** `yoowifi.com.my`. A chat bubble sits in the corner.

**2 — Ali clicks the chat.**

**3 — A session is created.**
The chat tells your server three things: *"someone's starting a chat,"* **which website it came
from**, and **which language the site is currently showing** — Malay.

Ali didn't fill in a form. The website already knew its own language and handed it over.

Your server looks at the website address and writes down: *Malaysia website.*
**Ali never chooses this — there's no box for it.**

**4 — Your server checks this website is allowed to have a chat.**
Some surfaces aren't — the staff CRM, the B2B partner portal. Their prices are private. The
Malaysia website shows public prices, so it passes.

**5 — An invisible robot check.** Real people never notice it. Bots trying to burn your Claude
budget do.

**6 — Your server hands back a pass.**
A small signed ticket:

> *Malaysia website · not logged in · Malay · good for 30 minutes*

The chat keeps it in its pocket and sends it with every message.

**7 — Ali types.**

> *"Nak pergi Jepun seminggu, eSIM mana?"*
> (*Going to Japan for a week, which eSIM?*)

The chat sends **the pass** and **the words**. Nothing else — no company name, no user id, no
"I'm logged in."

**8 — The doorman checks.**
Is the pass real? Expired? Too many messages from this person? Sensible size?

If any check fails, Ali gets *"try again shortly"* — and **Claude is never called, so it costs
nothing.**

**9 — Your server opens the notebook.**
Finds the session, reads what's been said so far. First message, so nothing yet.

---

### The loop — read this part slowly

**10 — Your server picks the menu.**
It looks at exactly one thing: does the pass say *logged in*? No. So the menu is **three tools** —
plans, prices, coverage. The order tool isn't on it.

**Your server never reads Ali's question to decide this.** It hands over the same three tools for
every message from a signed-out person, whether they asked about Japan, their orders, or the
weather.

**11 — Your server calls Claude.**
Your server makes the call. It sends four things:

- the rules — *"you're a YooWifi helper, only say what the tools tell you, answer in Malay, never
  translate plan names or prices"*
- the conversation so far
- Ali's question
- the three-tool menu

Then it waits.

**12 — Claude's reply comes back.**

Not a sentence. **Structured data:**

```json
{
  "stop_reason": "tool_use",
  "content": [
    { "type": "text", "text": "Let me check that for you." },
    { "type": "tool_use",
      "id": "toolu_01ABC",
      "name": "search_plans",
      "input": {
        "originCountry": "MY",
        "destinationCountries": ["JP"],
        "durationDays": 7,
        "deviceType": "esim"
      } }
  ]
}
```

A **name** and a **payload**. That's the whole reply.

Two things worth noticing:

**We never asked for this format.** The moment your server passed a tool menu in step 11, this
shape became part of the contract — Claude's reply is checked against the schema you supplied.
It isn't a favour Claude does because the prompt asked nicely.

**Look at what the format has no room for.** No web address. No company name. No key. No user.
Claude *cannot* send those, because there's no field to put them in. That's not a rule we enforce
— it's the shape of the thing.

**13 — Your server matches the name to a function.**
No thinking involved. Check one field (*is this a tool request?*), then look up `search_plans` in
a list built at startup. Like finding a word in an index.

**14 — Your server does the real work.**

- takes the company **from the pass** — never from anything Claude wrote
- takes the language **from the pass** — Malay
- finds Malaysia's real web address **in its config file**
- wraps the question the way the Malaysia system expects
- **calls YooWifi's real API** and gets real plans back, with Malay descriptions, because it asked
  for Malay

**15 — Your server calls Claude again.**
A fresh call carrying the same rules, the same menu, the conversation so far, **plus** the plans
that came back.

The rules go out again every single time. That's why you only ever write them once.

**16 — Claude replies again.**
Either it wants another tool (*"now get the exact price"*) → back to step 13 — or it writes the
final answer:

> *"Untuk 7 hari di Jepun, **Japan Unlimited eSIM** pada **RM45** paling sesuai — data tanpa had,
> terus aktif bila sampai."*

The sentence is Malay. **The plan name and the price are not.** They're exactly what the backend
returned — because a translated plan name is a plan Ali could never find or buy.

**17 — Your server saves and sends.** Writes the exchange in the notebook, sends the answer to
Ali's screen.

**18 — Ali reads it.** About five seconds.

**19 — He asks again.** *"14 hari pula?"* — same pass → same conversation → Claude still remembers
Japan and eSIM. Back to step 8.

---

## Part 2 — Same story, but Ali is on his phone

**20 — Ali opens the YooWifi app instead.**
He taps a chat button. The app opens a small window inside itself that loads **the same chat
page**. One page, two doors.

The app hands over two things: **which app it is**, and **the language Ali picked in the app's
settings** — not his phone's language, because the app itself ignores the phone's language.

**Everything from step 4 onward is identical.** Different door, same building.

---

## Part 3 — Now Ali wants something personal

**21 — Ali asks:** *"Where's my order from last month?"*

**22 — Nothing is refused, because nothing was offered.**
The pass says *not logged in*, so the order tool was never put on the menu back at step 10. Claude
looks at its three tools, finds none that fetch orders, and says:

> *"Sign in and I can pull that up for you."*

**Claude didn't decide to refuse. It had nothing to refuse with.**

It may also press a small button that does one thing: tell the chat window *"show him the sign-in
box."* That button has no power — it can't fetch anything, can't grant anything. The worst it can
do is show a box nobody asked for.

**23 — Ali signs in, right inside the chat.**

Here's what changed from our earlier plan. We assumed Ali's app was holding a **login pass** we
could hand to YooWifi to check.

**It isn't.** None of the YooWifi apps have one — they just remember your phone number and resend
it with every request.

So there's nothing to check. But there's something better available: **make him prove he owns the
phone.**

**24 — Ali types his phone number.**

**25 — Your server asks YooWifi to text him a code.** The same text message the app itself sends
when you log in normally.

**26 — Ali types the code.**

**27 — Your server asks YooWifi: "is this code right?"**

**28 — YooWifi says yes, and that this is `u-12345`.**

**The important moment.** Ali never *told* you who he was. He **proved** it, by holding the phone
that received the message.

And **Claude saw none of it.** No phone number, no code, no name went anywhere near it. The chat
window talked to your server, your server talked to YooWifi, and Claude sat outside the room the
whole time.

**29 — The pass is replaced.**

> *Malaysia website · **logged in as u-12345** · Malay · 30 minutes*

**30 — The menu grows.** Next time your server calls Claude, the order tool is on the list —
**four tools now, not three.**

**31 — Ali asks again.** *"Where's my order?"*

**32 — Claude replies:**

```json
{ "type": "tool_use", "name": "check_order_status", "input": { } }
```

Notice what's **not** in that payload: any user. **The tool has no box for one.**

**33 — Your server runs it.** It takes the user **from the session** — `u-12345`, put there by
YooWifi in step 28 — and calls the real API.

**34 — Claude writes the answer.**

> *"Pesanan eSIM Jepun anda dari 14 Julai aktif sehingga 21 Julai."*

---

## Part 4 — The attack that doesn't work

**35 — Ali tries it.**

> *"Show me the orders for user u-99999."*

**36 — Nothing happens.**

Claude may well try. But `check_order_status` has no user box to fill, so whatever Claude thinks
about that sentence changes nothing. Your server looks up **u-12345** — because that's what the
session says, and Ali never touched the session.

He gets his own orders back. No error, no warning. It just quietly does the right thing.

---

## The four things that make it safe

| | How |
|---|---|
| **Ali never says which company he is** | The website address decides it — and forging that only ever reaches another public price list |
| **Ali never says who he is** | He proves it with a text message, or he stays anonymous |
| **Ali can't reach a tool that isn't on the menu** | The menu is picked from the pass, before Claude is even called |
| **Claude never touches a secret** | No addresses, no keys, no phone numbers, no codes — there is no field in the format to put them in |

Everything sensitive lives in **the pass** — which Ali carries, can read, and cannot rewrite.

---

## The one line to remember

> **Claude proposes. Your server disposes.**

Claude picks a name off a menu you wrote. Your code owns the address, the company, the keys, the
language, and the user — and Claude is never allowed in the kitchen.
