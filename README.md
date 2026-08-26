# project-bloodtests-v3

LOINC-coded blood-test monitoring app. Upload a lab-results JSON
export; it's visualized client-side, grouped into monitoring panels
(conditions/organ systems).

## Overview

React 19 + TypeScript + Vite app in `web/`, no backend. Static JSON
reference data (`web/public/data/`), uploaded results parsed
client-side and kept in `localStorage`. Deploys as a Cloudflare
Worker to `blood.isayenko.net`. See [`CLAUDE.md`](CLAUDE.md) for the
fast-path summary.

## Structure

### Top-level layout

Folders sort first (alphabetically), then files — VS Code
default.

```text
project-root/
├── archive/                              # obsolete code + docs (single graveyard)
├── docs/                                 # project-level strategy + documentation
├── scripts/                              # cross-cutting build tooling
├── mobile/                               # mobile app (example name)
├── web/                                  # web app or static site (example name)
├── <shared-infra>/                       # e.g. supabase/, prisma/, infra/
├── CLAUDE.md                             # agent-specific guidance (optional)
├── README.md                             # this file — entry point + structure
└── LICENSE                               # license
```

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

Single root `archive/` folder for obsolete code and docs. A
`docs/` subfolder inside holds obsolete documentation.

```text
archive/
├── docs/                       # obsolete project-level docs
│   └── <old-doc>.md
└── <old-folder>/               # obsolete code (e.g. v1 prototype)
```

A folder belongs in `archive/` when it **no longer ships**.
Before archiving code, extract any worthwhile lessons or
decisions into `archive/docs/` — code in archive rots; docs
survive.

`archive/` doesn't exist by default. Create on first retirement.

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
- Per-folder `<folder>/docs/` policy
- Multi-product split (rare)

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
