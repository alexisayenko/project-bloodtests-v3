# Account, backup and cloud sync

The Account section (`#account`, last in the nav, reachable while validation
errors exist) is where data leaves or enters the browser wholesale. Policy:
[ADR-0018](decisions/adr-0018-firebase-storage-provisional.md) (the two-tier
model — no login stays local; signing in switches storage mode directly, no
separate picker), with identity from
[ADR-0027](decisions/adr-0027-worker-owned-oauth.md) (the Worker performs
Google and Apple OAuth itself; it replaced the self-hosted Supabase Auth of
[ADR-0019](decisions/adr-0019-self-hosted-supabase-replaces-firebase.md)) and
the data store from
[ADR-0026](decisions/adr-0026-github-backed-cloud-storage.md): a private
GitHub repo behind the same Worker. The wider design-space survey is
[`sync-architecture-options.md`](sync-architecture-options.md).

## Auth card

`AccountAuthCard` offers Google / Apple sign-in. Signing in is a plain
full-page navigation to the Worker's `/auth/login/google` or
`/auth/login/apple` (`loginPath()` in `web/src/cloud/session.ts`); the Worker
runs the OAuth flow and returns the browser to the app with a session cookie. The browser holds no
token and no auth library: the card learns who is signed in by `GET /auth/me`
on load (`fetchSession()`; `401 {providers}` = signed out, the body listing only the
providers whose secrets are set; `403` = signed in with an email no
longer on the allowlist, shown as "This account is not allowed." beside the
sign-in buttons for both providers) and signs out with
`POST /auth/logout` (`signOutUser()`, both in `web/src/cloud/session.ts`).
Every mutating call carries the header `X-Paneloom: 1`, the Worker's CSRF
guard: sign-out and the sync `PUT`.

The dev server has no Worker, so sign-in and sync need `wrangler dev`;
`web/vite.config.ts` proxies `/auth` and `/api` to `http://localhost:8787`.
When `/auth/me` is not JSON, is a `404`, or the request fails, the session is
`unavailable`, and a `401` listing no providers behaves the same: the card shows
"Sign-in is unavailable here." instead of a button. Otherwise it renders one
button per listed provider, so a link never lands on the Worker's `404` JSON.

`web/src/hooks/useCloudSession.ts` exposes `{user, loading, available,
notAllowed, providers, signOut}` from that `/auth/me` call; `AccountView.tsx` and Get Started's pitch
(`ProfileView.tsx`) read it, swapping the local-only copy and "100% private"
pillar for "Synced to your account" while signed in.

## Sync: two cutover moments, no ongoing sync

`web/src/cloud/sync.ts`'s `pullCloudFiles()` / `pushCloudFiles(files)` call
the Worker's `GET` / `PUT /api/data` with the session cookie (same-origin
`fetch`; only the `PUT` sends `X-Paneloom: 1`); the browser holds no GitHub credential. The data is a folder in the
private repo `alexisayenko/data-storage`, `paneloom/users/<email>/`:

- `reports/YYYY-MM-DD__<lab-slug>.json` — one single-report `bloodtests-3`
  envelope each, `-2`, `-3` suffix for the same lab and date;
- `medications.json`, `scheduled-visits.json`, `settings.json`;
- `manifest.json`.

`laboratory-prices.json` is never synced (the shipped registry wins, as in
local restore). The files are verbatim ([ADR-0028](decisions/adr-0028-verbatim-import-export.md)):
a pull returns the folder's texts unchanged, `data/importResults.ts` holds them
next to the parsed sessions (`data/storage/heldFiles.ts`, key
`paneloom_held_files_v1`), and a push sends those texts back byte for byte. A
new upload is split into per-report files by `data/reportFiles.ts` from the
original objects; an edit re-serializes only its own file; a deleted report's
file is removed from the next push.

Guards, all client-side in `sync.ts`:

- A pull with no reports, medications or visits returns `null` and is never
  imported, so an empty or settings-only folder cannot wipe local data.
- A push with none of those returns `false` and sends nothing; the Worker
  rejects it too.
- The manifest carries a timestamp, so the held one is resent verbatim while
  the payload digest is unchanged (kept in `paneloom_held_files_v1`); a
  pull-then-push with no edits therefore makes no commit. A cloud folder with
  no manifest gets one on the first push.
- Sign-out pushes the held files first, without pulling, and wipes local data
  only when that push saved; an empty local set is never pushed over the cloud.

- **Signing in** pulls and restores an existing folder through the same
  `onImportAll` Import-all-data uses (cloud wins, local discarded) or, if the
  cloud has no data, pushes today's local data up as the account's first cloud
  copy. Because sign-in ends in a full page load, the "just signed in" moment
  is detected on the next load: `AccountAuthCard` calls `markSigningIn()`
  (a `sessionStorage` flag, valid ten minutes) as the sign-in link is
  followed, and `consumeSigningIn()` takes it once, after `/auth/me`
  succeeds. A returning visit with a live session has no flag and
  never re-triggers sync. If the cutover sync fails, the card marks again and
  shows a notice, so the next load retries within a fresh ten minutes.
- **Signing out** first saves local state (`pushBeforeSignOut()` pulls, then
  pushes) and acts on one of three results. `saved` (the push succeeded, or
  local is empty so nothing can be lost; an empty local set is never pushed
  over the cloud) calls `signOut()` from the hook (`POST /auth/logout`) then
  `onClearAll()` to wipe the local copy, so a shared browser shows the next
  person a clean slate. `auth` (the pull or push got `401` / `403`: the session
  is dead or the email was removed) still signs out but keeps the local data and
  says it was not backed up. `failed` (any other error, such as a `502` or a
  network drop, or a push that sent nothing) does not sign out and does not
  clear; it shows "Could not back up to the cloud" so the user can retry.
  Local data is never wiped unless it was saved.

Signing in and out is the whole interface.

### The Worker

`web/worker/auth.ts` (sign-in and the session) and `web/worker/githubData.ts`
(the data), routed from `web/worker/index.ts` for `/auth/*` and `/api/data`;
everything else falls through to `ASSETS`
([`share-links-and-deploy.md`](share-links-and-deploy.md)). It is a stateless
proxy that stores nothing itself; every `/auth/*` and `/api/data` response is
`Cache-Control: no-store`. Each piece is disabled, not broken, when its
config is missing.

**Sign-in.**

- `GET /auth/login/google|apple` sets the cookie `paneloom_oauth` (random
  `state`, `nonce` and PKCE verifier, HMAC-signed with `SESSION_SECRET`,
  HttpOnly, Secure, ten minutes, `SameSite=None` for Apple, whose callback is a
  cross-site POST, `Lax` for Google) and redirects to the provider: Google with a PKCE (S256)
  code flow, Apple with `response_mode=form_post`, `scope=email` and a
  `nonce`. An unknown or unconfigured provider is a `404` JSON error.
- `GET /auth/callback/google` and `POST /auth/callback/apple` check `state`
  against the cookie in constant time, exchange the code at the provider's
  token endpoint, and read `id_token` from that direct response (no signature
  check needed there, OIDC Core 3.1.3.7). They verify `iss`, `aud` (the
  client / Service ID), `exp`, `nonce`, and that `email` is present and
  verified. The lowercased email must be in `ALLOWED_EMAILS`. Success clears
  `paneloom_oauth`, sets the session and redirects (`303`) to `/#account`;
  any failure is a small plain HTML page with a back link, never an echoed
  provider error.
- Apple's client secret is an ES256 JWT built per login with WebCrypto
  (`iss` Team ID, `sub` Service ID, `kid` Key ID, five minutes).
- `GET /auth/me` is `200 {email, provider}`, `401 {providers: [...]}` without a valid session (the providers whose secrets are set;
empty when `SESSION_SECRET` is missing or short), or
  `403 {}` when the session's email is no longer in `ALLOWED_EMAILS`.
  `POST /auth/logout` (needs `X-Paneloom: 1`) expires the cookie, `204`.

**Session.** `paneloom_session`: `HttpOnly; Secure; SameSite=Lax; Path=/`,
30 days, `base64url({email, provider, iat, exp}).base64url(HMAC-SHA256)` keyed
with `SESSION_SECRET`. No refresh token: after 30 days the user signs in
again. Without a `SESSION_SECRET` of at least 32 characters nothing
authenticates (sessions never verify) and the login routes are `404`.

**`/api/data`.**

1. **Authenticate.** Verifies the session cookie (signature in constant time,
   `exp`) and takes the email from it. `401` on any failure. `PUT` also
   needs `X-Paneloom: 1` and, if an `Origin` header is present, it must equal
   the request's origin (`403` otherwise).
2. **Authorize.** The email must be in `ALLOWED_EMAILS`, re-checked on every
   request so a removed email is cut off at once; unset denies all (`403`).
   The folder is derived from the verified email, never from the request, so
   the allowlist is the isolation boundary between users: one token reaches
   every folder.
3. **Read.** One GraphQL request for the user's folder.
4. **Write.** One atomic commit through the Git Data API. It deletes only
   app-named files in that user's folder (`reports/*.json`, the four top-level
   files), rejects an empty or trivial `PUT`, and answers `409` if the branch
   moved meanwhile. A GitHub failure is `502`.

### Setup

One-off, in this order. The redirect URIs use the request's own origin, so
`https://paneloom.com` is production; a preview or `workers.dev` origin needs
its own URIs registered.

**Google.** In the Google Cloud Console:

1. Create (or pick) a project.
2. APIs & Services > OAuth consent screen: User type **External**, publishing
   status **Testing**, and add your own email under **Test users**. (Testing
   mode caps the app at those users, which is all the allowlist needs.)
3. APIs & Services > Credentials > Create credentials > **OAuth client ID**,
   Application type **Web application**.
4. Authorized redirect URIs: `https://paneloom.com/auth/callback/google`.
5. Copy the Client ID and Client secret.

**Apple.** In Apple Developer > Certificates, Identifiers & Profiles (a paid
developer account):

1. Identifiers > the existing **Service ID** > Sign in with Apple >
   Configure: Domains and Subdomains `paneloom.com`, Return URLs
   `https://paneloom.com/auth/callback/apple`.
2. Keys > create a key with **Sign in with Apple** enabled (Primary App ID
   set); download the `.p8` once and note its **Key ID**.
3. Note the **Team ID** (Membership) and the **Service ID** identifier.

**Worker.** Vars in `web/wrangler.jsonc`: `GITHUB_REPO`
(`alexisayenko/data-storage`), `ALLOWED_EMAILS` (comma-separated; with Apple's
"Hide My Email" the relay address, not the real one). Secrets, set once from
`web/` and never committed:

```
npx wrangler secret put GITHUB_TOKEN          # fine-grained PAT, contents
                                              # read/write on that repo only
npx wrangler secret put SESSION_SECRET        # 32+ random bytes, e.g.
                                              # openssl rand -base64 32
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put APPLE_TEAM_ID
npx wrangler secret put APPLE_KEY_ID
npx wrangler secret put APPLE_SERVICE_ID
npx wrangler secret put APPLE_PRIVATE_KEY     # the .p8 (PKCS8 PEM); a
                                              # literal \n for newlines is fine
```

Skip either provider's secrets to leave it off. Rotating `SESSION_SECRET`
signs everyone out. A CI deploy keeps existing secrets. `Env` is typed in
`web/worker/env.d.ts`. `supabase/migrations/0001_init.sql` (the
`user_backups` table) is superseded by ADR-0026: kept as a record, not
applied to new instances.

## Database details

Only `sex`, persisted under `bloodtests_envelope_meta_v1`; it picks a
sex-dependent index's band ([`computed-indices.md`](computed-indices.md)) and
is read from an imported file's own `sex`. Nothing here is written into an
export: the stored files keep their own subject, birth year and notes, and the
card no longer edits them.

## Export, import, clear

- **Export all data** downloads `blood-tests-backup-<yyyymmdd>.zip` in exactly
  the stored layout: `reports/YYYY-MM-DD__<lab>.json` files as held (verbatim),
  `medications.json`, `scheduled-visits.json`, `settings.json` (held as
  imported until changed, then rebuilt from storage) and `manifest.json`
  (the held one while the payload is unchanged) — built by
  `data/backupArchive.ts` and zipped with `fflate`, loaded by dynamic
  `import()` on click. `laboratory-prices.json` is no longer written. Export
  reads no envelope metadata from `localStorage`.
- **Import all data** reads such a zip through `data/backupRestore.ts`: the
  manifest (`format: "blood-tests-backup"`, `version: 1`) and every present
  part are parsed and shape-checked before anything changes, so a bad file
  changes nothing; after a confirm it runs Clear all data, then holds the
  report files as they are (`replaceReportFiles`) and restores medications,
  scheduled visits and settings through their own modules' save functions — a
  part missing from the zip left empty, a `laboratory-prices.json` accepted
  but not restored — reporting per part. The legacy `lab-reports.json` zip
  and single-envelope JSON uploads are still read; a single-envelope upload
  is the one path that produces files (split per report, `lastUpdatedDate`
  set). The held store roughly doubles the report bytes in `localStorage`
  (about 190 KB + 97 KB for two real folders against a quota of about 5 MB).
- **Clear all data** is a `DangerCard` gated by a press-and-hold
  (`HoldToClearButton`: mouse / touch / keyboard, a 2-second hold whose
  progress fills the button; letting go early cancels). It runs the reports'
  own Clear and `clearSharedMeta`, then sweeps `backupArchive.ts`'s
  `USER_DATA_KEYS` (reports, Database details, medications, schedule, view
  settings, share-link meta, imported links, the sidebar's collapsed state —
  cleared but not in `settings.json`) plus the chart-preference prefixes —
  one list the export, the clear and the import all read; the shell then
  reloads its schedule and table controls from storage.
