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
reference-band overrides, or data-quality flagging). Panel Detail also
carries a "Charts" tab (`PanelChartsView`): the panel's markers as a 3D
stacked-ribbon chart, one marker per depth plane, each normalized to
its own observed min/max so mixed units share one chart; alias LOINCs
merge into one series per test (canonical code = the test's `loinc`),
a checkbox picker selects up to 8 markers with stable per-marker
colors, plus a translucent/opaque toggle, a time-window selector (All
time / 1 week / 1 month / 1 year, anchored to the latest date; ‹›
pans by a day or by a window width, clamped to the data extent;
out-of-window points are dropped before per-series normalization, as
in the mood tracker), drag to rotate, wheel/pinch to zoom,
double-click to reset; the time axis stretches to the page width (the
room's x half-extent is fitted per draw so the projected room spans
~90% of the canvas; height fixed at 420px). The engine
(`web/src/components/analytics/chart3d-stacked-core.ts`,
`chart3d-camera.ts`) is ported from project-moodtracker's
`chart3d-stacked.js`/`chart3d-camera.js`, generalized from 8 fixed
slots to N series; `StackedBiomarkerChart3D.tsx` mounts it and
`StackedBiomarkerSection.tsx` owns selection and the picker. The
legacy, unwired `AnalyticsPage` reuses the same section behind a List /
Compare-in-3D toggle (`BiomarkerCharts.tsx`). Panel Detail's Analysis
tab (the default: Observations and Indices tables) adds a "Scheduled"
column, set apart at the right of both tables — a single-click toggle
per row (`role=checkbox`, ✓ in primary blue); scheduling an index also
schedules its input observations, unscheduling it leaves them, and
toggling an observation re-derives every index (scheduled iff all its
inputs are); global state in localStorage `bloodtests_scheduled_v1`
(`{loincs, indices}`), logic in `scheduled.ts`. Selecting an index
row there marks each input observation with a blue • in a fixed 10px
gutter left of its name, and selecting an observation marks each index
that uses it; the gutter is reserved on every row so names never shift
(All Observations indents names by the same 13px, no marks there).
Persistent top nav
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
LOINC / value / unit, saved to localStorage via `updateGroup`, and
carries a "Cross-check LOINCs" button (`loincCheck.ts`): an offline
resolver derives each row's LOINC from printed name + unit (ADR-0004;
Latin-name pass, then catalog `lang` translations, unit hard-selecting
among unit variants; per-code allowed-unit sets (`ALLOWED_UNITS`)
drive the validation unit warning — it fires only when a unit is
outside the code's accepted set, listing that set — and alias-group
members collapse into one suggestion, the kept code picked by the
row's unit) and treats a printed code as evidence only — ✓
derivation agrees / ⚠ confident derivation contradicts it (warning
names both codes; unit-labeled suggestion chips, plus an "Apply
suggestions" button applying every confident fix through the edit
draft) / ✗ unknown with no derivation — shows the official LOINC name
in grey under the printed name (printed name kept as provenance;
resolved names are session-only, never stored); a second-stage "Check
online (NLM)" button,
offered only for rows the offline pass couldn't resolve, sends test
names — never values — to clinicaltables.nlm.nih.gov, the single
explicit-opt-in exception to the everything-stays-local rule), All
Observations (every uploaded result in one table), Monitoring Panels
(the default/entry route), Reference Book (Indices Descriptions: a page
per computed index with formula, v2's full clinical prose and cited
sources with verbatim quotes; Physiology: HP Axis page with v2's
homepage-derived feedback-loop cascades) — each its own URL hash so
browser back/forward works. Validation
(`validateDiagnosticReports.ts`) marks an observation missing its name
or value-or-rawValue, or carrying a non-empty code that isn't
LOINC-shaped (`^\d{1,7}-\d$` — catches lab-internal codes like
"900101"), as an error; an empty LOINC (the observation won't appear in
panels or All Observations), a missing unit, and a missing reference
range are warnings; while errors exist, Monitoring Panels and All
Observations are disabled in the nav and their routes redirect to
`#reports` (Get Started and Reference Book stay reachable). Upload
accepts the v3 interchange envelope and nothing else
(`{ schema: 3, diagnosticReports }` — `SCHEMA_VERSION` in
`data/envelopeSchema.ts`; the earlier `schema: 1`, v2's
canonical-draws and the two legacy shapes were all dropped in
ADR-0009, and old files go through `npm run convert:v3`
(`scripts/convert-to-v3.mjs`), which keeps every legacy branch;
other envelope fields ignored for now, though a report's `identifiers`
(visit/order/accession) feeds the session id so two same-day same-lab
draws don't collide on merge). Each observation's printed test name
lives in `rawName`, never `name` — the canonical name is derived from
the LOINC code at display time and deliberately never stored. Export (`exportData.ts`) writes a v3 envelope —
`schema`, `generatedAt`, `contentHash` (sha256 of the diagnosticReports
array only), subject/sex/birthYear/notes when set, and
reduced reports — as `blood-tests-export-<yyyymmdd>.json`; see
`docs/tech/interchange-format.md` for exactly which envelope fields are
implemented, and `web/public/schema/bloodtests-3.schema.json` (served at
`blood.isayenko.net/schema/`, draft 2020-12, objects open, version-3 only —
as is the parser, since ADR-0009) for the machine-readable form; the envelope's
TypeScript types are generated from that schema by `npm run schema:types`
(`scripts/generate-envelope-types.mjs` → `data/envelopeTypes.ts`), with a
drift test failing CI on an ungenerated schema edit. Unit normalization is
built but not yet wired into any view: `data/unitNormalization.ts` runs three
pure stages — printed unit (Cyrillic and Ukrainian unit tables, superscripts,
micro-sign and multiplication-sign folding) to a canonical Latin spelling,
Latin to a UCUM code, then a LOINC-versus-unit dimension check — plus
`convertValue` / `canonicalUnitFor` and a `normalizeObservationUnit`
orchestrator returning all three stages in one reviewable result. The printed
value and unit stay authoritative; a canonical form is derived per call and
never stored, and an unrecognized unit returns undefined rather than a guess.
A molar unit under a mass-concentration code is treated as a *code* error, so
the check suggests the analyte's `[Moles/volume]` sibling from the 20 curated
pairs in `data/massMolarSiblings.ts` (each with the mass/molar factor as data
only) instead of converting the number (ADR-0003; UCUM as the target
vocabulary is ADR-0007). Those molar codes were added to the analyte catalog
(`web/public/data/analyses.json`, 124 → 139 entries) and registered in
`ALSO_REFS` / `ALIAS_TO_PRIMARY` (`markers.ts`) against their mass primary, so
a molar code folds into the same panel row, badge and chart series as the mass
one with no changes to panels, tables or charts. Two Ajv-validated offline
Node scripts sit beside the app: `npm run convert:v3`
(`scripts/convert-to-v3.mjs`, above) and `node scripts/recode-molar.mjs <file>`
— no npm alias — which rewrites only the `loinc` of an observation whose mass
code carries a molar unit, leaving value, unit and reference ranges exactly as
printed. The original
upload/panels/results/analytics flow still exists in
`web/src/components/` but isn't currently wired into `App.tsx` (and is
excluded from eslint, Sonar, and coverage until it returns or moves to
`archive/`).

## Quality

Vitest suites in `web/test/` (352 tests across 18 files, 1 skipped: index
golden-masters ported from v2, upload parsing — the v3 envelope, and
every non-v3 shape rejected — and import-replace, diagnostic-report validation, LOINC
cross-check, unit normalization (Latin/UCUM stages, dimension check,
conversion), export
envelope, published JSON Schema conformance and generated-type drift (ajv and
json-schema-to-typescript, devDependencies only —
nothing schema-related is bundled), share-link and shared-meta,
explore-model, markers, routing,
scheduling, ui helpers, format utils). CI
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
  panel, lab report, computed index, companion observation (planned),
  unit (derivation built, not wired into any view)
- [docs/tech/decisions/](docs/tech/decisions/README.md) — ADR index
  (nine records; ADR-0005–0008 recorded 2026-09-07)
- [docs/tech/interchange-format.md](docs/tech/interchange-format.md) —
  envelope spec, and its published JSON Schema
