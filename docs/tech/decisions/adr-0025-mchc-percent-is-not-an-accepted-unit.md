# ADR-0025: MCHC printed in `%` is flagged, not accepted

Status: accepted · 2026-09-19

Applies [ADR-0003](adr-0003-store-only-what-the-lab-printed.md) and
[ADR-0007](adr-0007-ucum-as-the-unit-vocabulary.md) to one analyte where
the printed unit is a legacy label for the real one.

## Context

LOINC `786-4` is "MCHC [Entitic Mass/volume] in Red Blood Cells by
Automated count", canonical unit `g/dL`. Every MCHC code in LOINC (786-4,
28540-3 `g/dL`, 59467-1 `mmol/L`, 62246-4 fetus, 47279-5 cord blood)
carries the property MCnc, a mass or molar concentration. LOINC has no
ratio or percent code for MCHC, so there is no sibling code to point a
`%`-reporting lab at, the way a `mmol/L` result under a mass code is
pointed at its molar sibling.

Some labs print MCHC in `%`. On the source PDFs of Ygia Polyclinic
(Cyprus) the 23/6/2022 report reads "MCHC 33,9 %" beside Hb 17,2 g/dl and
Hct 50,8 %. The number is a g/dL concentration: Hb / Hct = 17.2 / 0.508 =
33.9 g/dL. The lab's `%` is a legacy label for grams per 100 mL of red
cells, not a dimensionless fraction (a true fraction would print 0.339).
Relabelling `%` to `g/dL` leaves the number identical.

The validator therefore says `Unit '%' unexpected for 786-4 (expected
g/dL)`, because unit normalization keeps `%` (ratio, dimensionless) and
`g/dL` (mass per volume) on different dimensions.

## Decision

**The app does not accept `%` for `786-4`.** No `%` in its `allowedUnits`,
no special case in normalization, no silent reinterpretation. The warning
stays and is correct: it reports that the printed unit contradicts the
code's property, and it is the app's only way to say so without altering
what the lab printed.

The remedy is a deliberate correction by the data's owner: relabel the
unit to `g/dL`, value unchanged, in their own data store, with the history
kept there (git for the owner's files). It is a data edit, not an app rule.

## Alternatives considered

- **`allowedUnits: ["%"]` on `786-4`.** Silences the warning, and blurs a
  real dimension boundary. Every existing `allowedUnits` entry is a
  same-dimension scale or spelling variant of the canonical unit; `%`
  against `g/dL` is neither, and the entry would pass a genuine ratio
  under an MCHC code unnoticed.
- **Auto-relabel on import.** A stored unit rewritten by the app is the
  alteration ADR-0003 rules out, and an import-time guess would touch
  every future `%` MCHC whether or not it is this legacy label.
- **A repair chip like the mass/molar one.** That chip proposes a sibling
  code LOINC publishes. Here no code exists to propose.

## Consequences

- An MCHC history mixing `g/dL` and `%` keeps its warning until the owner
  corrects the stored unit; nothing is hidden meanwhile.
- Once the owner has set `unit` to `g/dL` beside the printed `rawUnit` `%`,
  the warning is gone: the unit checks read the stored `unit`, not `rawUnit`
  (`unitForChecks`), and `%` is still shown as printed. A `%` with no stored
  `unit` still warns.
- The same holds for the absolute differential counts (751-8, 731-0,
  742-7, 711-2, 704-7, `x10^3/uL`) on this lab's reports: they print no
  reference range, the "Normals (%)" column belongs to the `%` rows, and
  `Missing reference range information` is the truthful answer. It is
  never cleared by inventing a range.
- A warning may be a faithful reflection of what the lab printed; it is a
  prompt to look, not a defect in the app.

## What would force revisiting

- LOINC adding a percent-property MCHC code, which would make the case a
  wrong-code repair like [mass versus molar](../units.md#mass-versus-molar-is-a-code-error).
- A confirm-and-apply UI for owner-approved unit relabels across the app,
  which would give the correction above a home inside it.
