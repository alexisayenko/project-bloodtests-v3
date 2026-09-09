# Decisions (ADRs)

Architecture decision records — one file per decision, in
[Michael Nygard's shape](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
(context → decision → consequences → what would force revisiting it).

File name: `adr-NNNN-<slug>.md`, zero-padded sequential, numbered
independently of project-bloodtests-v2. Numbers are never recycled; a
decision that gets reversed keeps its file and gains a
`Status: superseded by ADR-NNNN` line rather than being deleted.

Each record opens with `# ADR-NNNN: <title>` and a
`Status: <state> · <date>` line.

## Index

| ADR | Decision | Status |
| --- | --- | --- |
| [ADR-0001](adr-0001-content-hash-plain-stringify.md) | `contentHash` over plain `JSON.stringify`, not a canonical serialization | accepted · 2026-08-27 |
| [ADR-0002](adr-0002-borrow-fhir-shapes-not-fhir.md) | Borrow FHIR's shapes, without adopting FHIR | accepted · 2026-08-27 |
| [ADR-0003](adr-0003-store-only-what-the-lab-printed.md) | Store only what the lab printed, no `us` / `si` blocks | accepted · 2026-08-27 |
| [ADR-0004](adr-0004-derive-loinc-from-name-and-unit.md) | Derive LOINC from printed name + unit, demote printed codes to evidence | accepted · 2026-08-28 |
| [ADR-0005](adr-0005-companion-observations-are-not-panels.md) | Companion observations are a third relation kind, not panels | accepted · 2026-09-07 |
| [ADR-0006](adr-0006-envelope-schema-numbered-3.md) | Envelope `schema` numbered 3 to match the project | accepted · 2026-09-07 · partially superseded by 0009, 0012 |
| [ADR-0007](adr-0007-ucum-as-the-unit-vocabulary.md) | UCUM as the canonical unit vocabulary | accepted · 2026-09-07 |
| [ADR-0008](adr-0008-fhir-shaped-envelope-not-fhir.md) | A FHIR-shaped envelope, not a FHIR document | accepted · 2026-09-07 |
| [ADR-0009](adr-0009-v3-only-and-rawname.md) | v3-only upload, and observation `name` renamed to `rawName` | accepted · 2026-09-07 · widened by 0012 |
| [ADR-0010](adr-0010-analyte-catalog-is-the-source-of-truth.md) | The analyte catalog is the source of truth, and panels have two layers | accepted · 2026-09-07 |
| [ADR-0011](adr-0011-molar-masses-are-data-factors-are-derived.md) | Molar masses are cited reference data; conversion factors are derived | accepted · 2026-09-08 |
| [ADR-0012](adr-0012-envelope-version-is-a-major-minor-string.md) | The envelope version is a `"major.minor"` string | accepted · 2026-09-09 |
| [ADR-0013](adr-0013-u-and-iu-fold-by-loinc-property.md) | `U` and `IU` are one unit only where the analyte's LOINC property says so | accepted · 2026-09-09 |

## Where each one bites

- **The interchange file** — 0001 (`contentHash`), 0002 and 0008
  (FHIR-shaped field design), 0003 (no converted sibling values),
  0006 (`schema` version number), 0007 (`unit` / `rawUnit`), 0009
  (v3-only upload, `rawName`), 0012 (the version is a
  `"major.minor"` string, and a minor is a backward-compatible
  addition). All of these are cross-linked from
  [`../interchange-format.md`](../interchange-format.md).
- **LOINC resolution** — 0004, implemented in
  `web/src/data/loincCheck.ts`.
- **Reference data** — 0010, implemented in
  `web/public/data/analyses.json` (the analyte catalog) and
  `web/public/data/monitoring-panels.json`, derived in
  `web/src/data/analyteCatalog.ts`; see the
  [observation](../../product/concepts/observation.md) and
  [monitoring panel](../../product/concepts/monitoring-panel.md)
  concepts. 0011 applies the same rule to mass↔molar arithmetic —
  `web/public/data/molar-masses.json`, derived in
  `web/src/data/molarMasses.ts`; see
  [`../molar-masses.md`](../molar-masses.md).
- **Relations between markers** — 0005, still unbuilt; see the
  [companion observation](../../product/concepts/companion-observation.md)
  concept and [task-0010](../../tasks/task-0010.md).
- **Units** — 0007, derived in `web/src/data/unitNormalization.ts` and
  written out as a pair: the folded spelling in `unit`, the printed
  string in `rawUnit`. No value is converted (0003). See the
  [unit](../../product/concepts/unit.md) concept and
  [task-0011](../../tasks/task-0011.md), done; the UCUM parser it
  handed on is [task-0008](../../tasks/task-0008.md). 0013 qualifies
  0007 in one place — `U` and `IU` are one unit for an analyte whose
  LOINC property names one of them, the two sets derived from the
  catalog's long common names (0010) in
  `web/src/data/analyteCatalog.ts`, and a label is all it decides
  (0003).

## Adding one

1. A decision is made that would otherwise be re-argued later.
2. Create `adr-<next-number>-<slug>.md` with the sections above.
3. Add the row to the index, and cross-link it from the doc the
   decision governs (usually
   [`../interchange-format.md`](../interchange-format.md) or a
   [concept](../../product/concepts/README.md) page).
