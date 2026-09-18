# Monitoring Panels views

The grid (`PanelsGridView.tsx`, the default route `#panels`) and Panel Detail
(`PanelDetailView.tsx`, `#panel/<id>`). The data behind them is in
[`reference-data.md`](reference-data.md#panels-panelsjson-monitoring-panelsjson);
the tables Panel Detail renders are in [`results-tables.md`](results-tables.md).

## Grid

Under a toolbar sit status filter toggles (`StatusFilterBar.tsx` — a
`StatusToggle` per status with the count of chips in it; `useState` in the
view, never stored; logic in `statusFilter.ts`), a "Compact view" switch and
a search box matching panel names and, through `observationMatchesQuery` /
`indexMatchesQuery` (`markers.ts`), their markers and indices.

Each card: icon disc and tint from `panelMeta.ts`, a marker count in the
top-right corner, "N of M markers" while a status is off, the panel's
observations and, below a divider, its computed indices — both as white chips
dot-colored by status — and a "View panel →" link. The grid's status dots
come from `resultsLookup.ts`'s `latestEntryByLoinc(entries, { numericOnly:
true })`, the one "newest reading per LOINC" fold. A status switched off hides
its chips in every card; an Indices section left empty is dropped; a card
left with nothing stays in place with "No markers match".

Compact view is the grid's one stored preference — `compactPanels` in
`bloodtests_view_settings_v1`, beside `unitSystem` and `sampleLimit`, owned by
the shell and carried through Clear all data and the backup's `settings.json`
— and shows each chip's `shortName` instead of its `friendlyName`, drops the
Observations / Indices labels and the panel link, and narrows the columns
(`.mc-panels-grid--compact`).

## Panel Detail

Header: a round back-chevron button (to the grid), the panel's icon disc in
its tint, and its title over the panel description — a plain `<h1>`, not the
`PageHeader` banner. Leaving through that chevron or the browser's Back
restores the grid's scroll position: an in-memory, unpersisted
`savedPanelsScrollY` module variable in `MedicalConditionsPage.tsx`, captured
in `navigate()` on the `panels` → `panel` transition and restored, deferred
one `requestAnimationFrame`, by a `useEffect` keyed on the route transitioning
back — the same route state whether Back came from `pushState` or the native
`popstate` — so only a fresh page load opens at the top.

Tabs (`TabBar`): Results (default), Trends, What's in range.

- **Results** renders one `ResultsTable` in a `Card` under the `ControlsBar`
  — the panel select present but disabled, since a control that vanishes
  between views makes the bar jump; the marker box filters the panel's own
  tables ([`results-tables.md`](results-tables.md)).
- **Trends** (`TrendsView.tsx`) focuses on individual analyte trajectories and
  data provenance ([task-0027](../tasks/task-0027.md)). It renders key marker
  summary cards with sparklines and deltas, an interactive timeline chart with
  laboratory-specific reference bands and unit selection, and a chronological
  results history table. While Trends is active, the panel header displays the
  interactive, header-scoped date-range control ([ADR-0024](decisions/adr-0024-panel-date-range-is-header-scoped-and-explicitly-applied.md)).
- **What's in range** is a `React.lazy` import behind a `<Suspense>`, so
  uPlot loads on first visit ([`charts.md`](charts.md)).

Selecting an index row marks each input observation with an accent • in a
fixed 10px gutter left of its name, and selecting an observation marks each
index that uses it; the gutter is reserved on every row so names never shift.
`markers.ts`'s `panelDates` lists a panel's results-table dates, shared with
the pathway pages' date steppers.
