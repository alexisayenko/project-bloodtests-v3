# ADR-0014: Pathway wiring is written in Mermaid and generated to JSON

Status: accepted · 2026-09-11

## Context

The planned Hormonal Pathways section ([pathway](../../product/concepts/pathway.md)
concept, [task-0024](../../tasks/task-0024.md)) draws an axis as its
wiring: sites, signals, carriers and enzymes, joined by association lines
and pathway arrows, with the user's values placed on them.

- **The wiring has to be reviewable without redrawing a mockup.** Whether
  E2 feeds back at the arcuate nucleus or the pituitary is a biology
  question, and it must be answerable by reading a diff, not by comparing
  two pictures.
- **Generated mockups got the biology wrong.** The AI-drawn pathway
  images put signals at the wrong sites and invented arrows; they are
  useful for look and feel and unusable as a specification.
- **Reference data is JSON and single-sourced**
  ([ADR-0010](adr-0010-analyte-catalog-is-the-source-of-truth.md)): one
  file per fact, a schema beside it, validated in tests, never mirrored in
  TypeScript. Wiring is reference data.
- **The Reference Book's HP Axis page already states this wiring** as
  hand-written cascade text (`hpAxisContent.ts`). A second, independent
  copy in a drawing would drift from it.

## Decision

**A per-axis Markdown file holding one ` ```mermaid ` flowchart fence is
the source of truth for that axis's wiring.** GitHub renders it in review,
so the graph is read as a graph and changed as text.

- **Restricted subset, encoding the ontology.** Structure gives the kind, so
  no `classDef` or `style` is needed:
  - **Subgraph nesting gives the site level** — a top-level subgraph is a
    band (an organ, or the Blood compartment), one inside it a region, one
    inside that a cell; nothing nests deeper. Two reserved top-level
    subgraphs, Measures and Ratios, hold the badges.
  - **Node shape gives the kind** — a rectangle is a signal (or, in a badge
    group, a badge), a stadium a carrier, a triple circle a docked signal; a
    circle inside a cell is a receptor and a hexagon inside a cell an enzyme.
  - **Arrow form gives the line kind** — `-->` from a cell is secretion and
    onto a receptor signaling; `-.->` onto a receptor is feedback or
    crosstalk; `S --> E --> P` through an enzyme is a conversion, the only
    chain allowed; `<-->` is exchange; `-.-` is an association, whose kind
    (part of, ratio link, docking) follows from its endpoints.
  - **Labels carry effects only** — quoted, one or more `·`-separated ↑B /
    ↓B with an optional parenthetical qualifier, on signaling, feedback and
    conversion edges and nowhere else. The site an arrow acts at is never
    written: it is the target receptor's place in the subgraph tree.

  The generator rejects anything else — another arrow form, an unquoted
  label, a shape outside its allowed place, an edge whose endpoints are not
  the kinds its form takes — rather than guessing.
- **Generated JSON.** `npm run pathways:build` parses the fences and writes
  `web/public/data/pathways.json`, described by
  `web/public/schema/pathways-1.schema.json` (draft 2020-12, closed
  objects) and validated with ajv. A **drift test** regenerates it and
  fails CI when the committed JSON does not match its Markdown.
- **Sidecar for what Mermaid should not carry.** A hand-edited sidecar,
  joined by node, subgraph and edge id, holds hover descriptions, each
  signal's or carrier's binding to a LOINC code or an `INDEX_DEFS` key (or
  what it is, for the never-measured), chemical classes and enzyme
  locations, a citation on every pathway arrow and docking line, and the
  flag telling crosstalk from feedback. Badges backed by an index carry its
  key and no prose — their text and citations stay in `INDEX_DEFS` — so only
  a badge with no index has its explanation written here. A **completeness
  test** fails when an id is unmapped, an arrow or docking line lacks a
  citation, an index badge carries prose, or a sidecar key names something
  the Markdown lacks.
- **The app never bundles or renders Mermaid.** It draws hand-laid SVG
  from `pathways.json`: positions and styling belong to the view, topology
  and biology to the data.
- **The HP Axis page reads the same JSON**, rendering its cascade notation
  from it instead of hand-written HTML.

## Alternatives rejected

- **Hand-written JSON only.** Correct in shape, and unreviewable: a
  feedback loop spread over forty edge objects cannot be checked by eye.
- **Rendering Mermaid in the app.** Auto-layout cannot hold the fixed,
  anatomical arrangement the view needs (hypothalamus above pituitary above
  testes, T docked on its carrier); it offers no animation or per-edge
  thickness, and costs about 500 kB on an entry bundle already over Vite's
  advisory.
- **Generated images as the specification.** They are what got the biology
  wrong, and a picture cannot be diffed or tested.

## Consequences

- Changing the wiring is a Markdown edit plus `npm run pathways:build`;
  forgetting the build fails CI rather than shipping stale data.
- Mermaid is a build-time input only — a devDependency concern at most, and
  nothing Mermaid-shaped reaches the bundle.
- The SVG layout is hand-maintained per axis; a new node needs a position as
  well as a line of Mermaid.
- Every pathway arrow and docking line carries a citation, so the pathway
  view can offer a source for each arrow as the Reference Book does for its
  prose; part-of lines and ratio links cite through their badge.
- `hpAxisContent.ts`'s cascade block is replaced by a render of the JSON,
  so the page and the pathway view state one wiring.
- Mermaid's syntax is a moving target; the restricted subset and the
  generator's own parser keep the source readable even if Mermaid changes.

## What would force revisiting

- An axis whose wiring the subset cannot express (for example, an edge
  whose effect depends on concentration), which would push the source
  toward a format with richer edge data.
- A layout that could be derived from the data reliably enough to retire
  hand-laid SVG.
- Adding the women's axis if its cyclic dynamics need time-varying edges,
  which neither Mermaid nor the current schema describes.
