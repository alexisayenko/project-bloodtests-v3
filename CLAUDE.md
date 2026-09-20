# CLAUDE.md

Fast-path context for Claude Code. Human-oriented docs live in
[docs/](docs/); each subsystem's detail is one page under
[docs/tech/](docs/tech/README.md) — the pointer list at the end of this file.

## Key principle

> The data is yours, and it says only what the lab actually printed.

A personal, longitudinal medical record, not a diagnostic tool. Two
non-negotiables:

- **The user's data stays under the user's control.** The app owns no
  database: results live in the browser's `localStorage` by default. Three
  things can leave it, each explicit — a deliberately generated share link,
  an opt-in, values-free LOINC name lookup at NLM, and an opt-in cloud copy
  in a private GitHub repo, written by the app's Worker when the user signs
  in (ADR-0026). That Worker is the one server the app owns: a stateless
  proxy that performs Google / Apple sign-in itself and issues a signed
  session cookie (ADR-0027), checks it and an email allowlist, holds a
  repo-scoped token, and stores nothing itself.
- **Nothing shown is invented or silently altered.** A printed value is
  stored and displayed exactly as the lab wrote it; a converted or derived
  number is computed at display time, kept visibly separate (`canonical`,
  chart-only series), and never written back or exported. An index outside
  its validity range renders "–", and every formula and reference range
  carries a cited primary source.

Cut anything that needs an account to work at all, that lets a converted or
normalized number pass as printed, or that computes a clinical figure without
a traceable citation.

## Product

Paneloom is a browser-only blood-test tracker: the user uploads lab-report
JSON (built from PDFs via a chatbot prompt, or by hand) and keeps a
longitudinal, cross-laboratory history. Results are keyed to LOINC so one
analyte reported by different labs in different units and languages collapses
into one series, organized into condition-based Monitoring Panels with cited
computed indices (HOMA-IR, AIP, calculated free T, LDL-C estimates). Audience:
the author and family; a public open-source repo built to extend to anyone.
Monetization: undecided (`docs/business/README.md`).

## Tech stack

- React 19 + TypeScript + Vite; everything in `web/`.
- No database the app owns: reference data is static JSON under
  `web/public/data/`; uploads are parsed client-side into `localStorage`.
- Deployed as a Cloudflare Worker serving static assets at `paneloom.com`
  (`web/wrangler.jsonc`, `web/worker/index.ts`), published by CI on every push to `main`.
- Opt-in cloud sync: identity is Google or Apple sign-in performed by the
  Worker itself (`/auth/*`, `web/worker/auth.ts`, authorization-code flow, a
  signed session cookie, no auth service and no database — ADR-0027; client in
  `web/src/cloud/`); data as per-report JSON files in the private repo
  `alexisayenko/data-storage`, read and written only by the Worker's
  `/api/data` (`web/worker/githubData.ts`), which checks the session cookie
  and an email allowlist and holds the GitHub token. Signing in and out is
  the whole interface.
- Charts: uPlot through the vendored `lab-explore` / `chart-kit`
  (`web/src/vendor/`), route-lazy.
- Vitest, eslint, GitHub Actions, SonarCloud, Lighthouse.

## Repo map

| Path | What |
| --- | --- |
| `web/public/data/*.json`, `web/public/schema/*.schema.json` | reference data and the closed-object schemas that validate it |
| `web/public/schema/bloodtests-3.schema.json` | the interchange envelope, published at `paneloom.com/schema/` |
| `web/src/data/analyteCatalog.ts` | derives every lookup map from `analyses.json` |
| `web/src/data/indexDefs.ts` / `computedIndices.ts` | index definitions / engine |
| `web/src/data/unitNormalization.ts` | the three unit stages; `massMolarSiblings.ts`, `molarMasses.ts` beside it |
| `web/src/data/parseUpload.ts`, `validateDiagnosticReports.ts`, `utils/exportData.ts` | import, validation, export |
| `web/src/data/loincCheck.ts`, `loincNlm.ts`, `fuzzyMatch.ts` | LOINC cross-check; the NLM call is alone in its file |
| `web/src/data/sharedLink.ts`, `sharedMeta.ts`, `backupArchive.ts`, `backupRestore.ts` | share links, backup zip |
| `web/src/data/storage/{resultsStorage,scheduledVisits,medications,viewSettings,sidebarCollapsed}.ts` | every localStorage key with its parse / load / save and pure reducers; no React |
| `web/src/hooks/useScheduled.ts`, `useMedications.ts`, `useViewSettings.ts` | the React hooks over `data/storage/` |
| `web/src/hooks/useHashRoute.ts` | hash routing, blocked-route redirect, grid scroll restore |
| `web/src/hooks/useAllResults.ts` | flattens sessions into `allResults` / `latestByLoinc` / `resultsByDate`, loading a session's items on demand |
| `web/src/components/conditions/PopupContext.tsx`, `SchedulingContext.tsx` | popup and scheduling state shared by `PanelDetailView`, `ResultTables`, `Popup`, `PlanVisitView` |
| `web/src/cloud/`, `web/src/data/reportFiles.ts`, `web/worker/auth.ts`, `web/worker/githubData.ts` | auth and sync client; per-report file split / merge; the Worker's `/auth/*` sign-in and `/api/data` |
| `web/src/components/conditions/MedicalConditionsPage.tsx` | the app shell: route, results, shared settings, popups; every section a `React.lazy` sibling view |
| `web/src/components/conditions/*View.tsx`, `ReferenceBookPage.tsx` | the views (grid, panel detail, all observations, reports, report detail, profile, plan, medications, pathways, lipids, account, reference) |
| `web/src/components/conditions/{markers,routing,resultCells,popupGeometry,scheduling,resultsLookup,statusFilter,reportDetailHelpers,pathwayShared}.ts` | pure helpers and view contracts |
| `web/src/components/primitives/`, `styles/index.css`, `styles/tokens.ts` | UI primitives (`pressable` / `tabStyle` in `styles.ts`, `IconComponent` in `icons.ts`) and design tokens (`docs/ui-ux/style-guide.md`) |
| `web/scripts/` | offline Node scripts: `convert-to-v3`, `recode-molar`, `generate-envelope-types`, `fetch-loinc-names` |
| `web/test/` | Vitest suites |
| `archive/` | retired code, outside the build by construction |
| `docs/` | product concepts, tech pages, ADRs, tasks |

## Invariants

- Printed value and unit are never converted in storage or export; derived
  numbers exist at display time only — ADR-0003.
- Reference data is data: `analyses.json`, panels, labs, pathway JSON are
  the source of truth, never mirrored in TypeScript — ADR-0010.
- Molar masses are data, factors are derived from them — ADR-0011.
- UCUM is the unit vocabulary; a molar unit under a mass code is a code
  error, fixed by the sibling code, not a conversion — ADR-0007, ADR-0003.
- `U` and `IU` fold only where the LOINC property says which one the
  analyte is measured in — ADR-0013.
- The envelope's `schema` is a `"major.minor"` string; any `"3.x"` is read,
  nothing else — ADR-0009, ADR-0012.
- No login stays local; signing in switches storage mode with two cutover
  moments and no ongoing sync, except a debounced push on Database details
  edits — ADR-0018, ADR-0019; the cloud store is a
  private GitHub repo behind the Worker, never a browser-held token —
  ADR-0026; identity is Google / Apple through the Worker's own OAuth, no
  auth service — ADR-0027.
- Artwork illustrates; any geometry read as a quantity is a circle count or
  drawn from cited data — ADR-0022.
- Both pathway pages run on one shared overlay engine; wiring is hand-coded
  until `pathways.json` exists — ADR-0021, ADR-0014.
- Constants come from cited data; calculators are cross-checks, and a
  deviation is documented, not adopted — ADR-0020.
- LOINC is derived from printed name + unit; a printed code is evidence only
  — ADR-0004.
- Each observation's printed name lives in `rawName`; the friendly name is
  derived from the LOINC at display time and never stored — ADR-0009.
- A scheduled visit is one of a list of independent visits — ADR-0016.

Every name the app uses is defined once, in the "Names" glossary of
`docs/product/concepts/observation.md`.

## Dev commands

From `web/`: `npm run dev`, `npm test`, `npm run coverage`, `npm run lint`,
`npm run build` (`tsc -b && vite build`), `npm run deploy` (`wrangler
deploy`), `npm run schema:types` (regenerates `data/envelopeTypes.ts`; a
drift test fails CI on an ungenerated schema edit), `npm run convert:v3`.
Node-based tooling runs through WSL on Windows (see the user-level
`workflow.md`).

## CI and deploy

`.github/workflows/ci.yml`: `test` (lint → tests + coverage → build) and
`sonar` run in parallel with `deploy`, which carries no `needs:` — a push to
`main` is live in about a minute and only `npm run build`'s `tsc -b` can stop
it; a red suite means rolling forward. `lighthouse` needs `deploy` and audits
`paneloom.com` with the desktop preset, gating Accessibility and Best
Practices at 0.9. A CI deploy carries no share-link payloads
(`web/public/d/*.json` is gitignored health data), so every `/?data=<guid>`
link 404s until a manual `wrangler deploy` with the files copied in — see
[share-links-and-deploy.md](docs/tech/share-links-and-deploy.md).

## Quality

Tests live in `web/test/`, run with `npm test`; CI gates on lint, the suite
and the build, and SonarCloud scans every push and PR. Coverage is scoped to
the testable logic (`sonar.coverage.exclusions` skips the React view layer).
What each suite covers, and what is deliberately untested:
[testing.md](docs/tech/testing.md).

## Subsystem pages

- [reference-data.md](docs/tech/reference-data.md) — catalog, panels, molar
  masses, labs, pathway JSON, schemas and their tests
- [molar-masses.md](docs/tech/molar-masses.md) — the molar-mass table and
  citations
- [units.md](docs/tech/units.md) — normalization stages, `sameUnitScale`,
  the U/IU fold, display-time conversion, mass-vs-molar siblings
- [computed-indices.md](docs/tech/computed-indices.md) — inputs, bands,
  LDL-C estimates, the testosterone family
- [lp-ir.md](docs/tech/lp-ir.md) — LP-IR vs the CardioIQ Insulin Resistance
  Score, why LP-IR is imported as reported, never derived locally
- [interchange-format.md](docs/tech/interchange-format.md) — the envelope,
  its schema and round-trip gaps
- [diagnostic-reports.md](docs/tech/diagnostic-reports.md) — chatbot prompt,
  upload, validation tiers, LOINC cross-check, NLM lookup, export
- [navigation-and-shell.md](docs/tech/navigation-and-shell.md) — routes,
  blocking, AppShell / SideNav / NavBar, PageHeader, tokens, archive
- [monitoring-panels.md](docs/tech/monitoring-panels.md) — grid, filters,
  compact view, Panel Detail and its tabs
- [results-tables.md](docs/tech/results-tables.md) — cells and units,
  controls bar, frozen column and mobile reveal, scheduled columns
- [scheduling-and-visits.md](docs/tech/scheduling-and-visits.md) — visits
  storage, cascade, the Scheduled Visits page and lab pricing
- [charts.md](docs/tech/charts.md) — "What's in range" (lab-explore)
- [pathway-pages.md](docs/tech/pathway-pages.md) — Hormonal Pathways, Lipid
  Transport, shared conventions, the dev-only debug tool
- [medications.md](docs/tech/medications.md) — row shape, grid, storage
- [reference-book.md](docs/tech/reference-book.md) — the Reference Book's
  pages
- [account-and-sync.md](docs/tech/account-and-sync.md) — auth card, Worker
  sign-in and GitHub sync, setup, Database details, export / import / clear
- [share-links-and-deploy.md](docs/tech/share-links-and-deploy.md) — Worker,
  CI deploy, Lighthouse, share links and their meta
- [testing.md](docs/tech/testing.md) — suites and CI jobs
- [docs/tech/decisions/README.md](docs/tech/decisions/README.md) — the ADR
  index
- [docs/product/concepts/](docs/product/concepts/) — observation, monitoring
  panel, lab report, computed index, companion observation, pathway, unit
- [docs/tasks/README.md](docs/tasks/README.md) — task index; open pointers
  from the pages above land in their task files

## Repo

[project-bloodtests-v3](https://github.com/alexisayenko/project-bloodtests-v3)
(public). Remote via SSH.
