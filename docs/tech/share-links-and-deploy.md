# Share links and deploy

## Deploy

The app ships as a Cloudflare Worker (`web/wrangler.jsonc`: worker
`paneloom`, `main` `./worker/index.ts`, `assets.directory` `./dist`, custom
domain `paneloom.com`). The Worker script (`web/worker/index.ts`) routes
`/api/data` to the GitHub-backed sync proxy and lets everything else fall
through to `env.ASSETS.fetch()` unchanged. `paneloom.com` is the production
URL; the old `blood.isayenko.net` domain is retired and no longer served.

Deploys run from CI: the `deploy` job in
[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs on every
push to `main`, guarded by `if: github.ref == 'refs/heads/main' &&
github.event_name == 'push'` so pull requests never publish. It carries no
`needs:` and starts at once beside `test` and `sonar`, so a push is live in
about a minute; lint and the tests report *after* the code is serving — a red
suite means rolling forward, not a blocked deploy, and the only check that
can still stop a publish is `npm run build`'s own `tsc -b`. The job runs its
own `npm ci` and `npm run build` (passing `GITHUB_SHA` and `BUILD_TIME` for the
footer's build stamp), then `cloudflare/wrangler-action@v3` with
`workingDirectory: web` and `command: deploy` — the same `wrangler deploy`
that `npm run deploy` runs locally — authenticated by the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repository secrets, with
`permissions: contents: read` and a `deploy-production` concurrency group so
two pushes cannot overtake each other. A manual `wrangler deploy` from `web/`
still works and is still needed for share links (below).

The Worker also serves `/api/data`, the cloud-sync proxy to a private GitHub
repo ([`account-and-sync.md`](account-and-sync.md#the-worker), ADR-0026). It
needs two secrets, `GITHUB_TOKEN` and `SUPABASE_JWT_SECRET` (set once with
`wrangler secret put <NAME>` from `web/`; a deploy keeps them), and two vars in
`wrangler.jsonc`, `GITHUB_REPO` and `ALLOWED_EMAILS` — see
[Setup](account-and-sync.md#setup). Unset `ALLOWED_EMAILS` denies everyone.

A `lighthouse` job `needs: deploy` so it audits the code that is actually
live, targeting `paneloom.com` directly since there is no staging
environment, with Lighthouse's `desktop` preset (`.lighthouserc.json`'s
`collect.settings.preset`) since the UI investment is desktop-first
([task-0020](../tasks/task-0020.md) owns the phone shell).
`treosh/lighthouse-ci-action` uploads to temporary public storage and, via
`configPath` pointing at repo-root `.lighthouserc.json` (which also holds the
audited URL, run count and preset), gates Accessibility and Best Practices
(`minScore: 0.9` each) so a regression fails the job; Performance and SEO are
report-only. The rest of CI is in [`testing.md`](testing.md).

The footer (`components/Footer.tsx`) stamps whichever build you are looking
at: `vite.config.ts` injects the commit hash and a build timestamp,
`buildInfo.ts` falls back to the local commit outside CI so the stamp is
never empty, and the hash links to its commit on GitHub.

Every nav route is a `React.lazy` import in `MedicalConditionsPage.tsx`, and
Account's backup loads `fflate` on click, so the entry chunk carries the shell
and the statically imported catalog; the catalog is bundled rather than
fetched so it cannot arrive late.

## Share links

A read-only share link, `/?data=<guid>`, fetches `/d/<guid>.data.json`
(`web/src/data/sharedLink.ts`) and imports it through the same parse path as
an upload, replacing all stored sessions, then strips the param. In parallel
it fetches an optional `/d/<guid>.meta.json` per-link presentation config
(`sharedMeta.ts`): `showPanels`, an allowlist of panel names limiting the
Monitoring Panels grid, and with it All Observations' panel options and the
indices they scope, though its observation rows always show everything; and
`settings`, which seeds the shared table controls (`unitSystem`,
`sampleLimit`) only when the visitor has none stored yet — an unrecognized
field such as an older link's `dateOrder` is dropped in `parseSettings`. A
missing, 404 or malformed meta simply means "no meta" and never fails the
import.

A stored meta never outlives the link it came from: `applySharedMeta` clears
before it stores, and Clear and every replacing import (`uploadFile`, behind
both "Import JSON" buttons) call `clearSharedMeta`, so a link without meta
inherits no allowlist and a stale `showPanels` cannot go on hiding panels
after the data it belonged to is gone; merges leave it alone. A meta stored
before that behavior existed is not migrated: it survives until the visitor
clears or replaces their data.

The payloads are real health data and are gitignored (`web/public/d/*.json`)
because this repo is public. `web/public/_headers` serves `/d/*` as
`noindex` / `private`, and `robots.txt` disallows `/d/`.

### An automated deploy publishes no share links

**Every existing `/?data=<guid>` link returns 404 after a CI deploy.** A CI
runner checks out the repo and finds nothing in `web/public/d/`, so the asset
manifest it uploads has no `/d/` directory. The deploy does not fail —
`assets.directory` points at `./dist`, which the build always produces, an
absent `public/` subdirectory is nothing for Vite to copy, and the `/d/*`
header rule matching no file is inert — the links just stop resolving.
Re-publishing them means running `wrangler deploy` from `web/` by hand with
the files copied in, which the next push to `main` undoes again. Accepted for
now; the intended fix is serving `/d/` from R2 so the build carries no health
data at all. The workflow says this twice: a comment block above the `deploy`
job and a step emitting a GitHub Actions warning annotation on every run.
