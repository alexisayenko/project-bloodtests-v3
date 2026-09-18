# Charts

## Trends (lab-explore)

Panel Detail carries one Trends tab, on every panel including the All
Observations pseudo-panel. It is the merged "Trends" and "What's in range"
view: a normalized-overlay time chart with a Normalized / Absolute values
toggle, plus a scrollable row of marker summary cards and a result-history
table for whichever marker is selected.

Normalized mode plots every marker, and every panel's computed indices, as %
of its own reference range or ok-zone band on one shared axis, with a panel
picker (a marker or index shared across panels groups under every relevant
one), zoom, autoscale, and a "not taken" section that also names readings
dropped because their unit could not be placed on the series' band scale, and
an index whose sex-dependent band is unset. Absolute mode plots the same
markers in their own units.

The engine is v2's `<lab-explore>` web component, vendored as-is into
`web/src/vendor/lab-explore/` and `web/src/vendor/chart-kit/` (its
domain-agnostic uPlot-based charting engine), driven by the
`buildExploreModel` adapter in `exploreModel.ts` and mounted via
`TrendsView.tsx`, which is `PanelDetailView`'s Trends tab for every panel —
the All Observations pseudo-panel passes every visible condition and no
`currentPanel`, a single panel passes just its own tests. `TrendsView` also
renders a `MedicationLane` under the plot — the medication history as bars
from `medicationBars.ts`'s `buildMedicationBars`, omitted when there are no
medications ([task-0053](../tasks/task-0053.md)). Reference-band overrides and
data-quality flagging are not built.

`placeOnBandScale` puts every reading on the unit its reference band is
expressed in — mass↔molar included, via the factor derived from
`molar-masses.json` — so a history that switched scales mid-decade plots as
one line; the converted number reaches this chart's in-memory series and
nowhere else ([ADR-0003](decisions/adr-0003-store-only-what-the-lab-printed.md)),
and a reading that cannot be placed exactly is dropped and named rather than
plotted on the wrong scale.
