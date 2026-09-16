# ADR-0021: Pathway pages share one overlay and association engine

Status: accepted · 2026-09-16

## Context

Hormonal Pathways ([task-0024](../../tasks/task-0024.md)) was built as one
component, `HormonalPathwaysView.tsx`, which grew its own measures, reference
and source blocks, date stepper, dismiss handling, association lines and a
layout-measuring hook. Lipid Transport ([task-0060](../../tasks/task-0060.md))
needed all of that again: chips and badges that expand in place to a lab range
or cited index zones, a stepper over one panel's dates, the purple association
bus hidden at rest, and arrows that stay attached as nodes move.

- **The two pages look different.** The gonadal axis is four captioned zones of
  signals, carriers, cells and receptors; the lipid page is a liver over a row
  of six particles whose association targets are regions *inside* each glyph
  (Chol, TRIG, the apoprotein pill), not whole nodes.
- **Copying would drift.** About 400 lines would have been duplicated, and the
  pages would have split on things users compare between them: how a range is
  tagged, how citations number, how a badge's lines are drawn.
- **Wiring is not data yet.** [ADR-0014](adr-0014-pathway-wiring-is-mermaid-generated-to-json.md)'s
  `pathways.json` is unbuilt, and lipid transport needs constructs its subset
  rejects (task-0060, "Fit with ADR-0014's subset"), so each page still
  hard-codes its own wiring.

## Decision

**Every pathway page draws on one shared layer — `pathwayShared.ts` (logic,
types, hooks) and `PathwayParts.tsx` (components) in
`web/src/components/conditions/` — and owns only its own layout and wiring.**

- **Shared: values and text.** `Measure` / `Status` / `EMPTY`, `withVariants`
  (a code with its alias-group siblings), and reference blocks built one way:
  `labReference` for a printed range, `zoneReference` for `INDEX_DEFS` zones,
  `combinedZones` for several estimates of one quantity, `mergeReferences` /
  `keepSources` renumbering citations into one list. `CitedSource` may carry a
  `quote`, shown under it. `ReferenceBlock`, `SourcesBlock`, `Cites`,
  `ChipValue` and `DateStepper` render them.
- **Shared: interaction.** `useDismiss` keeps one chip, card or badge open at a
  time, closes it on Escape or a pointer-down outside, and re-places its card
  on resize.
- **Shared: the overlay.** Lines are an SVG over the page, **measured from the
  DOM**, never laid out from data: nodes are found by `data-node`, badges by
  `data-badge`, chips by `data-caption`. `associationFor` draws a badge's bus
  to a lane above its targets, a stub to each and a ring around each
  (`ringsFor`); `AssociationLayer` draws only the active badge's, **hidden at
  rest**, and veils the rest of the diagram only for an opened badge.
  `roundedPath` gives every page the same rounded turns.
- **Shared: when to re-measure.** `useMeasuredLayout(root, layoutKey,
  measure)` re-runs `measure` when the root or any `[data-node]` inside it
  resizes, an image loads, `document.fonts.ready` settles, or `layoutKey`
  changes (each page folds date, unit system and its own toggles into it),
  coalesced into one animation frame per burst.
- **Shared: glyph sizes and raster art.** `SIZE` (molecular 32, cell 64, organ
  128), `GlyphArt` and `Glyph` (crops a PNG to its drawn content), and
  `ENZYME_ART`, the one enzyme icon both pages use.
- **Per page.** Zones or rows, positions, the edge list (Hormonal Pathways'
  `PATHWAYS`, Lipid Transport's single secretion arrow), which targets each
  badge and chip reads, and each page's prose and sources. A target that is not
  on screen is the page's to resolve — Lipid Transport rings the whole particle
  when Data mode draws no region for it.

## Alternatives considered

- **Copy per page.** Fastest for the second page and the cause of drift for
  every one after it.
- **One generic `PathwayView` driven by a config.** Premature: the two pages
  share parts, not a skeleton, and a config broad enough for zones and a
  particle row would be a layout language of its own.
- **Lay lines out from data** (a graph layout, or Mermaid rendered in the app).
  ADR-0014 already rejects auto-layout for anatomical arrangement; measuring
  the DOM lets CSS keep owning the layout.

## Consequences

- A fix to citations, dismissal, association drawing or re-measuring lands on
  both pages at once, and a third axis page starts from the same parts.
- The `mc-pathway-*` classes in `index.css` are part of the contract: a page
  using the parts uses their styling, and adds its own (`mc-lipid-*`) only for
  what is page-specific.
- Wiring remains hand-coded per page until ADR-0014's pipeline exists; when it
  does, the JSON replaces the page's edge and target lists, and the layer
  drawing them stays.
- `SIZE` is the default, not a law: Lipid Transport's particle row sizes by
  diameter order instead (`GLYPH_SIZE`, 170 / 142 / 118 / 100 / 100 / 72 px),
  since it exists to compare particles side by side.
- `pathway-shared.test.ts` covers the shared pure helpers and
  `pathway-views.test.tsx` renders both views in jsdom over synthetic results;
  the measured overlay geometry needs real layout, so it is still checked by
  using the pages.

## What would force revisiting

- A page whose drawing cannot be measured from the DOM — a canvas or a
  virtualised view — or a mobile shell (task-0020) whose layout makes measured
  overlays impractical.
- Hormonal Pathways and Lipid Transport merging into one "Pathways" section
  with axis tabs (task-0060, open question 1), which could make a shared page
  skeleton worth having after all.
- `pathways.json` carrying positions as well as topology, which would move line
  geometry out of the DOM.
