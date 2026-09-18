# ADR-0026: Cloud data lives in a private GitHub repo, behind a Worker

Status: accepted · 2026-09-19 · supersedes
[ADR-0019](adr-0019-self-hosted-supabase-replaces-firebase.md) for the data
store only; its auth half stands

The storage-mode shape and the cutover model are unchanged
([ADR-0015](adr-0015-dedicated-server-storage-via-bearer-token.md),
[ADR-0018](adr-0018-firebase-storage-provisional.md),
[ADR-0019](adr-0019-self-hosted-supabase-replaces-firebase.md)): no login
stays local; signing in pulls-or-pushes once, signing out pushes then clears;
no ongoing two-way sync. Supabase Auth (Google / Apple, PKCE, at
`api.paneloom.com`) stays as the identity provider. What changes is where the
signed-in user's data is stored: not the `public.user_backups` row, but plain
JSON files in a private GitHub repository, reached only through the app's own
Worker.

## Context

The Supabase row was one jsonb blob per person. It had no history: a bad push
overwrote the last good copy, and there was nothing to diff or roll back to.
The data was also awkward to reach outside the app. The owner cannot open a
jsonb column and fix a stored value, and [ADR-0025](adr-0025-mchc-percent-is-not-an-accepted-unit.md)
already names "a data edit in the owner's own store, with the history kept
there (git for the owner's files)" as the remedy for a mislabelled unit. A
database also has to be run.

A git repository gives all three: versioned, diffable history; files an owner
can edit and commit by hand; nothing to operate. The catch is that a browser
cannot hold a GitHub credential with write access to a private repo.

## Decision

**Cloud data is a folder of JSON files in the private repo
`alexisayenko/data-storage`, written and read only by the Worker.**

- **Layout**, under `paneloom/users/<email>/`: `reports/YYYY-MM-DD__<lab-slug>.json`
  (one single-report `bloodtests-3` envelope each, a `-2`, `-3` suffix for
  the same lab and date), `medications.json`, `scheduled-visits.json`,
  `settings.json`, `manifest.json`. `laboratory-prices.json` is not synced
  (the shipped registry wins, as before).
- **The browser never holds a GitHub token.** The Worker
  (`web/worker/githubData.ts`, routed from `web/worker/index.ts`) serves
  `GET` and `PUT /api/data`. It verifies the caller's Supabase access token
  (HS256, secret `SUPABASE_JWT_SECRET`, `exp` / `nbf` checked), takes the
  email from it, and checks it against `ALLOWED_EMAILS` (unset means deny
  all). It then talks to GitHub with one fine-grained PAT, the secret
  `GITHUB_TOKEN`, scoped to that one repo.
- **Reads** are one GraphQL request for the user's folder.
- **Writes** are one atomic commit through the Git Data API. The Worker
  deletes only app-named files in that user's folder, rejects an empty or
  trivial `PUT`, and answers `409` if the branch moved under it.
- **The client** (`web/src/supabase/sync.ts`, `web/src/data/reportFiles.ts`)
  splits the local `lab-reports.json` envelope into per-report files on push
  and merges them back on pull. The manifest carries a timestamp, so its
  previous text is reused unless another file changed: an unchanged push
  makes no commit.
- **Two guards against wiping data.** A cloud pull with no reports,
  medications or visits is never imported, and a local set with none is never
  pushed. Settings and a manifest alone do not count as data.
- **Cutover behaviour is unchanged.** Sign-in pulls and restores, or pushes
  local as the first cloud copy; sign-out pushes, then clears.

The `user_backups` table and `supabase/migrations/0001_init.sql` are
superseded; the migration file stays as a record and is not run against new
instances.

## Alternatives considered

- **Keep Supabase and add version history** (a history table or a trigger
  copying each old row). Adds history, but the data stays an opaque jsonb blob
  behind a database to run, and the owner still edits it through SQL, not a
  file.
- **The user pastes a GitHub PAT into the browser.** No server, but a
  write-capable secret sits in `localStorage` next to the health data and in
  reach of any script on the page, and every user has to mint one. Ruled out
  by the same rule that keeps other credentials out of the client.
- **GitHub OAuth device flow, through a proxy Worker.** The user authorizes
  the app against their own GitHub. It needs a Worker anyway for the client
  secret and CORS, an account on GitHub for every user, and a repo per user;
  the Worker cost is paid without the single-owner simplicity.
- **Direct browser to GitHub with an app-issued token.** The browser would
  need a token minted by something the app runs, which is the Worker again, or
  a token baked into the bundle, which is a public write credential.

## Consequences

- **The Worker is now a server the app owns.** This amends the "the app owns
  no server" line in `CLAUDE.md`. Honestly stated: it is a stateless,
  auth-checking proxy that holds one repo-scoped token and stores nothing
  itself; the data is in the repo, identity is in Supabase Auth.
- **The allowlist is the isolation boundary.** One shared token can reach every
  user's folder, so `ALLOWED_EMAILS` and the Worker's path derivation from the
  verified email are what keep users apart. Opening sync to more people means
  revisiting this.
- **The email is in file paths, and so in git history**, permanently, even
  after a folder is deleted.
- **Sign-in still needs the Supabase auth service** reachable; only the data
  store moved.
- **A push is one commit or nothing**, never a half-written folder. A `409`
  means another writer landed first and the push is retried, not merged.
- **Owner edits are first-class.** A corrected file committed by hand is
  pulled at the next sign-in, and `git log` is the version history.
- Local data, share links and the backup zip are untouched: the split into
  per-report files exists only on the wire and in the repo.

## What would force revisiting

- Sync opened to users beyond the allowlist: per-user repos or a real database
  again, since one token over all folders stops being acceptable.
- Data volume or write frequency that outgrows the GitHub API's limits, or a
  repo size that makes history unwieldy.
- Health-data policy or a user's expectation that argues against email in
  paths and history.
- Any need for concurrent, ongoing sync between devices rather than the two
  cutover moments.
