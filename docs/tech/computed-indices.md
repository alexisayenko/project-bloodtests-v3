# Computed indices

The clinical definitions live in `web/src/data/indexDefs.ts` (`INDEX_DEFS`:
formula, prose, bands and citations); the engine in
`web/src/data/computedIndices.ts` (`computeIndex`, `convertUnit`,
`indexBands` / `indexZone`, `INDEX_UNIT_PAIRS`). `indexDefs.ts` imports the
engine's types one-directionally, with no re-export back, so no cycle forms.
Product-level: the [computed index](../product/concepts/computed-index.md)
concept; constants policy:
[ADR-0020](decisions/adr-0020-constants-from-cited-data-calculators-are-cross-checks.md).

## Inputs

An index reads its inputs through `MARKER_CANDIDATE_LOINCS`, which expands
`MARKER_LOINC` through the catalog's derived alias maps and places each value
in the formula's unit or declines it, so a molar-coded history computes the
same indices a mass-coded one does. Mass↔molar factors are derived from
`molar-masses.json` for the unit pairs declared once in `INDEX_UNIT_PAIRS`
([`reference-data.md`](reference-data.md#molar-masses-molar-massesjson)).

An index that would be wrong outside its validity range returns `null` and
renders as "–" rather than a confident number. A citation may carry an ISO
`retrieved` date, shown in the Reference Book as "· retrieved <date>".

## Bands and status

An index carries `cut` / `hi`, or `bandsBySex` in place of them. `indexBands`
/ `indexZone` pick the band from a `SubjectProfile` whose `sex` comes from
Database details (`bloodtests_envelope_meta_v1`); `birthYear` is not read.
With sex unset a sex-banded index has no band and so no status — a grey chip
in the grid, an uncolored number in the tables, "depends on sex, not set" as
the popup's Ref, and "sex not set" in the Trends tab's not-taken list. The
Reference Book, having no profile, names both bands. An index with neither
`cut` nor `bandsBySex` is deliberately band-less and never has a status.

## Cardiovascular Risk: LDL-C estimates

Three calculated LDL-C estimates, each `null` outside its own validity range:

| Key | Method | LOINC | Invalid when |
| --- | --- | --- | --- |
| `ldlf` | Friedewald | `13457-7` | TG ≥ 400 mg/dL |
| `ldls` | Sampson / NIH equation 2 | none exists | TG > 800 mg/dL |
| `ldlmh` | Martin-Hopkins | `96259-7` | TG outside 7–13975 mg/dL |

Martin-Hopkins looks up an adjustable divisor from the strata table shipped as
`martin-hopkins-ldl-table.json` rather than Friedewald's fixed TG÷5. The
Lipid Transport page's merged LDL-C badge shows the lab's LDL-C on its face,
else Martin-Hopkins marked as calculated.

## Hypogonadism: testosterone

- `cft` (calculated free T, Vermeulen) and `biot` (bioavailable T, nmol/L)
  both solve the same Vermeulen quadratic (`vermeulenFreeT`); bio-T is
  free T × (1 + Ka·albumin). Albumin is an `optionalInputKeys` input on both:
  read when a same-draw reading places in g/dL, `DEFAULT_ALBUMIN_GDL`
  (4.3 g/dL) otherwise, never gating the index nor among its scheduled
  inputs. `ALB` converts g/L ↔ g/dL.
- `biot` carries `bandsBySex`: Mayo Clinic Laboratories' TTBS reference
  limits converted from ng/dL; the men's borderline band is the span Mayo
  calls low at 20–29 but normal at 60–69 ([task-0004](../tasks/task-0004.md)).
- `cftlh` — calculated free T by Ly & Handelsman.
- Four band-less testosterone shares of total, all `%`: `cftpct` and
  `cftlhpct` (calculated free T by Vermeulen / Ly & Handelsman), `ftpct`
  (LOINC `15432-8`, from measured free T `2991-8`, converting pg/mL and
  ng/dL ↔ pmol/L through derived factors) and `biotpct` (`6891-6`). Labcorp's
  1.5–3.2 % adult male interval belongs to equilibrium dialysis and is a
  single interval where a band needs a borderline, so it is quoted in prose
  only.
- `testosteronePools` solves the SHBG-bound, albumin-bound and free pools in
  one call; its optional `solveMolarMass` exists only for the Hormonal
  Pathways cross-check select (issam.ch's calculator solves at ~280 g/mol,
  documented as a deviation rather than adopted, ADR-0020,
  [task-0047](../tasks/task-0047.md)). `TESTOSTERONE_MOLAR_MASS`
  (`molarMassOf`) is exported beside it.

## Where indices render

- Monitoring Panels grid cards, below a divider, as status-dotted chips
  ([`monitoring-panels.md`](monitoring-panels.md)).
- Results tables, under an "Indices" divider row, in Panel Detail (the
  panel's indices) and its All Observations pseudo-panel (the selected
  panel's, or the union over the panels on offer)
  ([`results-tables.md`](results-tables.md)).
- The Trends tab and the pathway badges
  ([`charts.md`](charts.md), [`pathway-pages.md`](pathway-pages.md)).
- The Reference Book, one page per index with formula, prose and cited
  sources ([`reference-book.md`](reference-book.md)).

Scheduling an index schedules its inputs — see
[`scheduling-and-visits.md`](scheduling-and-visits.md).

## Tests

Golden-masters ported from v2; `cft` and `biot` held to ISSAM's published
worked example within 0.05% and cross-checked within 1% against fixtures
recorded from its live calculator (the tolerance being that calculator's
known deviation: T at ~280 g/mol and albumin at a rounded 1.45e-4 mol/L per
g/dL against the app's 288.431 and 1/6900); the 280 g/mol pool solve; the
four % indices; sex-dependent bands; Ly & Handelsman and Martin-Hopkins
golden-masters. See [`testing.md`](testing.md).
