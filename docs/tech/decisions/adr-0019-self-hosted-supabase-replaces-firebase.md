# ADR-0019: Self-hosted Supabase replaces Firebase for cloud sync

Status: accepted · 2026-09-14 · supersedes
[ADR-0018](adr-0018-firebase-storage-provisional.md)

The storage-mode shape stands, unchanged since ADR-0015: an opt-in
cloud-sync mode beside the unchanged local-only default, syncing the
existing Account backup-bundle, with a one-time cutover migration and no
ongoing two-way sync. ADR-0018's two-tier sign-in policy (no login stays
local; signing in switches storage mode directly, no separate picker;
cloud wins on sign-in conflict; sign-out pushes local up then wipes it,
unless local is empty and cloud isn't) also stands, unchanged. What is
superseded, again, is *what the server is*: ADR-0018's Firebase (Firebase
Auth + Firestore) — adopted explicitly provisionally, in Alex's own
words, "so later I'll check what fits me better" — is dropped in favor of
a self-hosted Supabase instance. Unlike ADR-0017 → ADR-0018, this is not
a reversal of the auth stance; real accounts via a real login button stay
exactly as they were. It is also not simply reverting to ADR-0017's plan:
ADR-0017 proposed self-hosting only as a proof-of-concept phase ahead of
a planned migration to managed Supabase Cloud. This decision is
self-hosted, full stop, with no planned cloud phase.

## Context

ADR-0018 named its own choice as explicitly provisional and listed, in
"What would force revisiting," the exact scenario that has now happened:
"Alex actually doing the 'check what fits me better' comparison this ADR
anticipates, and preferring Supabase, a self-hosted option, or something
else once there is a working feature to compare against." The Firebase
build was real and working — Google and Apple sign-in shipped, two
production data-loss incidents were root-caused and fixed, and recovery
was confirmed live — so the comparison happened against a working
feature, not a hypothetical one, exactly as ADR-0018 anticipated it
would.

The comparison landed on self-hosted Supabase, on infrastructure Alex
already operates: a second, independent LXC (VMID 105, hostname
`supabase-bloodtests`) on the "perkunas" Proxmox host, deliberately kept
separate from an existing, unrelated Supabase instance already running on
that same host for a different project. This is a narrower stack than a
full Supabase deployment: own Postgres 17.6, own GoTrue (Auth) v2.196.0,
own PostgREST v14.17, own Envoy gateway, own Supavisor pooler —
Realtime, Storage, imgproxy, Edge Functions and Studio are all
deliberately dropped, since this app has no use for any of them. This
also resolves, at least for now, the health-data-centralization concern
ADR-0018 explicitly deferred rather than solved: the data is back on
Alex's own infrastructure rather than either Google's or Supabase's
managed cloud.

A real bug was found and fixed during live testing: Supabase's default
OAuth flow (implicit) returns the session via a `#access_token=...` URL
hash fragment, which collides with this app's own hash-based router
(`#account`, `#reports`, …) — the result was a double-hash URL neither
the app's router nor Supabase's own session parser could read. Switching
`flowType` to `'pkce'` fixed it: PKCE returns the session via a `?code=`
query parameter instead, which doesn't collide with hash routing.

## Decision

**Replace Firebase with a self-hosted Supabase instance for this repo's
cloud-sync feature**, keeping ADR-0018's storage-mode shape and two-tier
sign-in policy entirely unchanged and swapping only the backend and the
plumbing that talks to it:

- **Self-hosted, not Supabase Cloud.** The `supabase-bloodtests` LXC
  described above, reached by the client at a public API domain,
  `https://api.paneloom.com`, via the same perkunas Cloudflare Tunnel
  already used for other self-hosted services (plus a new CNAME DNS
  record). The client talks to this over `@supabase/supabase-js` —
  the same "no backend" shape the rest of the app already has: nothing
  runs server-side in this app's own deploy, the client talks directly to
  Supabase's REST/Auth API over HTTPS, the same relationship the app
  already had with Firebase.
- **Schema.** One table, `public.user_backups` — `id` uuid primary key
  referencing `auth.users(id)` on delete cascade, `manifest` /
  `lab_reports` / `medications` / `scheduled_visits` / `settings` jsonb
  columns, `updated_at` — with row-level security enabled and four
  policies (select/insert/update/delete), all scoped to
  `auth.uid() = id`. This is the same per-person boundary Firestore's
  `users/{uid}` document held, relational instead of a NoSQL document.
  Migration source of truth is `supabase/migrations/0001_init.sql` in
  this repo — not applied by any app code, a manually-run migration
  against the self-hosted instance, following the same pattern
  `project-travel`'s own repo already uses for its own separate Supabase
  instance.
- **Auth.** `web/src/supabase/{config,auth}.ts`. `config.ts` hardcodes
  the Supabase URL and anon key — the same convention
  `firebase/config.ts`'s hardcoded `apiKey` used; both are designed for
  public client exposure, with RLS (here) or Firebase's rules (there) the
  real access boundary, not secrecy. `auth.ts` sets `flowType: 'pkce'`
  for the reason in Context, and exports `signInWithGoogle()` /
  `signInWithApple()` (both `supabase.auth.signInWithOAuth` with
  `redirectTo: window.location.href`) and `signOutUser()`.
- **Sync.** `web/src/supabase/sync.ts` exports `pullCloudFiles(uid)` /
  `pushCloudFiles(uid, files)`, the same signatures and the same
  backup-bundle-filename mapping Firestore's equivalent had
  (`manifest.json` / `lab-reports.json` / `medications.json` /
  `scheduled-visits.json` / `settings.json` — never
  `laboratory-prices.json`, the shipped registry always wins, unchanged
  from before).
- **Auth-state hook.** `web/src/hooks/useSupabaseAuthUser.ts`, the same
  `{user, loading}` shape the old `useAuthUser` had, via
  `supabase.auth.getSession()` plus `onAuthStateChange`.
- **Sign-in flow shape change, forced by the vendor swap.** Firebase's
  `signInWithPopup` resolved synchronously with a user credential, so the
  click handler could trigger the cutover directly. Supabase's OAuth is
  redirect-based — the whole page navigates away to the provider and
  back — so `AccountAuthCard` instead wires the cutover to a dedicated
  `supabase.auth.onAuthStateChange` listener, firing the same pull-or-push
  logic specifically on the `'SIGNED_IN'` event. It deliberately does not
  fire on `'INITIAL_SESSION'`, which fires for an already-authenticated
  returning visit and must not re-trigger a sync — this is what keeps the
  cutover "once per fresh sign-in" under the new redirect-based flow,
  matching ADR-0018's policy rather than changing it.
- **Firebase's own code is left in place, unused.** `web/src/firebase/*`
  is untouched and still in the repo; it is simply no longer used by
  `AccountView` / `TopBar` / `ProfileView` as of this ADR. Whether and
  when to remove it is a separate, not-yet-made decision — this ADR
  states the current state (present but dead) and decides nothing about
  its future.

**What carries over from ADR-0018 unchanged, and is not re-argued here:**
the local-only default and its zero-friction path; the one-time-cutover
migration model with no ongoing two-way sync; the synced payload staying
the existing Account backup-bundle shape; both Google and Apple as
providers; cloud-wins conflict resolution on sign-in; sign-out wiping the
local working copy (guarded against wiping a populated cloud copy with an
empty local one, per the Safari incident fix); and the "no storage-mode
picker, signing in and out is the whole interface" UX.

**Out of scope for this ADR and this repo:** whether or when Firebase's
dead code gets removed; whether `project-travel` or `project-wardrobe`
move onto this or any other backend, which stays a separate,
not-yet-decided question in those repos.

## Alternatives considered

- **Staying on Firebase.** Rejected: ADR-0018 named itself provisional
  from the outset specifically to allow this reconsideration once the
  feature had real, working usage to compare against — which it now did.
- **Managed Supabase Cloud**, either as ADR-0017's originally planned
  second phase or adopted outright. Not chosen: the facts that motivated
  self-hosting in ADR-0017 (keeping health data on Alex's own
  infrastructure rather than a vendor's) still apply, and self-hosting on
  perkunas was, in practice, no heavier to stand up than it would have
  been to keep operating Firebase's console-managed setup once the
  decision was made to build real infrastructure at all.
- **A shared Supabase instance** with the other unrelated project already
  self-hosted on perkunas. Rejected: a second, independent instance keeps
  this app's health data and its RLS policies fully isolated from an
  unrelated project's, rather than trusting one Postgres instance's
  security boundary to separate two products' user data.

## Consequences

- The vendor for cloud sync is Alex's own self-hosted infrastructure
  again, not a managed third party (Google or Supabase Cloud). The
  health-data-centralization concern ADR-0018 explicitly deferred is
  substantially addressed by this choice, though not by ADR-0018's own
  contents — it's a consequence of ADR-0019's decision, recorded here.
- Alex is back to operating real infrastructure for this feature — Docker
  containers for Postgres, GoTrue, PostgREST, Envoy and Supavisor, plus
  the Cloudflare Tunnel and DNS in front of them — the exact ongoing ops
  burden ADR-0018 chose Firebase specifically to avoid. It is a narrower
  stack than a full Supabase deployment (five services, not ten), which
  somewhat mitigates that cost.
- `web/src/firebase/*` is now dead code: present, unused, untouched, and
  a small but real source of drift risk (its `firebase` package
  dependency and its own docs/comments no longer describe what the app
  actually does) until a future decision removes it or the app's `package.json`
  otherwise sheds the unused dependency.
- PKCE, not implicit flow, is now the fixed choice for any future
  Supabase (or other hash-fragment-based) OAuth integration in this app,
  because of the router collision found here — worth remembering before
  re-adding an implicit-flow integration later.
- `project-travel` and `project-wardrobe` are unaffected: nothing here
  changes their own, separate Supabase Cloud usage.

## What would force revisiting

- Self-hosted Supabase on perkunas turning out to be meaningfully
  heavier to operate than anticipated — the same risk ADR-0017 flagged
  for its own self-hosted phase, now actually being carried rather than
  deferred.
- The feature gaining real users beyond Alex and his mother, at which
  point managed Supabase Cloud (or another managed option) becomes worth
  weighing again against the ops burden of self-hosting.
- A decision, whenever it gets made, on removing `web/src/firebase/*` —
  or, conversely, a reason to revive it.

## Implementation progress

- 2026-09-14: Self-hosted Supabase instance stood up on perkunas (LXC
  VMID 105, `supabase-bloodtests`) — own Postgres 17.6, GoTrue v2.196.0,
  PostgREST v14.17, Envoy, Supavisor, with Realtime/Storage/imgproxy/Edge
  Functions/Studio dropped. Public API exposed at
  `https://api.paneloom.com` via perkunas's existing Cloudflare Tunnel
  plus a new CNAME. Schema applied by hand from
  `supabase/migrations/0001_init.sql`: `public.user_backups`, RLS
  enabled, four `auth.uid() = id`-scoped policies.
- 2026-09-14: Client integration landed —
  `web/src/supabase/{config,auth,sync}.ts`,
  `web/src/hooks/useSupabaseAuthUser.ts`, and `AccountAuthCard` rewired
  from Firebase's popup-based sign-in to a `supabase.auth.onAuthStateChange`
  listener gated on `'SIGNED_IN'`. `TopBar` and `ProfileView` switched
  from `useAuthUser` to `useSupabaseAuthUser`.
- 2026-09-14: PKCE bug found and fixed during live testing — Supabase's
  default implicit-flow redirect (`#access_token=...`) collided with this
  app's own hash-based router, producing a double-hash URL neither side
  could parse. Fixed by setting `flowType: 'pkce'` in
  `web/src/supabase/config.ts`, which returns the session via `?code=`
  instead.
- 2026-09-14: End-to-end verification against the live instance. Google
  sign-in was driven directly this session with a real account; a real
  `user_backups` row was confirmed via `psql` to have been created, then
  cleaned up before any real usage. Apple sign-in was confirmed working
  by Alex directly. Both providers are confirmed live, not just
  implemented.
- 2026-09-14: Firebase's own code (`web/src/firebase/*`) left in the repo
  untouched — no longer referenced by `AccountView`, `TopBar` or
  `ProfileView`, but not deleted. See "What would force revisiting" above
  for its open removal question.
