# ADR-0015: An opt-in "dedicated server" storage mode, authenticated by a bearer token, not OAuth

Status: accepted · 2026-09-12

## Context

The app is 100% local today: no backend, all data in the browser's
`localStorage`, nothing leaves the device except the one explicit NLM
lookup and the optional `/?data=<guid>` share link (ADR-0003; CLAUDE.md's
Tech stack section states the pitch as "your data stays in this
browser"). Alex wants to use the app for two known people — himself and
his mother — with the convenience of syncing across devices, which a
purely local app cannot offer.

[task-0025](../../tasks/task-0025.md) recorded an earlier answer to this
same problem, decided in an earlier conversation on the same day: Cloudflare
Access gating the Worker, plus a client-side profile picker, plus a
Hetzner-hosted storage endpoint trusting the Cloudflare Access JWT. Further
conversation this session re-opened the auth question specifically and
worked through several more alternatives before settling on something
lighter than all of them, including task-0025's own design. This ADR
records that later decision; task-0025 is superseded on auth (see
Consequences) but not rewritten, per this project's convention of
appending rather than rewriting a ticket's history.

Several alternatives were seriously considered and rejected in this
conversation, each for a distinct reason worth preserving:

- **Full OAuth plus a managed backend (e.g. Supabase).** Technically the
  easiest path — hosted Postgres, auth, and row-level security, roughly an
  afternoon of work. Rejected anyway: centralizing real health data in a
  third-party managed database contradicts the app's core privacy pitch,
  and for exactly two known users that centralization buys almost
  nothing. This is the same rejection task-0025 already recorded for the
  same reason.
- **Cloudflare Access gating the existing Worker hostname**, with the
  Worker reverse-proxying sync calls to a self-hosted origin (e.g.
  Hetzner) and forwarding/verifying the `Cf-Access-Jwt-Assertion` header —
  task-0025's own design. Technically sound: Access can protect any
  hostname via Tunnel, and keeping everything on one hostname sidesteps
  CORS and cross-origin-cookie issues entirely. Rejected as more
  operational hassle than it saves for two users — a Cloudflare Access
  policy, a Tunnel, and JWT verification code, all to authenticate two
  people who could just as well hold a credential directly.
- **A self-hosted OAuth2 authorization server** — a container on another
  of Alex's machines (referred to in conversation as "perkunas") issuing
  tokens, with Hetzner as a separate resource server verifying them.
  Judged as *more* infrastructure to own and secure than the Cloudflare
  option, not less, and judged the wrong tool on protocol grounds: OAuth2's
  machinery — authorization codes, redirect URIs, consent screens, scopes
  — exists to delegate access to *other client applications*, a problem
  this design does not have. There is one first-party app and two known
  users; nothing here is a third party requesting access on anyone's
  behalf.
  - A lighter variant of the same idea — "Sign in with Google", where
    perkunas verifies Google's ID token, checks the email against an
    allowlist of two, and mints its own short-lived session JWT that
    Hetzner trusts — was judged technically sound and much lighter than a
    full custom OAuth provider. It was superseded once it became clear
    that per-user identity does not need solving via login at all for two
    people who each run their own browser: a login flow answers "who is
    this person," which is a question this design does not need to ask.
- **Storing raw SSH credentials** (server IP, login, private key, remote
  file path) in the browser's `localStorage`, letting the browser manage
  files on the dedicated server directly — a "poor fisherman" shortcut
  past building any HTTP API at all. Rejected for two independent, each
  individually sufficient, reasons: browsers have no raw TCP/SSH
  capability, so client-side JS cannot open an SSH connection under any
  design — an HTTP API in front of the server is unavoidable regardless;
  and even granting that away, an SSH private key is a categorically
  larger secret to keep in `localStorage` than a scoped API token — a
  leaked key hands over the whole server (full shell, every file), while a
  leaked scoped token exposes only whatever narrow thing it was issued to
  touch, and can be revoked and rotated independently of everything else
  on that server.

What survived this elimination is the plainest tool that actually fits
the problem: two known users, one first-party app, no third party to
delegate to — a bearer credential the app itself checks, nothing more.

## Decision

**Add a second, opt-in storage mode — "Dedicated server" — chosen in
Settings, sitting beside the existing local-only mode rather than
replacing it. Authentication is a scoped, long-lived, revocable Bearer
API token, with no OAuth, no identity provider, and no login flow of any
kind.**

- **Local** (today's behavior, unchanged): data lives only in the
  browser's `localStorage`. This remains the default, and remains
  fully intact and zero-friction for anyone who never opts in.
- **Dedicated server** (opt-in): the browser instead talks to a small
  HTTP service the user runs on their own infrastructure (e.g. Hetzner).
  The user pastes in a server URL and an API token, generated once
  server-side, and both are stored in this browser's `localStorage` as
  connection *configuration* — not itself the health data, and not a
  credential capable of anything beyond reading and writing that one
  token's own JSON blob.

**The synced payload is the existing Account "backup" bundle**, not a new
fine-grained storage-adapter layer over every individual `localStorage`
key the app uses today (results/session storage, medications, scheduled
visits, view settings, sidebar-collapsed state, and the rest). It reuses
`data/backupArchive.ts`'s bundle shape and `data/backupRestore.ts`'s parse
and validate functions as-is: `lab-reports.json`, `medications.json`,
`scheduled-visits.json`, `settings.json`, `manifest.json`. This is a
deliberate scope simplification — a universal key-by-key storage adapter
was recognized as much bigger, riskier surface than reusing a bundle
shape and a set of parse/validate functions that already exist and are
already tested. `laboratory-prices.json` stays excluded from the sync
payload, exactly as it is already excluded from backup restore today (the
shipped registry wins) — this is continuity of an existing exception, not
a new one.

**The server is a small standalone Node service**, planned to live in a
new `server/` directory in this repo, exposing authenticated `GET`/`PUT`
of one JSON blob per token — no framework beyond what is minimally
needed, since it is meant to run standalone on a small VPS. Deploying it
is a manual step Alex performs himself on his own Hetzner box; this repo
will ship the service's code and deployment instructions (e.g. a systemd
unit), but nothing in this codebase deploys or provisions the remote
server automatically.

**Migration model: a one-time cutover**, carrying over the same reasoning
task-0025 already recorded for its login-based design — there is
deliberately no ongoing two-way sync or conflict resolution. Switching a
browser to Dedicated server mode for the first time:

- If the server has no data yet, the browser's current local bundle is
  pushed up once.
- If the server already has data, that data is pulled down and the local
  copy is ignored entirely — never merged.

There is exactly one write path once migration completes, which is what
makes skipping conflict resolution safe.

**Left open, not resolved here:** once in Dedicated server mode, should
the browser auto-save changes to the server on every edit (debounced,
mirroring how `localStorage` saves today), require an explicit manual
"Sync now" action, or offer both? This has not been decided in
conversation and is recorded as the one open implementation detail.

## Alternatives considered

See Context above for the four alternatives worked through and rejected
before reaching this design — full OAuth plus a managed backend,
Cloudflare Access with a reverse proxy, a self-hosted OAuth2 authorization
server (and its "Sign in with Google" variant), and raw SSH credentials in
`localStorage`. They are not repeated here to avoid stating each rejection
twice.

## Consequences

- Local-only users get zero change and zero new risk surface. This must
  never regress — Dedicated server mode is additive, and nothing about it
  makes login or sync mandatory for anyone who does not opt in.
- Alex takes on his own ops burden — standing up and maintaining the small
  server himself — in exchange for keeping real health data under
  infrastructure he fully owns rather than a third party's. That
  trade was the deciding factor against every rejected alternative that
  would have centralized data in someone else's cloud (Supabase) or added
  a login dependency on a third party (Cloudflare, Google) for what is,
  for now, exactly two known people.
- Reusing the backup-bundle shape makes sync granularity "the whole
  bundle," not per-field: an edit anywhere triggers a full-bundle read or
  write. That is simpler and reuses proven code, at the cost of being
  less fine-grained than a true per-key sync layer — a deliberate
  tradeoff to bound the size of this change.
- The token is a narrower, more containable secret than an SSH key would
  have been, but it is still a bearer credential sitting in
  `localStorage` — the same exposure model (XSS, a malicious browser
  extension) as any token this app might store. That should be documented
  for the user honestly rather than glossed over, in whatever UI
  eventually surfaces the Dedicated server setting.
- This supersedes task-0025's auth model specifically: no Cloudflare
  Access, no profile picker, no Google login. task-0025's one-time-cutover
  migration reasoning (its section 3) and its open question about
  wipe-or-keep of the superseded local copy (its section 4) both carry
  over unchanged, since neither depended on which auth model was chosen.

## What would force revisiting

- A third known user, or any move toward general-audience signup — the
  entire case for skipping OAuth rests on "two known people," and that
  premise breaking is exactly what would make a real identity provider
  worth its cost again.
- A token leak in practice (XSS, a compromised extension, a pasted token
  ending up somewhere it shouldn't) — the risk this ADR accepts as
  tolerable for two users would need re-examining if it stopped being
  theoretical.
- A future need for per-field sync or real conflict resolution — for
  instance if a third client (e.g. a phone app) starts writing
  concurrently — since the whole-bundle model and the no-merge cutover
  both assume a single write path at a time.
