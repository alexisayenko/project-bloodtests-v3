# ADR-0020: Physical constants come from our cited reference data; external calculators are cross-checks, not gold standards

Status: accepted · 2026-09-16

## Context

[task-0047](../../tasks/task-0047.md) set out to cross-check `cft`
(calculated free testosterone, Vermeulen) and `biot` (bioavailable
testosterone) against an independent implementation Alex named as
validated: ISSAM's Free & Bioavailable Testosterone calculator
(<https://www.issam.ch/freetesto.htm>). The expectation was that the app
would be tested *against* it — its output the gold, ours the thing under
test.

The two did not agree exactly. Eight cases Alex ran through the live
calculator by hand and recorded all came out slightly apart from the app,
by up to 0.77% relative, almost always with the app a little below
issam.ch. Reading the calculator page's own script explained it: it
implements the same Vermeulen model with the same binding constants
(Kt 1e9 L/mol, Ka 3.6e4 L/mol), but

- converts total testosterone from ng/dL as **T / 2.8 × 1e-10** mol/L —
  a testosterone molar mass of about **280 g/mol** — where the app
  derives **288.431 g/mol** from C19H28O2 in
  `web/public/data/molar-masses.json` (PubChem CID 6013,
  [ADR-0011](adr-0011-molar-masses-are-data-factors-are-derived.md)), and
- converts albumin at a rounded **1.45e-4 mol/L per g/dL** instead of
  the model's own 69 kDa convention (1/6900, ≈ 1.4493e-4),
- and displays only three significant figures.

With those two constants swapped into the app's code in a throwaway
experiment (reverted), the app matched the calculator's display digit for
digit — so the formula was right and the gap was entirely the
calculator's constants. ISSAM's own published worked example
(<https://www.issam.ch/freetesuit.htm>, T 10 nmol/L, SHBG 40 nmol/L,
albumin 4.3 g/dL) is worked in molar units and so sidesteps the
conversion; the app reproduces it to the five significant figures the page
prints (it also carries two typos, a 48.86e9 denominator for 2 × 23.43 and
FT multiplied by 288.5, which were not copied). The discrepancy was
reported to ISSAM by email on 2026-09-16.

The same afternoon, the Hormonal Pathways page wanted to show *why* its
Free T differs from what a user would get on issam.ch, which raised the
question of whether the app should simply use 280 g/mol and agree.

## Decision

**Physical constants come from the app's own cited reference data. An
external calculator, however reputable, is a cross-check of the formula,
never the source of a constant, and its known deviations are documented
rather than adopted.**

- **The molar mass is `molar-masses.json`'s.** `cft`, `biot`, the % indices
  and `testosteronePools` all place testosterone at 288.431 g/mol — the
  index engine through its derived unit conversions, the pools through
  `indexDefs.ts`'s exported `TESTOSTERONE_MOLAR_MASS` (`molarMassOf`) —
  never a typed number.
- **A published worked example is an exact anchor.** Where a reference
  implementation prints its working, the app is tested against it at the
  precision the source prints — ISSAM's worked example at 0.05% relative,
  its own `describe` block in `web/test/computed-indices.test.ts` — and a
  typo in that working is noted, not reproduced.
- **A live calculator gets a tolerance equal to its known deviation, with
  the cause written beside it.** The eight recorded issam.ch cases are
  asserted at 1% relative (largest observed 0.77%), and the test comment
  and task-0047 name the 280 g/mol and 1.45e-4 constants as the reason. A
  tolerance with no stated cause is not allowed: it would equally hide a
  real formula error of the same size.
- **A reference implementation's shortcut is never copied into production
  code.** Matching an external tool is not a reason to change a constant
  whose value is cited.
- **A page-level override is allowed only as an explicit, labelled
  cross-check aid.** The Hormonal Pathways page's "Testosterone molar mass"
  select offers "288.4 g/mol (PubChem)", the default, and "280 g/mol
  (issam.ch calculator)", so a user can reproduce the calculator's figures
  on screen. It feeds `testosteronePools`' optional `solveMolarMass`
  argument, which changes only the total T fed to the Vermeulen quadratic;
  it lives in that view's `useState`, is not persisted, is not exported or
  backed up, and changes nothing outside that page — the grid, the tables,
  the Trends chart and the Reference Book always use the cited mass.

## Alternatives considered

- **Adopt 280 g/mol to match ISSAM.** Makes every recorded case agree and
  lets the test be tight, but it replaces a formula-derived, cited mass
  with an undocumented rounding, reverses ADR-0011 for one analyte, and
  shifts every testosterone conversion in the app — including the
  mass↔molar conversions that have nothing to do with free T — by ~3% to
  match one website. If ISSAM fixes its script, the app would then be
  wrong on its own.
- **A loose tolerance without explanation.** Passing at 1% while saying
  nothing about why is indistinguishable from a formula that is 1% wrong;
  the next reader could neither tighten it when ISSAM changes nor tell a
  real regression from the known gap.
- **Drop the ISSAM cross-check.** The only external check the Vermeulen
  implementation has. It independently confirmed the model and both
  binding constants, and the discrepancy it surfaced was itself useful —
  enough to report upstream. The worked example is exact, which is a
  better anchor than the internally-derived golds alone.

## Consequences

- The test suite has two layers of external evidence with different
  strictness, each saying why: the worked example exact, the live cases at
  1% with the cause in the comment.
- `testosteronePools(totalT, shbg, albumin, solveMolarMass?)` carries an
  optional molar mass whose only production caller is the Pathways page's
  cross-check select; a `testosteronePools with issam.ch's 280 g/mol solve`
  test block pins its behaviour.
- A user comparing the app with issam.ch sees a small, explained
  difference, and can make it vanish on the Pathways page without the app
  ever storing or propagating the other number (ADR-0003's rule that a
  derived value is display-only holds for the override too).
- `cftlh` (Ly & Handelsman) still has no external calculator check —
  issam.ch implements Vermeulen only — so its evidence is the coefficients
  reprinted identically in three open-access papers (Han 2020 Thorax,
  Pavey 2023 BMJ Open Respiratory Research, Han 2021 Annals of Allergy,
  Asthma & Immunology).

## What would force revisiting

- ISSAM correcting its script: re-record the live cases, tighten the
  tolerance, and consider dropping the "280 g/mol (issam.ch calculator)"
  option, which would then reproduce nothing.
- A second reference calculator that disagrees with both, which would make
  "document the deviation" a per-tool table rather than one comment.
- A guideline or major laboratory that explicitly specifies a different
  testosterone molar mass for its reported figures — at that point the
  convention is itself citable data and belongs in `molar-masses.json` as
  a `conventional` basis, not in a calculator shortcut.
