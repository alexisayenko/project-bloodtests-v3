# ADR-0028: MCHC printed in `%` takes the LOINC's own unit through a scoped alias

Status: accepted · 2026-09-20 · supersedes the MCHC policy of 0025

Applies [ADR-0003](adr-0003-store-only-what-the-lab-printed.md),
[ADR-0010](adr-0010-analyte-catalog-is-the-source-of-truth.md) and follows the pattern of
[ADR-0013](adr-0013-u-and-iu-fold-by-loinc-property.md): an identity that
holds for one analyte is asked of the analyte, not of the spelling.

## Context

[ADR-0025](adr-0025-mchc-percent-is-not-an-accepted-unit.md) kept the
`Unit '%' unexpected for 786-4` warning and left the fix to the owner
relabelling stored data to `g/dL`. That made the owner edit the lab's
printed unit, which ADR-0003 says the app must not do, and left a
permanent warning on a printed value that is right.

The original Ygia Polyclinic PDFs (four reports, 2022-2024) print `%` with
the range `32,0-36,0`. `%` there is g of haemoglobin per 100 mL of red
cells, numerically identical to g/dL. NLM lists five MCHC codes: `786-4`,
`28540-3` (no method), `59467-1` (mol/vol), `47279-5` (cord blood) and
`62246-4` (fetal). `786-4` is the right one; none carries a percent
property, so there is no sibling code to point at.

## Decision

**`rawUnit` stays `%` and the value stays as printed; the normalized unit
is the LOINC's own unit, `g/dL`.** The mapping is an analyte-scoped,
data-driven alias in `analyses.json`: field `printedUnitAliases` on `786-4`,
`{"%": "g/dL"}`. Normalization reads it for that code only, so the
interchange `unit` (UCUM) is `g/dL` beside `rawUnit` `%`.

- No stored data changes; no relabel by the owner, no conversion (the
  number is identical, ADR-0003).
- The unexpected-unit warning disappears for `786-4` only. `%` under any
  other code still warns.
- The alias is reference data (ADR-0010), not a branch in code, so a
  further legacy label for another analyte is a data edit with a citation.

## Alternatives considered

- **`allowedUnits: ["%"]` on `786-4`.** Same-dimension variants only live
  there ([ADR-0025](adr-0025-mchc-percent-is-not-an-accepted-unit.md));
  `%` would also pass a genuine ratio, and `unit` would then be written as
  `%` under a mass-concentration code.
- **Owner relabels the stored unit** (0025). Alters the printed unit.
- **Auto-relabel on import.** Same alteration, silently, for every lab.
- **A code branch on `786-4`.** Hides a data fact in code.

## Consequences

- The absolute differential counts printed without a range keep their
  `Missing reference range information` warning; that half of 0025 stands.
- The interchange schema's `unit` description ("spelling normalization
  only") is amended: a LOINC-scoped printed-unit alias is also applied.
- `%` stays an unexpected unit for every code that has no alias entry.

## What would force revisiting

- LOINC adding a percent-property MCHC code, which would turn this into a
  code repair like [mass versus molar](../units.md#mass-versus-molar-is-a-code-error).
- A second analyte needing an alias whose two units are not numerically
  identical, which is a conversion and not this mechanism.
