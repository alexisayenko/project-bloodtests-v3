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
results are parsed client-side and kept in `localStorage`. Deploys as
a Cloudflare Worker (static assets) to `blood.isayenko.net` via
`web/wrangler.jsonc`; deploy is manual (`wrangler deploy`), not CI-triggered.
The app shell is `web/src/components/conditions/MedicalConditionsPage.tsx`
(route + results + shared settings + popup state); each section renders
its own sibling view component (`PanelsGridView` / `PanelDetailView` /
`AllObservationsView` / `ProfileView` / `ReferenceBookPage`, plus shared
`NavBar` / `ControlsBar` / `ResultTables` / `Popup`), with pure helpers
in `markers.ts` / `routing.ts` / `ui.ts` / `resultsLookup.ts` and
`data/generateTestData.ts`. Monitoring Panels grid cards list each
panel's observations and, below a divider, its computed indices
(`INDEX_DEFS`), both dot-colored by status; Panel Detail has a back
chevron (‹) before its title, back to the grid. Panel Detail and All
Observations each carry a "What's in range" tab — a normalized-overlay
time chart (every marker, and on Panel Detail also each panel's
computed indices, plotted as % of its own reference range or ok-zone
band on one shared axis, with a panel picker, zoom, autoscale, and a
"not taken" section) — built from v2's
`<lab-explore>` web component, vendored as-is into
`web/src/vendor/lab-explore/` and `web/src/vendor/chart-kit/` (its
domain-agnostic uPlot-based charting engine) and driven by the
`buildExploreModel` adapter in `exploreModel.ts`, mounted via
`LabExploreView.tsx`; deliberately generic-only (no medication overlays,
reference-band overrides, or data-quality flagging). Persistent top nav
across four sections — Profile (upload JSON /
generate synthetic test data / clear; sessions merge, keyed by session
id), Monitoring Panels (the default/entry route), All Observations
(every uploaded result in one table), Reference Book (Indices
Descriptions: a page per computed index with formula, v2's full clinical
prose and cited sources with verbatim quotes; Physiology: HP Axis page
with v2's homepage-derived feedback-loop cascades) — each its own
URL hash so browser back/forward works. The original
upload/panels/results/analytics flow still exists in
`web/src/components/` but isn't currently wired into `App.tsx` (and is
excluded from eslint, Sonar, and coverage until it returns or moves to
`archive/`).

## Quality

Vitest suites in `web/test/` (91 tests: index golden-masters ported
from v2, upload parsing, routing, ui helpers, format utils). CI
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
