# ADR-0029: A public, Worker-served chatbot guide at `/prompt`

Status: accepted · 2026-09-29

## Context

A newcomer lands on Get Started with no data and a site of ten sections, a
JSON envelope and a chatbot-driven import path. Most already use a chatbot
(ChatGPT, Claude, Gemini) that can open a URL, so the cheapest onboarding is
to let that chatbot learn the site and walk the user through it. The chatbot
needs something to read: the SPA's `index.html` is a JavaScript shell with no
content for a bot that fetches without running scripts, and the extraction
prompt (`web/src/data/chatbotPrompt.ts`) covers only lab report → JSON, not
the site.

The guide carries no user data: it describes the app, not anyone's results,
so publishing it does not touch the "data stays local" principle
([ADR-0023](adr-0023-product-purpose-and-clinical-boundary.md), CLAUDE.md's
key principle). What it must not do is drift: a guide that names a button the
app no longer has, or a panel that was renamed, misleads the chatbot and so
the user.

## Decision

**The Worker serves a chatbot-readable guide at `/prompt`, generated from the
app's own sources, and a "New here? Ask your chatbot" card hands the user a
one-line prompt pointing at it.**

- **Route.** `web/worker/siteGuide.ts`, routed from `web/worker/index.ts`
  ahead of the static assets, answers `/prompt`, `/prompt/` and `/prompt.md`:
  `GET` / `HEAD` only (else `405` with `Allow`), `text/plain; charset=utf-8`,
  `Access-Control-Allow-Origin: *`, `Cache-Control: public, max-age=3600`,
  `nosniff`. Public: no cookie, no session, no allowlist.
- **Content.** Markdown written for the assistant: what Paneloom is, how to
  guide the user, key concepts, quick-start paths, every section step by
  step with the exact English button labels, and — as its last section —
  `CHATBOT_PROMPT` verbatim, so the chatbot can do the extraction itself.
  Panel names are read from `monitoring-panels.json` and the schema version
  from `envelopeSchema.ts` at build time, never retyped.
- **Card.** `NewcomerPromptCard.tsx` shows `NEWCOMER_PROMPT` from
  `web/src/data/sitePrompt.ts` ("Please read the guide at
  https://paneloom.com/prompt …") with "Copy prompt" and a "Read the guide
  yourself" link, on Get Started always and on the Monitoring Panels grid
  while no report is loaded.
- **Guard.** `web/test/site-guide.test.ts` fails when a nav section or its
  hash, a monitoring panel, a quoted button label, the embedded extraction
  prompt or the route's headers and methods drift.

## Alternatives considered

- **A static `public/prompt.md` asset.** No Worker code, but a hand copy:
  panel names and the extraction prompt would be duplicated and drift
  silently.
- **An in-app `#guide` route.** Rendered by the SPA, so a bot fetching it
  gets the empty shell.
- **Paste the whole guide into the prompt.** No fetch needed, but a
  multi-kilobyte paste is clumsy, gets truncated, and is stale the moment it
  is copied; a short prompt plus a URL stays current.
- **Server-side rendering or prerendering the SPA.** Solves bot-readability
  for every page, at the cost of a build pipeline this app does not have, for
  one page of prose.

## Consequences

- **The Worker serves a second kind of route.** Beside the
  sign-in and sync proxy (`/auth/*`, `/api/data`), it now answers a public,
  cacheable content route. It is still stateless and stores nothing.
- **Dev needs the Worker for `/prompt`.** Vite proxies `/prompt` to
  `wrangler dev` on port 8787, as it does `/auth` and `/api`; with plain
  `npm run dev` the card's guide link fails.
- **The Worker bundle imports app source** (`chatbotPrompt.ts`,
  `envelopeSchema.ts`, `sitePrompt.ts`) and `monitoring-panels.json`
  (`tsconfig.worker.json` gains `resolveJsonModule`).
- **The guide must be kept in step with the UI.** A renamed button, section or
  panel needs a matching edit in `siteGuide.ts`; the tests catch labels they
  list, not new features the prose never mentions.
- **A cached copy lags up to an hour** after a deploy.

## What would force revisiting

- The guide ever needing anything per user — it would stop being public and
  cacheable.
- Chatbots that can run the SPA, or a prerender step added for other
  reasons, making a separate text route redundant.
- The guide growing enough that hand-written prose over generated facts
  becomes the main drift risk; then generate more of it from the nav and
  reference data.
