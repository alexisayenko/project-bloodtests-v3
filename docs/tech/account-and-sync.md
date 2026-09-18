# Account, backup and cloud sync

The Account section (`#account`, last in the nav, reachable while validation
errors exist) is where data leaves or enters the browser wholesale. Policy:
[ADR-0018](decisions/adr-0018-firebase-storage-provisional.md) (the two-tier
model — no login stays local; signing in switches storage mode directly, no
separate picker), with identity from
[ADR-0019](decisions/adr-0019-self-hosted-supabase-replaces-firebase.md)'s
self-hosted Supabase Auth and the data store from
[ADR-0026](decisions/adr-0026-github-backed-cloud-storage.md): a private
GitHub repo behind the app's own Worker. The wider design-space survey is
[`sync-architecture-options.md`](sync-architecture-options.md).

## Auth card

`AccountAuthCard` offers Google / Apple sign-in through
`web/src/supabase/auth.ts` (`signInWithGoogle()` / `signInWithApple()`, both
`supabase.auth.signInWithOAuth` with `redirectTo: window.location.href`) and
`signOutUser()`. `web/src/supabase/config.ts` hardcodes the project URL
(`https://api.paneloom.com`) and anon key — designed for public client
exposure — and sets `flowType: 'pkce'`: the router owns the URL hash
(`#account`, `#reports`, …), which collides with the implicit flow's
`#access_token=…` fragment, so the session comes back in a `?code=` query
param instead.

Supabase is now the identity provider only: a self-hosted instance (own
Postgres, GoTrue auth behind an Envoy gateway) whose one job is to sign the
user in and issue the access token the Worker checks. Sign-in needs that
service reachable; the data does not live there.

`web/src/hooks/useSupabaseAuthUser.ts` exposes `{user, loading}` via
`supabase.auth.getSession()` plus `onAuthStateChange`; the TopBar and Get
Started's pitch (`ProfileView.tsx`) read it too, swapping their local-only
copy and "100% private" pillar for "Synced to your account" while signed in.

## Sync: two cutover moments, no ongoing sync

`web/src/supabase/sync.ts`'s `pullCloudFiles()` / `pushCloudFiles(files)` call
the Worker's `GET` / `PUT /api/data` with the session's access token as a
bearer; the browser holds no GitHub credential. The data is a folder in the
private repo `alexisayenko/data-storage`, `paneloom/users/<email>/`:

- `reports/YYYY-MM-DD__<lab-slug>.json` — one single-report `bloodtests-3`
  envelope each, `-2`, `-3` suffix for the same lab and date;
- `medications.json`, `scheduled-visits.json`, `settings.json`;
- `manifest.json`.

`laboratory-prices.json` is never synced (the shipped registry wins, as in
local restore). `data/reportFiles.ts` splits the local `lab-reports.json` into
report files on push and merges them back, newest date first, on pull.

Guards, all client-side in `sync.ts`:

- A pull with no reports, medications or visits returns `null` and is never
  imported, so an empty or settings-only folder cannot wipe local data.
- A push with none of those returns `false` and sends nothing; the Worker
  rejects it too.
- The manifest carries a timestamp, so it is resent verbatim while nothing
  else differs from the last pull or push (a digest kept in
  `paneloom_cloud_baseline_v1`); an unchanged push therefore makes no commit.

- **Signing in** pulls and restores an existing folder through the same
  `onImportAll` Import-all-data uses (cloud wins, local discarded) or, if the
  cloud has no data, pushes today's local data up as the account's first cloud
  copy. Because Supabase's OAuth is redirect-based, `AccountAuthCard` wires the
  cutover to a `supabase.auth.onAuthStateChange` listener on the `SIGNED_IN`
  event — never `INITIAL_SESSION`, which fires for an already-authenticated
  returning visit and must not re-trigger sync.
- **Signing out** pushes current local state up first (skipped when local is
  empty and the cloud is not) and only once that succeeds calls
  `signOutUser()` then `onClearAll()` to wipe the local copy, so a shared
  browser shows the next person a clean slate; a failed push blocks the rest
  of sign-out rather than wiping data it could not save.

Signing in and out is the whole interface.

### The Worker

`web/worker/githubData.ts`, routed from `web/worker/index.ts` for
`/api/data` only; everything else falls through to `ASSETS`
([`share-links-and-deploy.md`](share-links-and-deploy.md)). It is a stateless
proxy that stores nothing itself.

1. **Authenticate.** Verifies the bearer as a Supabase JWT — HS256 with
   `SUPABASE_JWT_SECRET`, `exp` and `nbf` checked — and takes the email from
   it. `401` on any failure.
2. **Authorize.** The email must be in `ALLOWED_EMAILS`; unset denies all
   (`403`). The folder is derived from the verified email, never from the
   request, so the allowlist is the isolation boundary between users: one
   token reaches every folder.
3. **Read.** One GraphQL request for the user's folder.
4. **Write.** One atomic commit through the Git Data API. It deletes only
   app-named files in that user's folder (`reports/*.json`, the four top-level
   files), rejects an empty or trivial `PUT`, and answers `409` if the branch
   moved meanwhile. A GitHub failure is `502`.

### Setup

Vars in `web/wrangler.jsonc`: `GITHUB_REPO` (`alexisayenko/data-storage`),
`ALLOWED_EMAILS`. Secrets, set once from `web/` and never committed:

```
npx wrangler secret put GITHUB_TOKEN          # fine-grained PAT, contents
                                              # read/write on that repo only
npx wrangler secret put SUPABASE_JWT_SECRET   # the instance's JWT secret
```

A CI deploy keeps existing secrets. `Env` is typed in `web/worker/env.d.ts`.
`supabase/migrations/0001_init.sql` (the `user_backups` table) is superseded
by ADR-0026: kept as a record, not applied to new instances.

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
