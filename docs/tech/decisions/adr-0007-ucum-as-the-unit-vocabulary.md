# ADR-0007: UCUM as the unit vocabulary

Status: accepted · 2026-09-07

Qualified in one place by
[ADR-0013](adr-0013-u-and-iu-fold-by-loinc-property.md): the vocabulary
stays UCUM, but its rule that `U` and the arbitrary `[IU]` are
commensurable with nothing is not applied when comparing two spellings
printed for one analyte, whose LOINC property says which of the two
units it is measured in. A label only; no value is converted.

## Context

Labs print the same unit many ways, across years and across
languages: `10^9/L`, `×10⁹/л`, `mmol/l` next to `mmol/L`. Every one
of those is the same quantity, and none of them compares equal as a
string. That makes cross-year comparison and any SI/US conversion
string-fragile — a chart that groups by printed unit splits one
marker into several series, and a converter that switches on the
printed text has to know every spelling a lab ever used.

The app stores each observation's `unit` exactly as the lab printed
it and rewrites it never ([ADR-0003](adr-0003-store-only-what-the-lab-printed.md)).
It does already carry a partial unit model, though: the per-code
allowed-unit sets in `web/src/data/loincCheck.ts` (`ALLOWED_UNITS`,
beside the default unit per code) encode which units a given LOINC
code may legitimately carry, and the cross-check uses them both to
disambiguate between unit variants of one analyte and to raise the
validation unit warning. Comparison there goes through a
`canonicalUnit` helper that lowercases and folds per-mL to per-L
(`µIU/mL` → `miu/l`) — a matching key only: it is never stored, never
shown, and is not UCUM. That table is the seed of a normalization
table — it just doesn't name a target vocabulary yet. What a unit is
in product terms is the [unit](../../product/concepts/unit.md)
concept.

## Decision

**When unit normalization is built, the canonical unit vocabulary is
UCUM** — the Unified Code for Units of Measure, published by the
Regenstrief Institute. The printed string is not discarded: it is
preserved in the
[`rawUnit`](../interchange-format.md#rawunit) provenance field
documented in the interchange format, exactly as `rawValue` preserves
a printed value.

Not built yet at the time of writing. This ADR fixes the target
vocabulary so that the `ALLOWED_UNITS` table and any future mapping
pass are written against one answer instead of accreting an ad-hoc
house format. The work was tracked as
[task-0011](../../tasks/task-0011.md) and shipped 2026-09-09 — export
writes the folded spelling to `unit` and the printed string to
`rawUnit`, and no value is converted. Adopting the NLM UCUM library is
still [task-0008](../../tasks/task-0008.md).

## Alternatives considered

- **ISO 80000 / SI.** These define quantities and their printed
  symbols — the typography of `mmol/L` — not machine-parseable
  codes. There is no identifier to put in a field, so the storage
  question is left exactly where it started.
- **UN/CEFACT Recommendation 20.** Unit coding for trade and
  logistics: the codes that appear on invoices and customs
  declarations. It is not a lab-results vocabulary and nothing in
  the clinical toolchain expects it.
- **HL7 Table 0173 (the old ISO+ set).** The legacy predecessor,
  and legacy is the operative word — HL7 itself moved to UCUM.
  Adopting it now would be adopting the thing UCUM replaced.
- **QUDT.** A units ontology aimed at engineering and semantic-web
  work: rich, RDF-shaped, and far heavier than a lab-unit string
  needs. The cost is all in modelling machinery this app would
  never use.
- **CDISC unit codelists.** These belong to clinical-trial
  submissions rather than routine patient results, and they
  increasingly map to UCUM anyway — so picking them means picking
  UCUM with an extra hop.

## Why UCUM specifically

- LOINC publishes example UCUM units per code, so the unit and the
  code stay inside one vocabulary — the same pairing the online NLM
  lookup already reads as `EXAMPLE_UCUM_UNITS`.
- The interchange envelope is FHIR-shaped
  ([ADR-0002](adr-0002-borrow-fhir-shapes-not-fhir.md),
  [ADR-0008](adr-0008-fhir-shaped-envelope-not-fhir.md)) —
  diagnostic reports, observations, reference ranges,
  interpretation, specimen, comparator — and FHIR expects UCUM in a
  quantity's `code`. Choosing anything else means deviating from
  the shapes the format is already borrowing.
- UCUM is an expression grammar, not a fixed list, so a valid unit
  can be written that no lookup table anticipated. That means it
  needs a parser rather than a dictionary — and the National
  Library of Medicine publishes a JavaScript one, from the same
  source the app already calls for the online LOINC lookup.

## Consequences

- Mapping a printed unit to UCUM is ambiguous in places, so the
  pass must be reviewable the way the LOINC cross-check is:
  confirmable suggestions the user applies, never a silent rewrite
  of what the lab printed.
- `unit` would hold the canonical UCUM form and `rawUnit` the
  printed provenance, keeping the printed-vs-derived split the
  format already uses for values.
- Nothing changes until the normalization pass is built: today's
  stored units stay exactly as printed.

## What would force revisiting

- The NLM parser turning out to be unusable in-browser at this
  size, leaving no maintained JavaScript UCUM implementation — at
  which point a curated subset table, rather than the full grammar,
  becomes the real design question.
- LOINC or FHIR moving off UCUM, which would break the single
  argument that makes it the cheap choice here.

## Notes

- 2026-09-11: the context above describes the code as it stood. The
  default and allowed units per code now live in the analyte catalog and
  are derived by `web/src/data/analyteCatalog.ts`
  ([ADR-0010](adr-0010-analyte-catalog-is-the-source-of-truth.md)), and
  the validation unit warning fires only when a unit's dimension
  contradicts the code, not for any unit outside the set. The decision is
  unchanged.
