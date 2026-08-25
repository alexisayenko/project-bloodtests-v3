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

- [TODO: product name] — [TODO: one-line description].

If a second product ever appears (rare), see
[Multi-product split](#multi-product-split).

## Guiding principle

> **Strategy + UX → root `docs/`. Per-folder implementation
> details → `<folder>/docs/` (when needed).**

Test: *"If a PM would care about it, root. If only an engineer
would care, the code folder."*

Default to root `docs/`. Per-folder `docs/` is reserved for
implementation-specific notes that genuinely need to live with
code (build pipelines, deploy scripts, folder-specific ADRs).

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
├── brand/                              # entry: brand/README.md
├── business/                           # entry: business/README.md
│   ├── compliance.md                   # external obligations
│   └── budget.md                       # out-of-pocket costs
├── content/                            # entry: content/README.md
├── milestones.md                       # dated project events
├── product/                            # entry: product/README.md
│   ├── concepts/                       # entry: concepts/README.md
│   ├── features/                       # entry: features/README.md
│   └── README.md
├── tasks/                              # entry: tasks/README.md
│   ├── README.md
│   └── task-XXXX.md                    # numbered tasks
├── tech/                               # entry: tech/README.md
├── ui-ux/                              # entry: ui-ux/README.md
│   ├── style-guide.md                  # visual + interaction standards
│   ├── performance-guide.md            # end-to-end UX performance
│   ├── screens/                        # entry: screens/README.md
│   └── journeys.md                     # multi-screen paths
├── README.md                           # this file
└── concerns.md                         # cross-cutting axes (C1, C2, …)
```

Obsolete docs go to `archive/docs/` at repo root, not inside
`docs/` — see [`../README.md#archive`](../README.md#archive).

### What lives where

| Concern | Home | Read it when |
| --- | --- | --- |
| Brand identity (logos, fonts, colors, naming) | [`brand/`](brand/) | Naming, identity, brand assets, app icon question |
| Business — audience, scope, monetization | [`business/`](business/) | Pricing, scope, audience, monetization question |
| Externally-imposed obligations (licensing, regulation) | [`business/compliance.md`](business/compliance.md) | Anything legally or contractually required (vs self-imposed) |
| Out-of-pocket project costs (one-time + recurring) | [`business/budget.md`](business/budget.md) | Tracking spend; planning a renewal; FX or pricing question |
| Cross-cutting axes (C1, C2, …) referenced by tasks | [`concerns.md`](concerns.md) | Picking which work area a task belongs to; orienting at session start |
| Source material — quantities, lists, corpora | [`content/`](content/) | Sourcing data, citing a fact, planning ingest |
| Project milestones (launches, releases, evidence) | [`milestones.md`](milestones.md) | Looking up when an event happened, or what shipped in a release |
| Product core idea + section glossary | [`product/README.md`](product/README.md) | Orienting on what the product is at the conceptual level |
| Product entities (one file per noun) | [`product/concepts/`](product/concepts/) | Modeling a stable noun the product reasons about |
| Cross-folder feature specs (one file per verb) | [`product/features/`](product/features/) | Implementing or scoping a specific user-facing capability |
| Tasks (numbered, frontmatter-tagged) | [`tasks/`](tasks/) | Creating or closing a task; orienting at session start |
| Stack, ADRs, architecture | [`tech/`](tech/) | Anything implementation: framework, hosting, data, payments |
| Screens (where the user is) | [`ui-ux/screens/`](ui-ux/screens/) | Building or changing a screen |
| Journeys (paths across screens) | [`ui-ux/journeys.md`](ui-ux/journeys.md) | Designing or changing a multi-screen flow |
| UX style standards (visual + interaction) | [`ui-ux/style-guide.md`](ui-ux/style-guide.md) | Picking a color, type, motion, or interaction pattern |
| UX performance standards | [`ui-ux/performance-guide.md`](ui-ux/performance-guide.md) | Setting or checking a UX performance metric / threshold |

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

## `<folder>/docs/` — per-folder implementation

Reserved for implementation-specific notes that drift from code
if separated (build pipelines, deploy scripts, folder-specific
ADRs). Default is **empty** — strategy and product docs live at
root `docs/`.

When a code folder needs implementation docs:

| Folder | Used per-code-folder? | Notes |
| --- | --- | --- |
| `tech/` | When implementation docs accrue | Architecture, deploy specifics |
| `ui-ux/` | When folder-specific screens exist | Folder-specific anatomy |
| `content/` | When folder microcopy needs separation | In-app folder-only copy |
| `business/` | No | Business is project-level → `docs/business/` |
| `brand/` | No | Brand is shared → `docs/brand/` |
| `tasks/` | No | Tasks are project-level → `docs/tasks/` |
| `archive/` | No | Archive is project-level → `archive/` |

## Multi-product split

Rare. If a second product appears, rename `product/` to
`products/<product-1>/` and add `products/<product-2>/`
alongside. Cross-product concerns (`brand/`, `business/`,
`milestones.md`, `tasks/`, `concerns.md`) stay at `docs/` root:

```text
docs/
├── brand/
├── business/
├── concerns.md
├── milestones.md
├── products/
│   ├── <product-1>/
│   │   ├── README.md
│   │   ├── concepts/
│   │   └── features/
│   └── <product-2>/
│       └── …
└── tasks/
```

The split is a move + rename, not a rewrite — `docs/product/`
becomes `docs/products/<product-1>/`, no internal restructure.
