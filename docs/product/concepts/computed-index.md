# Computed index

A ratio or estimate the product derives from one or more observations' results on the same [lab report](lab-report.md) -- not a value any lab measured directly.

## Identity

- **Formula** -- a fixed function of one or more observations' values (e.g. TC / HDL, or the Vermeulen equation for calculated free testosterone).
- **Cut-points** -- two thresholds plus a direction (lower-or-higher-is-better) that classify a computed value into one of three zones: ok / warn / bad.
- **Panels** -- which [monitoring panels](monitoring-panel.md) show this index; unlike an observation, an index is defined with its panel membership built in, not derived from panel LOINC lists.
- **Meaning / consensus / evidence level / references** -- the clinical interpretation and citations shown alongside the computed value.

## What it is not

- **Not an observation** -- it has no LOINC of its own in general. A handful (e.g. TC/HDL ratio, transferrin saturation) happen to also be a quantity a lab can independently report under its own LOINC; when that lab-reported value exists, it's shown as a secondary comparison, never as the source of the table value -- the table always shows what the product calculated.
- **Not stored** -- nothing about a computed index is persisted. It's recalculated from the underlying observations' results every time it's displayed.

## Where it lives today

`INDEX_DEFS` in `web/src/data/computedIndices.ts` (formula, cut-points, unit conversion, clinical text), rendered per panel in `MedicalConditionsPage.tsx`. Ported from `project-bloodtests-v2`'s `engine/src/indices/*.ts`; indices requiring age or sex (eGFR, FIB-4) were left out -- v3 has no user profile to source them from.
