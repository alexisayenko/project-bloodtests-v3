# ADR-0018: Firebase (Auth + Firestore) replaces the Supabase plan, provisionally

Status: accepted · 2026-09-13 · supersedes
[ADR-0017](adr-0017-supabase-storage-self-hosted-then-cloud.md)

The storage-mode shape still stands, unchanged from ADR-0015 through
ADR-0017: an opt-in "Dedicated server" mode beside the unchanged
local-only default, syncing the existing Account backup-bundle, with a
one-time cutover migration and no ongoing two-way sync. What is
superseded is *what the server is*, again: ADR-0017's two-phase Supabase
plan (self-hosted on perkunas now, managed Supabase Cloud once there are
real users) is dropped before either phase was built, in favor of
Firebase — Google's managed platform, Firebase Auth for "Sign in with
Google" and Firestore for the synced data. Unlike ADR-0015 → ADR-0017,
this is not a reversal of the auth stance: real accounts via a real
login button were already the plan, and stay the plan. What changes is
the vendor and the deployment shape, and — stated plainly rather than
dressed up as more settled than it is — this choice is itself explicitly
provisional, in Alex's own words: "let's do maybe firebase now, so
later I'll check what fits me better."

## Context

ADR-0017 chose Supabase specifically to self-host first, because
self-hosting kept the data on Alex's own machine rather than a vendor's,
preserving the app's "your data stays in this browser" privacy pitch a
little longer. In conversation, that plan did not survive contact with
what it would actually take to stand up:

- **Self-hosted Supabase is real infrastructure work.** The stack is
  roughly ten Docker containers (Postgres, GoTrue, PostgREST, Realtime,
  Storage, and the rest), plus whatever DNS, TLS and reverse-proxy work
  perkunas's current state still needs on top of that — and, once
  running, a permanent ongoing maintenance burden, not a one-time setup
  cost. ADR-0017 acknowledged this cost but judged it acceptable; in
  practice, weighed against the alternative below, it no longer looked
  worth paying first.
- **Firebase needs no server at all.** Console clicks plus the client
  SDK get to a working Google Sign-In and a Firestore read/write in
  roughly 30-60 minutes, with Google operating everything behind it.
  Against a Docker stack plus reverse-proxy work plus indefinite ops,
  that gap in speed-to-working-setup and in who carries the ongoing
  maintenance was the deciding factor.
- **Managed Supabase Cloud (ADR-0017's Phase 2) was independently ruled
  out, for a different reason.** Its free tier pauses a project after a
  week of inactivity. This app's real usage is irregular — occasional
  blood draws, not daily traffic — so a paused project is a realistic
  outcome, not an edge case. Firebase's free tier has no inactivity
  pause and no monthly-active-user cap.
- **The original reason to self-host at all — avoiding third-party
  cloud specifically because this is sensitive health data — was
  weighed against and explicitly set aside, not forgotten.** That
  argument does not get weaker just because the user count is small; it
  was deprioritized anyway, on the grounds that this feature currently
  has zero real users (Alex, in development, only), and moving fast now
  was judged worth that tradeoff. This ADR records that as a deliberate
  choice made with the tradeoff understood, not as a quality bar the
  project no longer holds itself to.

## Decision

**Use Firebase for this repo's dedicated-server storage/auth feature:
Firebase Auth for "Sign in with Google," Firestore for the synced
data.** Nothing has been implemented yet — no Firebase project exists,
no client code, no migration flow. This ADR records the decision, not a
completed build.

**This is explicitly a provisional choice, not a firm long-term
architectural commitment.** It is adopted because it is the fastest way
to a working real-account, real-sync feature, not because Firebase was
evaluated against Supabase (or anything else) on its long-term merits
and won. A future session may reasonably reopen this once the feature
has real users and real usage patterns to weigh vendors against — that
is anticipated by this ADR, not a sign that this ADR failed.

**What carries over from ADR-0015/ADR-0017 unchanged, and is not
re-argued here:**

- Local-only storage stays the default, zero-friction path for anyone
  who does not opt in. Dedicated server mode remains strictly additive.
- The one-time-cutover migration model — no ongoing two-way sync, no
  conflict resolution: on first switch to server storage, an empty
  server gets the local bundle pushed once; a populated server has its
  data pulled down and the local copy is ignored entirely. Moving to
  Firebase changes what is on the other end of that cutover; it does
  not change the cutover's shape.
- The synced payload stays the existing Account backup-bundle shape
  (`data/backupArchive.ts` / `data/backupRestore.ts`).
- Real accounts and a real login flow are still the goal — Firebase Auth
  (Google Sign-In) fills the role ADR-0017 gave Supabase Auth (GoTrue),
  same underlying need, different vendor.

**Out of scope for this ADR and this repo:** whether Alex's other two
projects (`project-travel`, `project-wardrobe`, both currently on
managed Supabase Cloud) also move to Firebase is a separate,
not-yet-decided question requiring its own decision and its own work in
those repos. This ADR covers only `project-bloodtests-v3`'s own choice.
Standing up the Firebase project, the client integration, the
storage-mode Settings UI and the migration flow are all future work,
not started.

## Alternatives considered

- **ADR-0017's plan as written (self-hosted Supabase now, managed
  Supabase Cloud later)** — this ADR's whole subject. Rejected before
  either phase was built: Phase 1's setup and ops cost was judged not
  worth paying first against Firebase's console-and-SDK path, and
  Phase 2's free tier has an inactivity pause this app's usage pattern
  would likely hit.
- **Managed Supabase Cloud from day one, skipping the self-hosted
  phase** — already considered and rejected in ADR-0017 for the
  inactivity-pause reason above; re-confirmed rejected here for the same
  reason, independent of the Firebase comparison.
- **Continuing to defer the whole feature** — not chosen; Alex wants to
  move on this now, favoring speed over further deliberation.

## Consequences

- The vendor for the dedicated-server feature is Google (Firebase)
  rather than Alex's own infrastructure or Supabase. The health-data
  centralization concern ADR-0015 originally raised against Supabase
  applies at least as much to Firebase, and is being carried forward
  as an accepted, explicit tradeoff for now — not resolved.
- No self-hosted infrastructure to build or operate: perkunas is no
  longer on the critical path for this feature, unlike ADR-0017's Phase
  1. That also removes the permanent ops burden ADR-0017's Phase 1 would
  have carried.
- Because this is stated as provisional, implementation should avoid
  needlessly deep Firebase-specific coupling where a thin seam would do
  — the same spirit as ADR-0015's backup-bundle reuse — so that
  revisiting the vendor later is not a full rewrite. This ADR does not
  mandate a specific abstraction, only flags the intent.
- `project-travel` and `project-wardrobe` are unaffected: they stay on
  managed Supabase Cloud unless and until a separate decision in those
  repos says otherwise.

## What would force revisiting

- The feature gaining real users, at which point the health-data
  centralization tradeoff deprioritized here (in favor of moving fast
  with zero real users) is worth re-examining on its own terms.
- Firebase's free tier or pricing changing in a way that removes the
  advantage that motivated this choice (no inactivity pause, no MAU
  cap).
- Alex actually doing the "check what fits me better" comparison this
  ADR anticipates, and preferring Supabase, a self-hosted option, or
  something else once there is a working feature to compare against.
