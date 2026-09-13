# ADR-0017: Supabase replaces the bespoke bearer-token server — self-hosted first, managed cloud once there are real users

Status: accepted · 2026-09-13 · supersedes
[ADR-0015](adr-0015-dedicated-server-storage-via-bearer-token.md) ·
superseded by
[ADR-0018](adr-0018-firebase-storage-provisional.md)

ADR-0015's storage-mode shape stands: an opt-in "Dedicated server" mode
beside the unchanged local-only default, syncing the existing
Account backup-bundle, with a one-time cutover migration and no ongoing
two-way sync. What is superseded is everything about *what the server
is*: ADR-0015's small standalone Node service, authenticated by a
pasted Bearer API token with "no OAuth, no identity provider, and no
login flow of any kind," is replaced by Supabase — which brings real
accounts back, via Supabase Auth (GoTrue), likely Google OAuth. This is
a reversal of ADR-0015's central auth stance, not a refinement of it,
and is stated as such rather than glossed over. In turn, this plan
itself did not survive contact with implementation: ADR-0018 drops
Supabase (self-hosted or cloud) in favor of Firebase, before either of
this record's phases was built, on setup-speed and ops-burden grounds —
explicitly provisional, not a further reversal of the auth stance,
which stays "real accounts, real login."

## Context

ADR-0015 picked a bespoke Bearer-token Node service specifically
*because* it rejected Supabase: "centralizing real health data in a
third-party managed database contradicts the app's core privacy pitch,
and for exactly two known users that centralization buys almost
nothing." That reasoning has been revisited in conversation, for two
reasons:

- **Self-hosting Supabase removes the "third-party" premise the earlier
  rejection depended on.** Supabase's open-source stack — Postgres,
  GoTrue auth, PostgREST, and the rest — runs standalone via Docker
  Compose on infrastructure Alex already owns. Run that way, on his own
  "perkunas" machine, it centralizes data on Alex's own box, not a
  vendor's, for as long as the app has exactly two known users. The
  original objection was to *someone else's* database, not to
  Supabase's design.
- **Alex already runs this exact pattern successfully elsewhere.**
  Two of his other shipped personal projects, `project-travel` and
  `project-wardrobe`, use managed Supabase Cloud for data, auth, and
  row-level security, with real Google OAuth, deployed on Cloudflare
  Workers — the same deployment target this app already uses. That is a
  proven, comfortable pattern for him specifically, which is what makes
  it worth reconsidering here even though ADR-0015's "overkill for 2
  users" framing was not wrong in isolation.

ADR-0015's own alternatives section had already flagged managed Supabase
as "technically the easiest path... roughly an afternoon of work" before
rejecting it on centralization grounds. What changed is not that
assessment of the technology, but the deployment split proposed below,
which defers the centralization question rather than accepting it
immediately.

## Decision

**Replace the planned bespoke server with Supabase, in two phases:**

- **Phase 1 (now, proof-of-concept): self-hosted Supabase.** The
  open-source Supabase stack (Postgres, GoTrue, PostgREST, etc.) via
  Docker Compose, deployed on Alex's own "perkunas" machine. This keeps
  the POC free and fully self-owned while the feature is proven out with
  just two known users — Alex and his mother — the same population
  ADR-0015 was scoped to.
- **Phase 2 (once there are real users beyond the POC): migrate to
  managed Supabase Cloud** (supabase.com's hosted offering), trading
  self-hosted ops burden for production-grade reliability once the
  feature graduates past a two-person proof of concept. This is the
  same managed service ADR-0015 rejected outright — accepted now, but
  deliberately deferred past the free, self-owned POC phase rather than
  adopted from day one.

**Real accounts and auth come back:** Supabase Auth (GoTrue), likely
with Google OAuth given the `project-travel` precedent. This is a
direct reversal of ADR-0015's "no login, no OAuth, just a pasted token"
stance — recorded plainly here rather than folded quietly into a
"switch the backend" framing.

**What carries over from ADR-0015 unchanged, and is not re-argued
here:**

- Local-only storage stays the default, zero-friction path for anyone
  who does not opt in. Dedicated server mode remains strictly additive.
- The one-time-cutover migration model — no ongoing two-way sync, no
  conflict resolution: on first switch to server storage, an empty
  server gets the local bundle pushed once; a populated server has its
  data pulled down and the local copy is ignored entirely. Moving to
  Supabase changes what is on the other end of that cutover; it does
  not change the cutover's shape.
- The synced payload stays the existing Account backup-bundle shape
  (`data/backupArchive.ts` / `data/backupRestore.ts`), not a per-key
  storage-adapter layer over every `localStorage` key.

**Out of scope for this repo:** standing up self-hosted Supabase on
perkunas, and migrating `project-travel` / `project-wardrobe` onto it,
are cross-repo, cross-machine infrastructure work that does not happen
inside `project-bloodtests-v3`. This repo's own work — a Supabase
client integration, the storage-mode Settings UI, and the migration
flow — is gated on that infrastructure existing and being reachable,
and has not started.

## Alternatives considered

See ADR-0015's own Context and Alternatives for the fuller elimination
(Cloudflare Access plus a reverse proxy, a self-hosted OAuth2
authorization server and its "Sign in with Google" variant, raw SSH
credentials in `localStorage`) — none of that reasoning is reopened
here. The one alternative reconsidered in this ADR is managed Supabase
Cloud from day one, without a self-hosted phase: rejected for the POC
specifically because it would pay for and depend on a third-party cloud
service before the feature has any users beyond Alex and his mother,
which is exactly the cost ADR-0015 originally set out to avoid. Deferred
to Phase 2 rather than dropped, since the concern is about *when* to
take on that dependency, not whether Supabase Cloud is a sound target
once there is a real reason to run production infrastructure.

## Consequences

- The identity model changes materially: this app gains real sign-in
  (Supabase Auth, likely Google OAuth) where ADR-0015 deliberately had
  none. Anything written against ADR-0015's "no login flow" premise —
  UI copy, threat-model assumptions, docs — needs revisiting when this
  is implemented.
- Self-hosted Supabase on perkunas is still Alex's own ops burden during
  Phase 1, same as ADR-0015's Node service would have been — this
  decision does not remove that cost, only changes what is being
  operated (a Docker Compose stack instead of a small custom service).
- Phase 2's migration to Supabase Cloud is a deliberate, planned
  transition, not a fallback for self-hosting failing — it is what
  "production-grade reliability/ops" is expected to require once real
  users exist. When it happens, data moves from Alex's own Postgres to
  Supabase's hosted one, which is the centralization ADR-0015 originally
  rejected — accepted here as the right tradeoff only once the app has
  outgrown a two-person proof of concept, matching the pattern already
  proven in `project-travel` and `project-wardrobe`.
- ADR-0015's scope-simplification reasoning (reuse the backup-bundle
  shape rather than a per-key adapter) survives untouched, since it
  never depended on the backend being a bespoke service versus
  Supabase.
- This repo's implementation (client integration, Settings UI, migration
  flow) cannot start until the perkunas Supabase instance exists and is
  reachable — an external dependency this ADR records but does not
  resolve.

## What would force revisiting

- Self-hosted Supabase on perkunas turning out to be meaningfully
  heavier to operate than ADR-0015's small Node service would have
  been — the whole case for Phase 1 is that it is not.
- The two-known-users population growing before Phase 2's managed-cloud
  migration is ready, which would mean carrying real user data on
  self-hosted infrastructure for longer than intended.
- Google OAuth turning out to be a poor fit in practice (e.g. Alex's
  mother finding it more friction than a pasted token would have been)
  — the `project-travel` precedent argues it works for Alex, not that it
  is guaranteed to work for every intended user of this app.
