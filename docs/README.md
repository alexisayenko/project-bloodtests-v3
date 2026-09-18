# docs/

Project-level strategy and documentation.

For top-level repo layout, file naming, and the archive
convention, see [`../README.md#structure`](../README.md#structure).

## Why `docs/` (not `specs/`)

Industry default. GitHub, doc generators (MkDocs, Docusaurus,
mdBook, Jekyll, Hugo), language ecosystems, and IDE / agent
tooling all look in `docs/` first. "Specs" is also narrower in
meaning — specification documents only — while this folder holds
strategy, business decisions, brand notes, content corpora,
milestones, and tasks alongside the actual specs. "Docs" covers
all of that without prejudging the flavor.

## Product overview

This template assumes **one product, delivered through one or
more top-level code folders** (`mobile/`, `web/`, `workers/`,
`marketing-site/`, etc.). Name each folder by what it is.

- project-bloodtests-v3 — LOINC-coded blood-test monitoring app;
  uploads a lab-results JSON export, visualizes it client-side.

## Guiding principle

> **Strategy, UX and implementation docs all live in root `docs/`.**

Implementation detail belongs in [`tech/`](tech/README.md), one page per
subsystem; `web/` carries no docs of its own.

## Glossary

Top-level vocabulary used across the tree. Section-local
vocabulary (what a feature spec is, what a screen spec is) lives
in each section's entry doc.

The product is decomposed along a four-level chain — each level
composes the next:

| Level | Kind | Home |
| --- | --- | --- |
| **Concept** | noun (a thing the product reasons about) | [`product/concepts/`](product/concepts/) |
| **Feature** | verb (what the user can do) | [`product/features/`](product/features/) |
| **Screen** | place (where the user is) | [`ui-ux/screens/`](ui-ux/screens/) |
| **Journey** | sequence (path across screens) | [`ui-ux/journeys.md`](ui-ux/journeys.md) |

A feature acts on concepts. A screen hosts features. A journey
threads screens. Detailed definitions live in each section's
entry doc; this table is the index.

Other cross-tree terms:

- **Section** — a top-level area of the docs tree
  (`brand/`, `business/`, `product/`, `tech/`, `ui-ux/`, …). One
  folder per section, anchored by its entry doc.
- **Entry doc** — the `<section>/README.md` that frames the
  section and carries its section-local glossary.
- **Concern** — a cross-cutting work axis (`C1`, `C2`, …) that
  spans multiple sections. Catalogued in
  [`concerns.md`](concerns.md), referenced by task frontmatter.
- **Constraint** — a self-imposed limit ("we won't do X, even
  though we could"). Lives in the section it constrains.
- **Compliance** — an externally-imposed obligation (license,
  regulation, platform policy). Lives in
  [`business/compliance.md`](business/compliance.md). Distinct
  from constraint by where the rule comes from.

## Synonyms to avoid

Project-wide word-choice rules. Nudges consistency. Extend as
domain-specific terms emerge. If the list grows past ~10
entries, extract to a flat file per the
[Section, file, folder](#section-file-folder) rule.

- **feature**, not "functionality".
- **screen**, not "surface" / "page" / "view".
- **journey**, not "flow" / "user flow".
- **concept**, not "domain object" / "entity" / "model".

## Entry docs

Each `docs/` section with its own pattern uses
`<section>/README.md` as its entry doc — defining what goes
there, the rule for adding a file, and section-local glossary.
Why `README.md` (vs section-named files like `tech/tech.md`):

- Renders at the folder URL on GitHub —
  `github.com/<owner>/<repo>/tree/main/docs/tech/` auto-shows
  the README.
- Universal lookup — IDE / CLI / agents all treat README as the
  default entry.
- Consistent with the repo root and `docs/` READMEs — one
  convention, no "which file is the entry?" ambiguity.

Scaffolded entry docs (the meta layer that defines vocabulary
and rules):

- [`brand/README.md`](brand/README.md) — brand identity
  vocabulary
- [`business/README.md`](business/README.md) — audience, scope,
  monetization, non-goals
- [`business/compliance.md`](business/compliance.md) —
  externally-imposed obligations
- [`business/budget.md`](business/budget.md) — out-of-pocket
  project costs (one-time + recurring)
- [`content/README.md`](content/README.md) — source material
  layout
- [`product/README.md`](product/README.md) — product core idea
  and glossary (Concept / Feature / Screen / Journey / Constraint)
- [`product/concepts/README.md`](product/concepts/README.md) —
  noun pattern
- [`product/features/README.md`](product/features/README.md) —
  verb pattern
- [`milestones.md`](milestones.md) — dated project events
  (extracts to `milestones/` when entries accrue)
- [`tasks/README.md`](tasks/README.md) — task spec + frontmatter
- [`tech/README.md`](tech/README.md) — stack + decisions frame
- [`tech/decisions/README.md`](tech/decisions/README.md) — ADR
  index + record convention
- [`ui-ux/README.md`](ui-ux/README.md) — screen + journey spec,
  section glossary
- [`ui-ux/style-guide.md`](ui-ux/style-guide.md) — visual +
  interaction standards (external refs + in-project conventions)
- [`ui-ux/performance-guide.md`](ui-ux/performance-guide.md) —
  end-to-end UX performance standards
- [`ui-ux/screens/README.md`](ui-ux/screens/README.md) — one file
  per screen (folder pre-scaffolded; multiple screens guaranteed)
- [`ui-ux/journeys.md`](ui-ux/journeys.md) — multi-screen paths
  (extracts to `journeys/` when entries accrue)

Deeper sub-folders add an entry doc when the first real file lands.

[`concerns.md`](concerns.md) is not an entry doc — it's a flat
root file that catalogues the project's cross-cutting work axes
(C1, C2, …) referenced from task frontmatter. It sits at root
because it spans every section.

## Subtree map

Match shape to actual content — see
[Section, file, folder](#section-file-folder). Default is to
start small (section → flat file → folder) and grow only when
content earns it. Exception: pre-scaffold a folder when multiples
are guaranteed from day one (e.g. `ui-ux/screens/` — any product
with a UI has more than one screen).

```text
docs/
├── assets/                             # images embedded by docs (e.g. task-0022's mockup)
├── brand/                              # entry: brand/README.md
│   ├── brief.md                        # the naming/artwork brief, verbatim
│   └── paneloom-mark.svg               # the mark (+ candidate PNGs, landing concept)
├── business/                           # entry: business/README.md
│   ├── compliance.md                   # external obligations
│   ├── budget.md                       # out-of-pocket costs
│   └── receipts/                       # invoices cited by budget.md
├── content/                            # entry: content/README.md
│   └── laboratory-prices.md            # how prices map to LOINCs (data in laboratories.json)
├── milestones.md                       # dated project events
├── product/                            # entry: product/README.md
│   ├── concepts/                       # entry: concepts/README.md
│   ├── features/                       # entry: features/README.md
│   └── README.md
├── tasks/                              # entry: tasks/README.md
│   ├── README.md
│   └── task-XXXX.md                    # numbered tasks
├── tech/                               # entry: tech/README.md
│   ├── decisions/                      # entry: decisions/README.md
│   │   └── adr-NNNN-<slug>.md          # one file per decision
│   ├── README.md                       # index of the subsystem pages below
│   ├── interchange-format.md           # lab-data file envelope (spec)
│   ├── reference-data.md               # every JSON under web/public/data/ and its schema
│   ├── molar-masses.md                 # mass↔molar reference data
│   ├── units.md                        # unit normalization, folding, conversion
│   ├── computed-indices.md             # index definitions and engine
│   ├── diagnostic-reports.md           # upload, validation, LOINC cross-check, export
│   ├── navigation-and-shell.md         # routes, blocking, app shell, tokens
│   ├── monitoring-panels.md            # grid and Panel Detail
│   ├── results-tables.md               # the results table, mobile reveal, scheduled columns
│   ├── scheduling-and-visits.md        # visits, cascade, Scheduled Visits page
│   ├── charts.md                       # What's in range and the 3D chart
│   ├── pathway-pages.md                # Hormonal Pathways and Lipid Transport
│   ├── medications.md                  # Medications table
│   ├── reference-book.md               # Reference Book pages
│   ├── account-and-sync.md             # auth, GitHub-backed sync, backup, clear
│   ├── share-links-and-deploy.md       # Worker, CI deploy, share links
│   ├── testing.md                      # suites and CI jobs
│   └── sync-architecture-options.md    # sync/multi-user design-space survey (not an ADR)
├── ui-ux/                              # entry: ui-ux/README.md
│   ├── style-guide.md                  # visual + interaction standards
│   ├── performance-guide.md            # end-to-end UX performance
│   ├── screens/                        # entry: screens/README.md
│   └── journeys.md                     # multi-screen paths
├── references.md                       # external standards and vocabularies
├── README.md                           # this file
└── concerns.md                         # cross-cutting axes (C1, C2, …)
```

### What lives where

| Concern | Home | Read it when |
| --- | --- | --- |
| Images embedded by docs (mockups, screenshots) | [`assets/`](assets/) | Adding a picture to a task or spec |
| Brand identity (logos, fonts, colors, naming) | [`brand/`](brand/) | Naming, identity, brand assets, app icon question |
| Business — audience, scope, monetization | [`business/`](business/) | Pricing, scope, audience, monetization question |
| Externally-imposed obligations (licensing, regulation) | [`business/compliance.md`](business/compliance.md) | Anything legally or contractually required (vs self-imposed) |
| Out-of-pocket project costs (one-time + recurring) | [`business/budget.md`](business/budget.md) | Tracking spend; planning a renewal; FX or pricing question |
| Cross-cutting axes (C1, C2, …) referenced by tasks | [`concerns.md`](concerns.md) | Picking which work area a task belongs to; orienting at session start |
| Source material — quantities, lists, corpora | [`content/`](content/) | Sourcing data, citing a fact, planning ingest |
| Laboratory prices: the reasoning; the prices live in `web/public/data/laboratories.json` | [`content/laboratory-prices.md`](content/laboratory-prices.md) | Recording a laboratory's prices; costing a set of tests |
| Project milestones (launches, releases, evidence) | [`milestones.md`](milestones.md) | Looking up when an event happened, or what shipped in a release |
| Product core idea + section glossary | [`product/README.md`](product/README.md) | Orienting on what the product is at the conceptual level |
| Product entities (one file per noun) | [`product/concepts/`](product/concepts/) | Modeling a stable noun the product reasons about |
| Cross-folder feature specs (one file per verb) | [`product/features/`](product/features/) | Implementing or scoping a specific user-facing capability |
| Tasks (numbered, frontmatter-tagged) | [`tasks/`](tasks/) | Creating or closing a task; orienting at session start |
| Stack, ADRs, architecture | [`tech/`](tech/) | Anything implementation: framework, hosting, data, payments |
| Architecture decision records (one file per decision) | [`tech/decisions/README.md`](tech/decisions/README.md) | Asking why an architectural call was made, or recording a new one |
| Lab-data interchange file envelope (prose spec + published [JSON Schema](https://paneloom.com/schema/bloodtests-3.schema.json)) | [`tech/interchange-format.md`](tech/interchange-format.md) | Reading or writing an exported lab-data file |
| Molar masses and mass↔molar conversion (per-analyte table + citations) | [`tech/molar-masses.md`](tech/molar-masses.md) | Adding or checking a conversion factor; asking where a mass↔molar number came from |
| One page per subsystem (reference data, units, indices, reports, shell, tables, scheduling, charts, pathways, medications, reference book, account, deploy, testing) | [`tech/README.md`](tech/README.md) | Changing how a subsystem works, or checking what the code does today |
| Screens (where the user is) | [`ui-ux/screens/`](ui-ux/screens/) | Building or changing a screen |
| Journeys (paths across screens) | [`ui-ux/journeys.md`](ui-ux/journeys.md) | Designing or changing a multi-screen flow |
| UX style standards (visual + interaction) | [`ui-ux/style-guide.md`](ui-ux/style-guide.md) | Picking a color, type, motion, or interaction pattern |
| UX performance standards | [`ui-ux/performance-guide.md`](ui-ux/performance-guide.md) | Setting or checking a UX performance metric / threshold |
| External standards & terminology (LOINC, UCUM, HL7, FHIR, CAS) | [`references.md`](references.md) | Looking up external specifications, schemas, official portals, or GitHub repos |

### Section, file, folder

One rule at every scale — match shape to actual content:

```text
## section in parent README  →  <section>.md  →  section/README.md
```

- **Section in a parent README.** New material starts here.
- **Flat file.** Extract when the section grows past
  ~5 entries / ~50 lines, or when it accretes its own
  open-questions / glossary / examples.
- **Folder with entry doc.** Extract when the file accretes
  multiple sub-entries that each want their own file
  (e.g. `decisions.md` → `decisions/<slug>.md`).

Reverse direction is also fine: if a folder shrinks back toward
one file, collapse it. Match present content; don't predict —
*with one exception*: pre-scaffold a folder when multiples are
guaranteed from day one. `ui-ux/screens/` is the canonical case
(any product with a UI has more than one screen). Don't
pre-scaffold on speculation ("we *might* have multiple X") — only
when the alternative would be silly.

The map above shows the canonical destination shape. The
following are intentionally *not* pre-created — they land on
first real entry:

- `release-notes/` (with `preview/` and `production/`
  sub-folders) — when shipping a release-notes pipeline.
- `test-plans/` — when acceptance tests need a docs home
  (separate from each feature spec's `Acceptance` section).
- `workflows.md` — cross-feature flows that don't fit any one
  feature spec.
- `time-tracking.md` — project-wide time log (separate from
  per-task `time_entries`).
- `project-map.md` — high-level concern → doc index, when the
  default entry docs aren't enough.
- `milestones/` (folder form) — `milestones.md` is scaffolded;
  extracts to a `milestones/` folder (with `history.md` index +
  dated deep-dive files + evidence artifacts) when deep-dives
  warrant their own pages.
- `journeys/` (folder form) — `journeys.md` is scaffolded;
  extracts to a `journeys/<journey>.md` folder when individual
  journeys grow their own branch tables, screen-by-screen notes,
  or open questions.

