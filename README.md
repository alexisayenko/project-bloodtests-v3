# project-bloodtests-v3

LOINC-coded blood-test monitoring app. Three-step workflow: generate lab-results JSON from a chatbot → upload and edit locally → export. Visualized client-side, grouped into monitoring panels (conditions/organ systems).

## Overview

React 19 + TypeScript + Vite app in `web/`, with no database of its own (the Worker's `/auth/*` routes sign you in with Google or Apple, and `/api/data` proxies opt-in cloud sync to a private GitHub repo). Static JSON reference data (`web/public/data/`), uploaded results parsed client-side and kept in `localStorage`. Deploys as a Cloudflare Worker to `paneloom.com`, its production URL. Data stays local by default — it leaves your device only through optional share links, the explicit-opt-in "Check online (NLM)" LOINC lookup (test names, never values, to clinicaltables.nlm.nih.gov), and opt-in cloud sync to a private GitHub repo, through the app's Worker, when you sign in with Google or Apple (the Worker does the sign-in itself; there is no separate auth service).

**Workflow:**

1. **Build JSON:** Generate v3-format lab data (chatbot or manual).
2. **Upload & Edit:** Import into app; validate; refine in Diagnostic Reports view.
3. **Export:** Download the stored per-report files as a zip, byte for byte as imported (verbatim, [ADR-0028](docs/tech/decisions/adr-0028-verbatim-import-export.md)).

See [`CLAUDE.md`](CLAUDE.md) for the fast-path summary, [`docs/tech/diagnostic-reports.md`](docs/tech/diagnostic-reports.md) for the workflow's implementation, and [`docs/tech/README.md`](docs/tech/README.md) for the other subsystem pages.

## Structure

### Top-level layout

Folders sort first (alphabetically), then files — VS Code
default.

```text
project-bloodtests-v3/
├── .github/                              # CI workflow (ci.yml) + Dependabot config
├── archive/                              # obsolete code + docs (single graveyard)
├── docs/                                 # project-level strategy + documentation
├── web/                                  # the app: src/, public/ (data, schema), test/, scripts/, wrangler.jsonc
├── CLAUDE.md                             # agent-specific guidance
├── LICENSE                               # license
├── README.md                             # this file — entry point + structure
└── sonar-project.properties              # SonarCloud scan config
```

No root `scripts/` or shared-infra folder exists yet: the Node scripts
(`convert-to-v3.mjs`, `recode-molar.mjs`, `generate-envelope-types.mjs`,
`fetch-loinc-names.mjs`) touch `web/` only, so they live in `web/scripts/`.

**Don't pre-create empty folders.** Add a folder on the day a
second code folder, archived artifact, or per-folder doc
actually lands — not before. See
[`docs/README.md#section-file-folder`](docs/README.md#section-file-folder)
for the same rule applied inside `docs/`.

### Naming

| Convention | Example | Why |
| --- | --- | --- |
| `kebab-case.md` for documents | `branding.md`, `task-0001.md` | Reads as prose; case-safe across OSes |
| Lowercase folders | `docs/`, `scripts/`, `archive/` | Matches URL paths; case-safe |
| `UPPERCASE.md` only for conventionally recognized files | `README.md`, `CLAUDE.md`, `LICENSE`, `CHANGELOG.md` | Don't invent new uppercase files |

Code folders use their natural name (`mobile/`, `web/`,
`workers/`); see [Overview](#overview).

### Infra at root

Folders sit unprefixed at the root when they apply across the
project:

- **`docs/`** — strategy, product, business, brand
- **`scripts/`** — cross-cutting build tooling (e.g. release-note
  fan-out from `docs/` to multiple code folders)
- **`<shared-infra>/`** — shared backend / infrastructure used
  by multiple code folders (e.g. `supabase/`, `prisma/`,
  `infra/`)

If a script or config touches one code folder only, it lives
with that folder, not at root.

### Ad-hoc root files

Some root files are created on demand, not scaffolded:

- `HANDOVER.md` — open work deferred between sessions. Create
  when you have items to defer; delete when they're all resolved.
  Not a living doc.

### Archive

Single root `archive/` folder for obsolete code. A folder belongs in
`archive/` when it **no longer ships**; before archiving code, extract any
worthwhile lessons or decisions into an ADR or task — code in archive rots;
docs survive.

It holds `archive/src/components/` — the pre-nav upload / panels /
results flow — outside `web/`, so it is outside the build, lint and
coverage by construction.

## Key implementation details

- **Upload:** v3 envelope JSON (major version 3 only — `schema` is the `"major.minor"` string, currently `"3.2"`, and any `"3.x"` is accepted, plus the legacy bare number `3` read as 3.0; see [ADR-0012](docs/tech/decisions/adr-0012-envelope-version-is-a-major-minor-string.md)) with a DiagnosticReport array, each observation's printed test name in `rawName`. Nothing else is accepted — `schema: 1`, v2 canonical-draws and two legacy array shapes were dropped in [ADR-0009](docs/tech/decisions/adr-0009-v3-only-and-rawname.md); older files are converted once with `npm run convert:v3`. Parser in `web/src/data/parseUpload.ts`.
- **Export:** the stored files, verbatim — one `reports/YYYY-MM-DD__<lab>.json` per report, plus medications, scheduled visits, settings and a manifest, exactly as imported or pulled; nothing is recalculated or rebuilt. A file the app itself creates or edits carries `lastUpdatedDate`; `generatedAt` is deprecated and no longer written. See [`docs/tech/interchange-format.md`](docs/tech/interchange-format.md).
- **Schema:** the envelope's machine-readable form is published at [`paneloom.com/schema/bloodtests-3.schema.json`](https://paneloom.com/schema/bloodtests-3.schema.json) (JSON Schema draft 2020-12, source `web/public/schema/`). It describes major version 3 only — every minor within it — and so does the upload parser.
- **Validation:** Two tiers — errors (missing name or value, or a non-LOINC-shaped code) disable Monitoring Panels, Hormonal Pathways, Lipid Transport and All Observations (redirecting to Diagnostic Reports) until fixed; warnings (empty LOINC, missing unit or reference range, a unit whose dimension contradicts the code, a unit that maps to no UCUM code) are informational. The unit checks read the stored `unit` when a file has one, else the printed unit, so an MCHC printed `%` with `unit: g/dL` raises no warning ([ADR-0025](docs/tech/decisions/adr-0025-mchc-percent-is-not-an-accepted-unit.md)). See [`docs/tech/diagnostic-reports.md`](docs/tech/diagnostic-reports.md).
- **LOINC:** All matching/joins use LOINC only; names are provenance. A missing code is a warning (the observation just won't appear in panels), fixable by inline edit in the Diagnostic Report detail view; a "Cross-check LOINCs" pass verifies codes against the local catalog, suggests codes for codeless rows, and can optionally query the NLM online for the rest.
- **Terminology:** Names borrowed from FHIR (DiagnosticReport, Observation) for alignment but data model is simplified; see [ADR-0002](docs/tech/decisions/adr-0002-borrow-fhir-shapes-not-fhir.md) and [ADR-0008](docs/tech/decisions/adr-0008-fhir-shaped-envelope-not-fhir.md).
- **Decisions:** every architectural call is an ADR — the index is [`docs/tech/decisions/README.md`](docs/tech/decisions/README.md).

## Documentation

See [`docs/README.md`](docs/README.md) for:

- Why this folder is called `docs/` and not `specs/`
- Product overview
- Guiding principle: strategy at root vs per-folder
- Top-level glossary + the four-level chain (concept → feature →
  screen → journey)
- Concerns (`C1, C2, …`) — cross-cutting work axes that span
  sections; catalogued in [`docs/concerns.md`](docs/concerns.md)
- Entry-doc convention (`<section>/README.md` pattern)
- The `docs/` subtree map and what lives where
- The `Section, file, folder` rule (start small, extract on growth)

## Design rationale

Why this template is shaped the way it is. It's *more
structured* than industry default for solo-founder projects, but
every choice is a defensible divergence rather than an
anti-pattern.

**Aligned with established best practices:** README.md as folder
entry doc (GitHub auto-renders), kebab-case.md filenames
(case-safe), conventional commits, YAML frontmatter on docs
(Jekyll / Hugo / MkDocs convention), ADRs (Michael Nygard's
spec), glossary-driven vocabulary discipline (Eric Evans' DDD
ubiquitous language), separating product specs from
implementation (clean architecture), atomic commits referencing
tasks.

**Defensible divergences from common defaults:** tasks as
markdown files (instead of Jira / Linear / GitHub Issues —
portable, greppable, git-tracked, AI-readable; cost: harder to
query at scale); the verb / noun split between concepts and
features (this is DDD, rigorously applied); heavy doc
scaffolding upfront (closer to the "docs as first-class
artifact" school — Stripe, Diataxis — than to agile's "defer
docs" tradition).

**Original framings:** `concept = noun`, `feature = verb`,
`screen = place` as a strict three-way taxonomy (DDD-flavored
but specific); concerns axis (`C1, C2, …` — industry
equivalents are epics, OKRs, work-streams); each top-level code
folder named for what it is rather than fitting under a
unifying noun.

Bottom line: nothing here is anti-pattern. Heavyweight for
throwaway experiments; benefit is that a project stays
organized as it grows without needing a mid-life restructure.
