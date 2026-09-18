# Account, backup and cloud sync

The Account section (`#account`, last in the nav, reachable while validation
errors exist) is where data leaves or enters the browser wholesale. Policy:
[ADR-0018](decisions/adr-0018-firebase-storage-provisional.md) (the two-tier
model — no login stays local; signing in switches storage mode directly, no
separate picker) running over
[ADR-0019](decisions/adr-0019-self-hosted-supabase-replaces-firebase.md)'s
self-hosted Supabase. The wider design-space survey is
[`sync-architecture-options.md`](sync-architecture-options.md).

## Auth card

`AccountAuthCard` offers Google / Apple sign-in through
`web/src/supabase/auth.ts` (`signInWithGoogle()` / `signInWithApple()`, both
`supabase.auth.signInWithOAuth` with `redirectTo: window.location.href`) and
`signOutUser()`. `web/src/supabase/config.ts` hardcodes the project URL
(`https://api.paneloom.com`) and anon key — both designed for public client
exposure, RLS being the access boundary, not secrecy — and sets
`flowType: 'pkce'`: the router owns the URL hash (`#account`, `#reports`, …),
which collides with the implicit flow's `#access_token=…` fragment, so the
session comes back in a `?code=` query param instead.

The instance is a self-hosted Supabase, not Supabase Cloud — own Postgres,
GoTrue auth, PostgREST and an Envoy gateway behind a Supavisor pooler, with
Realtime / Storage / imgproxy / Edge Functions / Studio deliberately dropped.
The client talks straight to its REST/Auth API over HTTPS; nothing runs
server-side in this app's own deploy.

`web/src/hooks/useSupabaseAuthUser.ts` exposes `{user, loading}` via
`supabase.auth.getSession()` plus `onAuthStateChange`; the TopBar and Get
Started's pitch (`ProfileView.tsx`) read it too, swapping their local-only
copy and "100% private" pillar for "Synced to your account" while signed in.

## Sync: two cutover moments, no ongoing sync

`web/src/supabase/sync.ts`'s `pullCloudFiles` / `pushCloudFiles` work against
one `public.user_backups` row per person — `id` uuid primary key referencing
`auth.users(id)` on delete cascade; `manifest` / `lab_reports` /
`medications` / `scheduled_visits` / `settings` jsonb columns, never
`laboratory-prices.json` (the shipped registry wins, as in local restore);
`updated_at` — gated by four RLS policies scoped to `auth.uid() = id`.
Migration source: `supabase/migrations/0001_init.sql`, applied by hand
against the instance, never by app code.

- **Signing in** pulls and restores an existing row for that UID through the
  same `onImportAll` Import-all-data uses (cloud wins, local discarded) or, if
  none exists, pushes today's local data up as the account's first cloud copy.
  Because Supabase's OAuth is redirect-based, `AccountAuthCard` wires the
  cutover to a `supabase.auth.onAuthStateChange` listener on the `SIGNED_IN`
  event — never `INITIAL_SESSION`, which fires for an already-authenticated
  returning visit and must not re-trigger sync.
- **Signing out** pushes current local state up first and only once that
  succeeds calls `signOutUser()` then `onClearAll()` to wipe the local copy,
  so a shared browser shows the next person a clean slate; a failed push
  blocks the rest of sign-out rather than wiping data it could not save.

Signing in and out is the whole interface.

## Database details

Subject / sex / birth year / notes plus a read-only `generatedAt` stamped on
each export, persisted under `bloodtests_envelope_meta_v1` and written into
the export envelope with empty fields omitted. Always expanded. `sex` picks a
sex-dependent index's band ([`computed-indices.md`](computed-indices.md));
`birthYear` is not read.

## Export, import, clear

- **Export all data** downloads `blood-tests-backup-<yyyymmdd>.zip` —
  `lab-reports.json` (the Export JSON envelope,
  [`interchange-format.md`](interchange-format.md)), `medications.json`,
  `scheduled-visits.json`, `laboratory-prices.json`, `settings.json` (view
  settings and per-panel chart preferences, only keys that exist) and
  `manifest.json` — built by `data/backupArchive.ts` and zipped with `fflate`,
  loaded by dynamic `import()` on click.
- **Import all data** reads such a zip through `data/backupRestore.ts`: the
  manifest (`format: "blood-tests-backup"`, `version: 1`) and every present
  part are parsed and shape-checked before anything changes, so a bad file
  changes nothing; after a confirm it runs Clear all data, then restores
  `lab-reports.json` through the same replacing import as Import JSON
  (Database details from its envelope) and medications, scheduled visits and
  settings through their own modules' save functions — a part missing from
  the zip left empty, `laboratory-prices.json` never restored — reporting per
  part.
- **Clear all data** is a `DangerCard` gated by a press-and-hold
  (`HoldToClearButton`: mouse / touch / keyboard, a 2-second hold whose
  progress fills the button; letting go early cancels). It runs the reports'
  own Clear and `clearSharedMeta`, then sweeps `backupArchive.ts`'s
  `USER_DATA_KEYS` (reports, Database details, medications, schedule, view
  settings, share-link meta, imported links, the sidebar's collapsed state —
  cleared but not in `settings.json`) plus the chart-preference prefixes —
  one list the export, the clear and the import all read; the shell then
  reloads its schedule and table controls from storage.
