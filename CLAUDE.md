# CLAUDE.md

Fast-path context for Claude Code. Full human-oriented docs:
[docs/](docs/).

## Key principle

> [TODO: one-line principle that governs every product decision]

[TODO: one paragraph elaborating how this principle applies — what
decisions are weighed against it, what gets cut when it doesn't
reinforce the principle.]

## Product

[TODO: one paragraph — what it is, who uses it, mechanic,
monetization.]

## Tech stack

React 19 + TypeScript + Vite, in `web/`. No backend — panel/analyte
reference data ships as static JSON (`web/public/data/`), uploaded lab
results are parsed client-side and kept in `localStorage`. A read-only
share link, `/?data=<guid>`, fetches `/d/<guid>.data.json` and imports it
through the same parse path as an upload, then strips the param; in
parallel it fetches an optional `/d/<guid>.meta.json` per-link
presentation config (`showPanels` — an allowlist of panel display names
limiting the Monitoring Panels grid, All Observations always showing
everything — plus `settings`, which seeds the shared table controls only
when the visitor has none stored yet), where a missing, 404 or malformed
meta simply means "no meta" and never fails the import; the
payloads are real health data and are gitignored (`web/public/d/*.json`)
because this repo is public, so a deploy needs them copied in locally
first. `web/public/_headers` serves `/d/*` as
`noindex`/`private`, and `robots.txt` disallows `/d/`. Deploys as
a Cloudflare Worker (static assets) to `blood.isayenko.net` via
`web/wrangler.jsonc`; deploy is manual (`wrangler deploy`), not CI-triggered.
The app shell is `web/src/components/conditions/MedicalConditionsPage.tsx`
(route + results + shared settings + popup state); each section renders
its own sibling view component (`PanelsGridView` / `PanelDetailView` /
`AllObservationsView` / `DiagnosticReportsView` /
`DiagnosticReportDetailView` / `ProfileView` / `ReferenceBookPage`, plus shared
`NavBar` / `ControlsBar` / `ResultTables` / `Popup`), with pure helpers
in `markers.ts` / `routing.ts` / `ui.ts` / `resultsLookup.ts` and
`data/generateTestData.ts`. Monitoring Panels grid cards list each
panel's observations and, below a divider, its computed indices
(`INDEX_DEFS`), both dot-colored by status; Panel Detail has a back
chevron (‹) before its title, back to the grid. Panel Detail and All
Observations each carry a "What's in range" tab — a normalized-overlay
time chart (every marker, and every panel's
computed indices, plotted as % of its own reference range or ok-zone
band on one shared axis, with a panel picker (a marker or index shared
across panels groups under every relevant one), zoom, autoscale, and a
"not taken" section) — built from v2's
`<lab-explore>` web component, vendored as-is into
`web/src/vendor/lab-explore/` and `web/src/vendor/chart-kit/` (its
domain-agnostic uPlot-based charting engine) and driven by the
`buildExploreModel` adapter in `exploreModel.ts`, mounted via
`LabExploreView.tsx`; deliberately generic-only (no medication overlays,
reference-band overrides, or data-quality flagging). Persistent top nav
across five sections — Get Started (`#profile`: app description,
data-privacy statement and evidence-grading note, "Import JSON"
(replaces all stored sessions, as a share-link import does), a "Go to
Diagnostic Reports" pill for building a first database, and generate
synthetic test data (merges)), Diagnostic Reports (`#reports`: the
data-management hub — a collapsible "Database details" card editing
export-envelope metadata (read-only `generatedAt` stamped on each
export, plus subject / sex / birth year / notes; persisted under
localStorage key `bloodtests_envelope_meta_v1`, written into the export
envelope with empty fields omitted), the reports table with
error/warning dots, an "Add a report" card (1. copy the expandable
chatbot prompt, 2. paste into a chatbot, 3. "Add" the chatbot-built
JSON — merges by session id, with "Adding…" progress and "✓ Added N
reports" feedback), and a "Back up your database" card (Export JSON /
Import JSON (replaces) / Clear behind a divider);
`#reports/<file>` detail allows inline editing of each observation's
LOINC / value / unit, saved to localStorage via `updateGroup`), All
Observations (every uploaded result in one table), Monitoring Panels
(the default/entry route), Reference Book (Indices Descriptions: a page
per computed index with formula, v2's full clinical prose and cited
sources with verbatim quotes; Physiology: HP Axis page with v2's
homepage-derived feedback-loop cascades) — each its own URL hash so
browser back/forward works. Validation
(`validateDiagnosticReports.ts`) marks an observation missing LOINC,
name, value-or-rawValue, or unit as an error and a missing reference
range as a warning; while errors exist, Monitoring Panels and All
Observations are disabled in the nav and their routes redirect to
`#reports` (Get Started and Reference Book stay reachable). Upload
accepts the v3 interchange envelope (`{ schema: 1, diagnosticReports }`;
other envelope fields ignored for now, though a report's `identifiers`
(visit/order/accession) feeds the session id so two same-day same-lab
draws don't collide on merge) plus v2's canonical-draws and two
legacy shapes; export (`exportData.ts`) writes a v3 envelope —
`schema`, `generatedAt`, `contentHash` (sha256 of the diagnosticReports
array only), subject/sex/birthYear/notes when set, and
reduced reports — as `blood-tests-export-<yyyymmdd>.json`; see
`docs/tech/interchange-format.md` for exactly which envelope fields are
implemented. The original
upload/panels/results/analytics flow still exists in
`web/src/components/` but isn't currently wired into `App.tsx` (and is
excluded from eslint, Sonar, and coverage until it returns or moves to
`archive/`).

## Quality

Vitest suites in `web/test/` (216 tests across 13 files, 1 skipped: index
golden-masters ported from v2, upload parsing — v3 envelope and v2
shapes — and import-replace, diagnostic-report validation, export
envelope, share-link and shared-meta, explore-model, markers, routing,
ui helpers, format utils). CI
(`.github/workflows/ci.yml`) runs lint → tests+coverage → build and a
SonarCloud scan (CI-based, `SONAR_TOKEN` secret; Automatic Analysis is
off). Coverage metric is scoped to the testable logic —
`sonar.coverage.exclusions` skips the React view layer. Dependabot:
weekly npm (minor+patch grouped) and github-actions bumps.

## Repo

[project-bloodtests-v3](https://github.com/alexisayenko/project-bloodtests-v3)
(public). Remote via SSH (`git@github.com:...`).

## Where to look for more

- [README.md](README.md) — repo entry point + structure
- [docs/README.md](docs/README.md) — docs subtree map
- [docs/product/concepts/](docs/product/concepts/) — observation, monitoring
  panel, lab report, computed index
