# Computed index

A ratio or estimate the product derives from one or more observations' results on the same [diagnostic report](lab-report.md) -- not a value any lab measured directly.

## Identity

- **Formula** -- a fixed function of one or more observations' values (e.g. TC / HDL, or the Vermeulen equation for calculated free testosterone).
- **Cut-points** -- two thresholds plus a direction (lower-or-higher-is-better) that classify a computed value into one of three zones: ok / warn / bad.
- **Panels** -- which [monitoring panels](monitoring-panel.md) show this index; unlike an observation, an index is defined with its panel membership built in, not derived from panel LOINC lists.
- **Meaning / consensus / evidence level / references** -- the clinical interpretation and citations shown alongside the computed value.
- **Validity range**, where the method has one -- a formula that only approximates over part of its inputs' range returns nothing outside it rather than a confidently wrong number. Friedewald LDL-C stops at TG 400 mg/dL, Sampson at 800; past that the row reads `–`, indistinguishable from a missing input, which is the intent.

## What it is not

- **Not an observation** -- it has no LOINC of its own in general. A handful (e.g. TC/HDL ratio, transferrin saturation) happen to also be a quantity a lab can independently report under its own LOINC; when that lab-reported value exists, it's shown as a secondary comparison, never as the source of the table value -- the table always shows what the product calculated.
- **Not stored** -- nothing about a computed index is persisted. It's recalculated from the underlying observations' results every time it's displayed.

## Two kinds under one heading

The 23 definitions in `INDEX_DEFS` are two different things, shown together under one "Indices" heading -- deliberately, the label stays:

- **Derived measurements** -- a concentration of a real analyte, arrived at arithmetically instead of by assay: `cft` (pg/mL, LOINC 103227-5), `vldl` (mg/dL, 13458-5), `nonhdl` (mg/dL, 43396-1), `ldlf` (mg/dL, 13457-7), `ldls` (mg/dL, no LOINC -- none exists for the Sampson method), `remnant` (mg/dL, no LOINC). A lab could equally have printed each of these as an observation.
- **Indices proper** -- ratios and scores, not quantities of a substance: HOMA-IR, AIP, TyG, TC/HDL, LDL/HDL, De Ritis, T/LH and the rest. Four of them carry a `%` unit (`fai`, `tsat`, `dhtt`, `homab`), so the discriminator is a *concentration* unit, not the presence of a `unit` field at all.

The distinction has one practical consequence: only a derived measurement can **collide with a lab-reported observation of the same analyte**, because only it names a quantity a lab also measures. Hence `cFT`: Free Testosterone is also measured directly (LOINC `2991-8`, badge `FT`), and the two rows have to be told apart. Nobody's lab prints a HOMA-IR.

The `c` prefix therefore marks a calculated value that has a routinely measured counterpart -- standard andrology usage, not a local invention. It is deliberately *not* applied to VLDL-C: there the lab's figure is a Friedewald estimate too, so the prefix would imply a method difference that doesn't exist; the real distinction is provenance (whose calculation), not method. The two calculated LDL-C rows show the other way of telling a collision apart: where the method *is* the point, it goes in the label -- `LDL-C (F)` and `LDL-C (S)` beside the lab's own `LDL-C` row, so a gap between them reads as a difference in formula rather than a change in the patient. One case complicates the rule -- `gi` (Glucose / insulin ratio) carries LOINC `62418-9` and does turn up as a lab-printed row in real data, so a ratio can collide too, just rarely.

## Where it lives today

`INDEX_DEFS` in `web/src/data/indexDefs.ts` (formula, cut-points, unit conversion, clinical text) — the definitions, split from the engine that runs them in `web/src/data/computedIndices.ts` (types, marker lookup, unit conversion, zones, `computeIndex`), which they import from one-directionally — rendered per panel by `PanelsGridView.tsx` (grid cards), `PanelDetailView.tsx` (the Indices table) and `AllObservationsView.tsx`, which renders the same table below its observations — the selected panel's indices, or the union over every panel on offer when none is selected, which is also how a share link's `showPanels` allowlist narrows them. Its unit-conversion constants are derived from the molar masses in `web/public/data/molar-masses.json` rather than typed out ([ADR-0011](../../tech/decisions/adr-0011-molar-masses-are-data-factors-are-derived.md)). An input is found by LOINC and then *placed* in the unit the formula declares: `MARKER_CANDIDATE_LOINCS` widens each marker's declared codes with the catalog's own unit and method variants, so a result recorded under a molar alias feeds the index its mass primary would have fed -- before that, a history whose cholesterol and glucose came in under their `[Moles/volume]` codes produced no Cardiovascular Risk index and no HOMA-IR at all. An input that cannot be placed in the expected unit is left out rather than passed through on the wrong scale, because no index is a better answer than a silently wrong one. Ported from `project-bloodtests-v2`'s `engine/src/indices/*.ts`; indices requiring age or sex (eGFR, FIB-4) were left out -- v3 had nothing to source age or sex from when they were ported. Database details has since gained `sex` and `birthYear`, so that reason no longer holds ([task-0004](../../tasks/task-0004.md) tracks using them).

On Panel Detail's Results tab and in All Observations an index can be scheduled (`scheduled.ts`) -- its scheduled state follows its inputs (on iff every input observation is scheduled; scheduling it schedules those inputs). Only Panel Detail draws the relation: selecting an index row there marks those inputs with a • beside their names.
