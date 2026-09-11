# ADR-0010: The analyte catalog is the source of truth, and panels have two layers

Status: accepted · 2026-09-07

## Context

Everything the app knew about a LOINC code was spread across four
places, and none of them was authoritative.

`web/public/data/analyses.json` held the code, its LOINC long common
name, a display name, `ru-RU`/`uk-UA` translations and the popup
prose. `SHORT_LABELS` in
`web/src/components/conditions/markers.ts` held the badge label and
the expected unit, under a comment that said in as many words that no
such field existed in the real catalog. `ALSO_REFS` in the same file
held the unit and method variants of a code, with each variant's LOINC
long common name copied out by hand. `DEFAULT_UNITS`,
`SUPPLEMENTARY_UNITS` and `ALLOWED_UNITS` in
`web/src/data/loincCheck.ts` held units again — `DEFAULT_UNITS` was
literally `SUPPLEMENTARY_UNITS` merged over `SHORT_LABELS` merged over
`ALSO_REFS`, a fourth table whose only job was to paper over the first
three being in different shapes.

The cost showed up as drift. Two of the hand-copied long common names
in `ALSO_REFS` did not match the catalog's own entry for the same code
(`17855-8` and `59261-8`, the two HbA1c variants). Twenty-one codes
the product displays had a badge label but no catalog entry at all, so
the LOINC cross-check could never derive them from a printed name.
Zinc (`5763-8`) was in the catalog twice, with two different display
names, and the later one silently won because the catalog is loaded
into a map keyed by code. None of that was detectable: adding a fact
meant knowing which of four files it belonged in, and nothing checked
that the four agreed.

Panels had the mirror problem in the other direction. `panels.json`
describes how a *laboratory* orders and prints a set of analytes —
"Full Blood Count", "Lipid Metabolism". The product's Monitoring
Panels are a different thing: "Insulin Resistance" is a clinical
question, composed from a laboratory group minus what the question
does not need plus what it does. That composition lived in
`PANEL_DEFS`, a TypeScript array — so the one layer was data and the
other was code, and changing the product's grouping meant a code
change, a build and a deploy.

## Decision

**A LOINC code's facts live on its catalog entry in
`analyses.json` and nowhere else, and the two panel layers are both
data.**

- Each catalog entry gains `short` (the badge label), `unit` (the
  unit the code is expected in), `allowedUnits` (further units
  accepted for it), and, on a variant code, `aliasOf` plus
  `aliasLabel` naming the primary it folds into and how it differs.
- Alias relations are stored **once, on the variant**, pointing at
  its primary. The reverse direction — a primary's list of variants,
  the old `ALSO_REFS` — is derived by grouping the catalog, so the
  two can no longer disagree. The same derivation produces
  `SHORT_LABELS`, `DEFAULT_UNITS` and `ALLOWED_UNITS` in
  `web/src/data/analyteCatalog.ts`. No lookup table is
  hand-maintained; the modules that used to own them now only consume
  them.
- The 21 codes that had a label but no entry were added to the
  catalog, and the duplicate Zinc entry was removed. A code the
  product shows a badge for is an analyte the product knows about;
  there is no second register of half-known codes.
- `PANEL_DEFS` moves to `web/public/data/monitoring-panels.json`.
  `panels.json` keeps its meaning — the laboratory's groups — and
  monitoring-panels.json states the product's composition over it:
  `panelId` / `panelIds` / `loincs` for what to start from, then
  `excludeLoincs` and `extraLoincs`. `buildConditions` stays the
  resolver; it is now a function over three data inputs rather than a
  function with a table baked in.
- `web/public/schema/analytes-1.schema.json` (draft 2020-12)
  describes all three files, and `web/test/reference-data.test.ts`
  validates them with ajv. Unlike the interchange envelope, whose
  objects are deliberately open, these objects are **closed**: this
  is app-internal data with no outside authors, so a mistyped key
  should fail the suite rather than be ignored at runtime. The schema
  also encodes the invariants the derivation relies on — a `short`
  requires a `unit`, an `aliasOf` requires an `aliasLabel`, a
  Monitoring Panel names exactly one source of LOINCs.

## Alternatives considered

- **Keep the tables in TypeScript and add a test that they agree
  with the catalog.** Cheaper, and it would have caught the two
  drifted names. But it makes agreement a thing to maintain rather
  than a thing that cannot fail to hold, and it leaves "where does
  this fact go?" unanswered for the next field.
- **A second data file for the facts, leaving `analyses.json` as the
  prose catalog.** Two files keyed by the same code is the problem
  restated with a cleaner boundary. The entry is the unit of
  knowledge about a code; splitting it means every reader joins.
- **Store alias relations on the primary (`variants: [...]`) rather
  than on the variant.** Reads more naturally on the page that shows
  the chips, but it puts a code's identity somewhere other than its
  own entry, and the schema cannot then check that a variant names a
  real primary without a cross-entry rule. The reverse map is one
  `reduce`.
- **Fetch the catalog rather than importing it.** The catalog has to
  be readable synchronously: unit normalization and report validation
  run during upload and share-link import, outside any React tree
  that could await a fetch. Threading an async catalog through those
  paths is a large change for no gain — see the consequence below.

## Consequences

- The main JS bundle grows by the catalog (414 kB → 682 kB raw,
  140 kB → 211 kB gzipped) because it is now imported rather than
  fetched, and the `./data/analyses.json` request is gone. Bytes over
  the wire are roughly unchanged and there is one fewer round trip,
  but the catalog now parses before first paint, and the build emits
  a chunk-size advisory it did not before. Code-splitting the prose
  out of the entry chunk is the way back if that ever matters.
- The 21 added entries are new candidates for the LOINC cross-check,
  which is the point — those markers could not previously be derived
  from a printed name. One consequence to watch: `4537-7`
  (ESR, Westergren) now competes with the catalog's existing
  `30341-2` (ESR) on the same unit, so an ESR row resolves to a
  suggestion rather than a confident auto-fix until one is made an
  `aliasOf` the other.
- Two alias chips now read the catalog's LOINC long common name
  instead of the hand-copied one — "…in Blood by DCCT" rather than
  "…by calculation", and "…by IFCC" rather than "…by IFCC protocol".
  The catalog's spelling is the correct one.
- Changing which markers a Monitoring Panel watches is now a JSON
  edit, and a share-link deploy carries it without a rebuild.
- The Insulin Resistance panel keeps excluding `59261-8` even though
  it is registered as an alias of `4548-4`. `buildConditions`
  resolves LOINCs one-to-one and never folds aliases — folding
  happens in All Observations and in latest-value lookup, not in the
  grid — so without the exclusion the panel would render a second
  HbA1c row. The schema says so where the field is defined, because
  the redundancy is the obvious-looking wrong answer.
- `analyses.json` is still served from `public/data/` and still has a
  public URL, but nothing fetches it any more.

## What would force revisiting

- The catalog growing to a size where parsing it before first paint
  is measurable, which turns the import back into a fetch and forces
  the async question the alternatives section deferred.
- A second consumer of the catalog that is not this app — a build
  step, a converter, a server — at which point the entry shape stops
  being an internal contract and the closed objects become a
  compatibility question, the way the interchange envelope's open
  ones already are.

## Notes

- 2026-09-11: the entry field this record calls the display name is
  now `friendlyName` (formerly `displayName`); nothing else changed.
- 2026-09-11: the entry field this record calls `short` (the badge label)
  is now `shortName`, derived into `SHORT_NAMES` (formerly `SHORT_LABELS`)
  — our own short name, not LOINC's SHORTNAME. Every name field is
  defined once, in the "Names" glossary of
  [observation](../../product/concepts/observation.md#names).
