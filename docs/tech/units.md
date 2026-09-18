# Units

How a printed unit is read, when two spellings are one unit, when a number is
converted for display, and what is never converted. Product-level reasoning
is the [unit](../product/concepts/unit.md) concept; the vocabulary decision is
[ADR-0007](decisions/adr-0007-ucum-as-the-unit-vocabulary.md) and the
never-convert rule
[ADR-0003](decisions/adr-0003-store-only-what-the-lab-printed.md). The
Reference Book's "Units and how they are read" page (`#reference/units`)
explains the same material to the user.

## Normalization stages

`web/src/data/unitNormalization.ts` runs three pure stages:

1. printed unit → canonical Latin spelling (Cyrillic and Ukrainian unit
   tables, superscript folding, micro and multiplication signs);
2. Latin → UCUM code;
3. that code's dimension checked against the observation's LOINC property.

`normalizeObservationUnit` returns all three in one reviewable result,
beside `convertValue` and `canonicalUnitFor`; `ucumUnitFor` is stages 1–2 in
one call. An unrecognized unit returns `undefined` rather than a guess — the
tables are a curated subset, not a UCUM parser, with the NLM UCUM library the
upgrade path ([task-0008](../tasks/task-0008.md)).

Three callers:

- `parseUpload.ts` runs it over every observation of every import route and
  attaches the derived pair to the in-memory `Result` as `canonical` — an
  optional, clearly derived field nothing treats as lab-reported and the
  exporter never emits.
- `validateDiagnosticReports.ts` raises what it cannot settle silently as
  warnings: a dimension contradiction (naming the printed unit, the current
  code, and the sibling code where `massMolarSiblings.ts` knows one, else the
  code's accepted units — another scale of the same dimension, g/L on a g/dL
  hemoglobin code, is no warning; `checkCodeUnit` decides), and a unit that
  maps to no UCUM code at all, lower-severity.
- `utils/exportData.ts` calls `ucumUnitFor` to write the folded spelling to
  each observation's `unit`, with the printed string beside it in `rawUnit`.
  A unit the tables cannot place leaves `unit` absent rather than filled with
  the printed string. See
  [`interchange-format.md`](interchange-format.md).

Only the spelling is ever normalized in a file, and only in `unit`. The
printed value stays authoritative; the derived value pair is never written
back to `value` / `unit`.

`loincCheck.ts` builds its unit comparison key with the same
`foldUnitGlyphs` / `toLatinUnit`, so `ммоль/л`, `тыс/мкл`, `×10⁹/L` and the
micro sign all reduce to the catalog's Latin spelling before a code is derived
from name + unit ([`diagnostic-reports.md`](diagnostic-reports.md)).

## Two spellings, one unit: `sameUnitScale`

A results-table row whose readings sit on two scales loses its row-level unit
label and labels each cell instead — but two spellings of one unit are not two
scales. `ui.ts`'s `sharedUnit` asks `sameUnitScale`, which folds both to
Latin, computes prefix × volume and demands identical kinds and a ratio of
exactly 1. A TSH history printed `uIU/mL`, `mIU/L` and `мкМЕ/мл` carries one
`mIU/L` label (the row's own catalog SI/US unit when it belongs to the same
unit, else the readings' majority spelling) with no number converted, while
`mg/dL` against `mmol/L` still splits onto the cells. It compares, never
converts, and an unrecognized unit answers "no".

The identities folded unconditionally are the pure decimal-prefix ones:
`IU/L` = `mIU/mL`, `mIU/L` = `uIU/mL`, `ng/mL` = `ug/L`, `mg/L` = `ug/mL`.

## `U` and `IU` fold by LOINC property

`U` and `IU` fold too, but only where the analyte permits it, and the
permission is asked of the LOINC property rather than the spelling: an analyte
is measured in one of the two arbitrary units, not both, so whichever a lab
printed there is only one unit it can have meant
([ADR-0013](decisions/adr-0013-u-and-iu-fold-by-loinc-property.md)). Two
properties grant it, in opposite directions:

- catalytic activity (`[Enzymatic activity/volume]` — ALT, AST, ALP, GGT,
  amylase, lipase, cholinesterase, CK): the unit is the enzyme unit, so a
  printed `IU/L` is `U/L`;
- the arbitrary WHO kind (`[Units/volume]` — insulin, TSH, FSH, LH,
  prolactin, thyroglobulin, anti-TPO, TRAb, anti-CCP, rheumatoid factor,
  antithrombin activity, oxLDL): the unit is the International Unit, so a
  printed `µU/mL` is `µIU/mL`.

Both sets are derived from the catalog's long common names by
`analyteCatalog.ts`'s `propertyOf` / `U_IU_FOLD_REASON`, never hand-listed.
Under any other property, and with no analyte supplied, `U` and `IU` stay
different scales, and one analyte's `IU` never meets another's.

## Display-time conversion

`computedIndices.ts`'s `convertUnit` is the one conversion, and it folds a
printed spelling to Latin before matching, so `ммоль/л` converts like
`mmol/L`. It runs in three places, all display-only: the SI / US switch in the
results tables, an index reading its inputs into the formula's unit
([`computed-indices.md`](computed-indices.md)), and the Trends chart placing
a history on its band's unit ([`charts.md`](charts.md)).
Mass↔molar factors come from `molar-masses.json` through `molarMasses.ts`
([`reference-data.md`](reference-data.md#molar-masses-molar-massesjson)).

In a results table the number and its unit label always move together:
`displayedResult` / `sharedUnit` / `buildRowCells` (`ui.ts`) label a reading
with its own code's unit — a molar variant folded into its mass primary's row
keeps `mmol/L`, never the primary's `mg/dL`.

## Mass versus molar is a code error

A `mmol/L` result stored under cholesterol's `[Mass/volume]` code `2093-3` is
a **code** error, not a number to convert, so the validator suggests the
analyte's `[Moles/volume]` sibling. `web/src/data/massMolarSiblings.ts` holds
the curated pairs; each code declares only `{loinc, longCommonName}` and takes
its unit from the catalog's `DEFAULT_UNITS` via `withUnit()` (which throws
naming the code if the catalog has none), and each pair names its analyte's
entry in `molar-masses.json` rather than stating a factor.

This is the one normalization case with a confirm-and-apply UI: `unitRepairFor`
(`reportDetailHelpers.ts`) offers the sibling code as a chip in the report
detail view's chip row, changing the `loinc` alone through the same edit draft
and Save/Cancel gate the LOINC chips use. It is deliberately not auto-applied,
because these warnings render on mount; the unmappable-unit warning gets no
chip, there being nothing to suggest. To repair a file offline,
`node scripts/recode-molar.mjs <file>` from `web/` rewrites `loinc` and
nothing else — see
[`interchange-format.md`](interchange-format.md#a-wrong-unit-here-is-usually-a-wrong-loinc).
