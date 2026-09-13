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
  (Google Sign-In and Sign in with Apple) fills the role ADR-0017 gave
  Supabase Auth (GoTrue), same underlying need, different vendor.

**Specifics settled in conversation with Alex since this ADR was first
accepted — filling in the same decision, not reopening it.** Originally
specced as three usage tiers with login and storage-mode as separate
axes (see the 2026-09-14 entry in Implementation progress for that
earlier design and why it was simplified); as of 2026-09-14 it is two:

- **Tier 1 — no login at all.** The app stays fully usable with zero
  auth, exactly as it is today: demo/test data generation (Get Started's
  "Want a demo first?" flow) and manual JSON import both keep working
  unchanged, with data in today's existing global, unscoped localStorage
  — the same keys, the same shape, no namespacing. This is the
  zero-friction, no-signup path, and it must not regress: nothing about
  adding Firebase login puts a login wall in front of the app.
- **Tier 2 — logged in (Firebase Auth: Google or Apple) means cloud
  storage.** There is no separate "logged in but still local" mode and
  no storage-mode picker: signing in *is* the switch. Firestore backs
  the data, but Firestore's offline persistence (an on-device cache
  Firestore itself manages) keeps reads and writes feeling local and
  instant rather than round-tripping to the network on every action —
  so tier 2 does not trade away the offline-first feel, even though the
  source of truth is now remote.
- **Sign-in resolution, once per sign-in, not an ongoing sync:** if a
  Firestore document already exists for that Firebase UID (signing in
  on a second device, or an account someone else already set up — e.g.
  Natalga's), it wins outright — pulled down, whatever was in local
  storage on this device is discarded, no merge. If no document exists
  yet for that UID, today's local data is pushed up once, becoming the
  initial document. This is ADR-0015's original cutover shape (pull if
  populated, push if empty), now triggered automatically by sign-in
  rather than by a separate "switch to server storage" action. The
  local-storage wipe on either branch must only happen after the
  Firestore read or write is confirmed to have succeeded, so a failed
  push or a dropped connection can't destroy the only copy of the data.
- **Sign-out wipes the local working copy.** Chosen deliberately over
  leaving it behind, for the shared-device case this app explicitly
  supports (Alex and Natalga on the same browser): the next person to
  open the app after a sign-out sees a clean, empty local-only state,
  not the previous person's last-synced data. Nothing is lost by this —
  by the time sign-out is possible, that data is already durable in
  Firestore under its owner's UID; wiping the local cache only removes
  the on-device copy, not the data itself.
- **Auth providers**: both Google Sign-In and Sign in with Apple. Alex
  already holds a paid Apple Developer account for an unrelated shipped
  app, so the usual $99/year objection to adding Apple sign-in doesn't
  apply here — the marginal cost is just the Firebase Auth configuration
  work (a Services ID and a private key), not a new yearly fee.
- **Data storage shape (tier 2)**: no zip file. Firestore stores the
  Account backup-bundle content (lab-reports, medications,
  scheduled-visits, settings) natively as JSON fields on a document,
  skipping the zip/unzip step the local Account-backup export uses today
  (`data/backupArchive.ts` / `data/backupRestore.ts`). Firestore's 1 MiB
  per-document size ceiling is a known constraint — currently
  comfortable for this payload, but worth remembering as it grows.
- **Per-user data model (tier 2)**: one Firestore document per person,
  access-controlled by Firebase Auth — each person's security rules
  grant access only to their own document (`allow read, write: if
  request.auth.uid == <doc's owner uid>`). No shared or admin
  cross-access between, say, Alex's and his mother's data.
- **"Switching users" UX**: the plain, standard flow — sign out, then
  sign back in as the other person on the same device/browser when
  needed. A caregiver/admin-style single-login-sees-both-profiles model
  was explicitly considered and rejected in favor of this simpler, fully
  separate-accounts approach.
- **localStorage is not encrypted.** True of tier 1's data, and equally
  true of tier 2's on-device Firestore cache — this is a correction, not
  new information: browser storage is plaintext on disk, protected only
  by OS file permissions and same-origin policy, readable by anyone with
  access to the device or browser profile, or via an XSS bug. Moving the
  source of truth to Firestore in tier 2 doesn't change that its local
  cache sits in the same kind of unencrypted on-device storage tier 1
  always has. Stating it plainly here so it isn't implied to mean
  "secure" going forward.
- **Existing privacy copy becomes an overclaim once cloud sync exists as
  an option.** The footer's "Your data stays in this browser" line
  (`web/src/components/conditions/TopBar.tsx`) and Get Started's privacy
  pitch, "All processing occurs locally in your browser — client-side
  persistence, zero server transmission..."
  (`web/src/components/conditions/ProfileView.tsx`), both stay true for
  tier 1, but stop being true the moment someone signs in (tier 2). With
  the two-tier model this now tracks a single boolean (signed in or
  not) rather than a per-user setting: the plan is to replace the
  blanket claim with a small, honest indicator driven directly off auth
  state — e.g. "Local" when signed out, "Synced to cloud" when signed
  in. This is a UI/copy change to make during implementation; recorded
  here as intent only, not worded further now.

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

## Implementation progress

- 2026-09-13: Firebase console set up — project `bloodtests-v3`
  (Gemini-in-Firebase and Google Analytics both declined; Firebase
  Hosting not enabled, since the app deploys via Cloudflare Workers).
  Google and Apple sign-in providers are both enabled (Apple via a
  dedicated Services ID/App ID/key, `org.isayenko.paneloom`, kept
  separate from the unrelated wardrobe/Lapel identifiers already on the
  Apple Developer account). Firestore is created (Standard edition,
  `eur3` multi-region, chosen for latency over the `nam5` default —
  irreversible once set) with `request.auth.uid`-scoped security rules
  published, gating `users/{userId}` per ADR's per-person-document
  model — no data written yet.
- 2026-09-13: First application-code slice landed — `firebase` SDK
  installed, `web/src/firebase/{config,auth}.ts`, a `useAuthUser` hook,
  and a sign-in/sign-out card on the Account page (Google + Apple
  buttons; shows display name/email and a Sign out button once signed
  in). This slice is deliberately narrow: no localStorage
  namespacing by uid, no Firestore reads/writes, no storage-mode
  picker, no migration flow, and no change to the TopBar's "your data
  stays in this browser" copy — all still to come.
- 2026-09-13: Custom auth domain. The Google consent screen's "to
  continue to bloodtests-v3.firebaseapp.com" line was a giveaway of the
  underlying project — a project ID is immutable once created, but a
  second Firebase Hosting site named `paneloom` (`paneloom.web.app` /
  `paneloom.firebaseapp.com`, a name that happened to be free) can carry
  the auth handler pages instead. Created via the Firebase CLI
  (`firebase hosting:sites:create paneloom`) with a one-file placeholder
  deploy to activate its `/__/auth/handler` route; `authDomain` in
  `web/src/firebase/config.ts` now points there, `paneloom.firebaseapp.com`
  is in Firebase Auth's authorized domains, and Apple's Services ID
  (`org.isayenko.paneloom.web`) carries the matching domain/return-URL
  pair alongside the old `bloodtests-v3.firebaseapp.com` ones (left in
  place rather than removed, since nothing depends on tidying them up).
  This required enabling Firebase Hosting after all, for exactly this
  one narrow purpose — the actual app still deploys via Cloudflare
  Workers, and this Hosting site serves nothing else.
- 2026-09-14: Simplified from three tiers to two. The original design
  (above, in Decision) gave logged-in users a separate local/cloud
  storage-mode choice — tier 2 (logged in, still local) existed mainly
  to let two people share one browser without clobbering each other's
  data. Reconsidered as unneeded complexity: signing in now switches
  storage mode directly, with no picker. The old tier 2 is dropped
  entirely; what was tier 3 is renumbered tier 2. Two policy questions
  this raised were settled explicitly: sign-in conflict resolution is
  cloud-wins (an existing Firestore document for that UID is pulled
  down and local is discarded; an empty one gets today's local data
  pushed up as its first version — the local wipe on either branch
  gated on that Firestore call actually succeeding, so a failed
  read/write can't take the only copy with it), and sign-out wipes the
  local working copy rather than leaving it behind, so a shared device
  (Alex and Natalga on the same browser) shows a clean slate to
  whoever's next rather than the previous person's synced data. Nothing
  is lost by that wipe — by the time sign-out is possible, the data is
  already durable in Firestore. Not yet implemented: this is a design
  decision recorded ahead of the code that will carry it out.
