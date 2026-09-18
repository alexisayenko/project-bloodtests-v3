# Charts

Two chart engines, both lazy-loaded on first visit
([`monitoring-panels.md`](monitoring-panels.md#panel-detail)).

## "What's in range" (lab-explore)

Panel Detail and All Observations each carry a "What's in range" tab. In All
Observations the tab is part of the route — `#all/in-range`, `#all/trends`,
bare `#all` for Results, an unknown segment falling back to it — and
switching tabs pushes history the way section navigation does.

It is a normalized-overlay time chart: every marker, and every panel's
computed indices, plotted as % of its own reference range or ok-zone band on
one shared axis, with a panel picker (a marker or index shared across panels
groups under every relevant one), zoom, autoscale, and a "not taken" section
that also names readings dropped because their unit could not be placed on
the series' band scale, and an index whose sex-dependent band is unset.

The engine is v2's `<lab-explore>` web component, vendored as-is into
`web/src/vendor/lab-explore/` and `web/src/vendor/chart-kit/` (its
domain-agnostic uPlot-based charting engine), driven by the
`buildExploreModel` adapter in `exploreModel.ts` and mounted via
`LabExploreView.tsx`. All Observations shares the chunk. `LabExploreView` also
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

## Charts tab (3D stacked ribbons)

Panel Detail's "Charts" tab (`PanelChartsView`) draws the panel's markers as
a 3D stacked-ribbon chart, one marker per depth plane, each normalized to its
own observed min/max so mixed units share one chart; alias LOINCs merge into
one series per test (canonical code = the test's `loinc`). A checkbox picker
selects up to 8 markers with stable per-marker colors (`palette.ts`), plus a
translucent/opaque toggle, a "Reset view" button, and From / To year selects
listing only the years the data has (a gap year stays absent; picking a From
past the To drags the other along, and the pair drives the engine's
`setRange` — out-of-window points are dropped before per-series
normalization). Drag to rotate, wheel/pinch to zoom, double-click to reset;
the time axis stretches to the page width (the room's x half-extent is fitted
per draw so the projected room spans ~90% of the canvas; height fixed at
420px).

The engine (`web/src/components/analytics/chart3d-stacked-core.ts`,
`chart3d-camera.ts`) is ported from project-moodtracker's
`chart3d-stacked.js` / `chart3d-camera.js`, generalized to N series, its time
window either all or the explicit `setRange` interval.
`StackedBiomarkerChart3D.tsx` mounts it and `StackedBiomarkerSection.tsx`
owns selection and the picker. Shared chart types (`LoincEntry`,
`BiomarkerNames`) live in `analytics/types.ts`.
