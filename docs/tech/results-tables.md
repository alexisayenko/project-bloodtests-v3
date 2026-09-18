# Results tables

`ResultTables.tsx`'s one `ResultsTable` is what Panel Detail's Results tab and
All Observations' both render, in a `Card` with a muted uppercase header band:
observations, then an "Indices" divider row (an overline label and a hairline
spanning only the table's own columns) and the indices, each dated reading's
status a soft tint behind the number rather than across the cell.

## Cells and units

The number and its unit label always move together: `resultCells.ts`'s
`displayedResult` / `sharedUnit` / `buildRowCells` label a reading with its
own code's unit, and a row whose readings sit on two scales loses its
row-level unit and labels each cell instead — with two spellings of one unit
folded to one label by `sameUnitScale` ([`units.md`](units.md)). A cell's
first press selects the row and arms that cell; a second press on the armed
cell opens the result popup (`Popup.tsx`), which names the analyte, the date
and place, value, unit and reference. The observation popup's latest value
and the index popup's reported value come from `latestEntryByLoinc(entries, {
numericOnly: true })`. `popupPosition`'s left clamp goes negative below a
~396px viewport for the 380px index popup — open in
[task-0015](../tasks/task-0015.md).

## Controls bar

`ControlsBar.tsx` is one row of four labelled groups that wraps rather than a
second row: a "Show observations from" panel select, a "Find a marker" box,
the unit system (an SI / US `SegmentedControl`) and the sample limit (5 / 10 /
15 / All). It holds no state: each view keeps its filters in `useState` and
passes them down, deliberately not lifted to the shell, which owns the
*persisted* settings (`unitSystem`, `sampleLimit`, `compactPanels` in
`bloodtests_view_settings_v1`) — a filter living there invites persisting it,
and a stored filter could go on hiding rows with nothing on screen to say why.
The bar renders inside the Results tab in both views, under the heading and
the `TabBar`, and no other tab shows it.

In All Observations the panel select narrows the rows to one Monitoring Panel:
both the panel's codes and the rows fold through `ALIAS_TO_PRIMARY`
(`panelRowLoincs`, `markers.ts`) so a reading matches its panel whichever of
its codes the lab used. The text pass (`observationMatchesQuery` /
`indexMatchesQuery`) matches the short name, the friendly and LOINC names,
every LOINC the row answers for and every `rawName` a lab printed for it, so
a Cyrillic printed name finds its row. The indices under the observations are
scoped the way Panel Detail scopes them — the selected panel's indices, or
the union over the panels on offer, so a share link's `showPanels` allowlist,
which limits the panel options but never the observation rows, does narrow
the indices.

Date headers use `data/months.ts` (`formatMonthYear`, "Aug 26"), the one home
of the ISO `YYYY-MM` month key, read off the string rather than through a
`Date`.

## Frozen column and the mobile reveal

The marker-name column is frozen on every screen size — the real first
column, held by `position: sticky` at the left edge so it cannot drift out of
line with the rows — and picks up an edge shadow (`.mc-col-cut`, driven by
`TableScroller.tsx`'s own scroll tracking) once the table is scrolled under
it; Medications' Medication column uses the same treatment.

`TableScroller.tsx` wraps every results table. On mobile only — `useIsMobile`
(`web/src/hooks/useIsMobile.ts`) reading the stylesheet's own `max-width:
767px` as `MOBILE_QUERY`, so the JS-mounted overlays exist exactly where the
CSS placing them applies — it parks the marker-name column and the date
header row at a 5px sliver each, opened by a pull (`usePullReveal.ts`:
follows the finger, commits past 40% of the remaining travel, springs back
otherwise, and takes a sub-6px gesture as a tap on the sliver) and, for the
dates, by a thumb-sized "Dates" chip, which is the control people are meant
to find. The column's sliver is a negative offset on the same sticky `left`;
the header has to be a copy — vertical sticky would resolve against the
scrolling box rather than the page — kept aligned by rendering the same
`colgroup` and `thead` (over `resultCells.ts`'s shared `RESULT_TABLE` and
`LABEL_COL_WIDTH`) in a fixed box of the same width with the horizontal
scroll mirrored onto it. Nothing is conditionally rendered, so the real header
and labels keep their place in the accessibility tree. The header handle
carries no `touch-action` and claims each `touchmove` only in the direction
that moves the panel, so a page scroll begun on it still scrolls.

The nav joins in: `useHideOnScroll.ts` slides it off going down the page and
back going up, and `NavBar` publishes its height as `--mc-nav-h` /
`--mc-nav-offset` so a revealed header parks under it rather than behind it.

Still open from [task-0015](../tasks/task-0015.md): the per-cell tap that
would name one cell's date and analyte, and the popup clamp above. The reveal
(`TableScroller`, `usePullReveal`, `useHideOnScroll`, `useIsMobile`) has no
tests yet.

## Scheduled columns

Both tables carry a Scheduled block: one column per scheduled visit (stable
order, by creation), each a single-click toggle per row (a visually hidden
native checkbox, ✓ in the primary teal), plus a trailing "add a visit" column
— a + button calling `onAddVisit`, always present, even with zero visits; a
table with nothing scheduled renders no visit columns at all rather than a
phantom default one. Each visit's column header (`ScheduleHeader.tsx`) is
controls only, named through `aria-label`: a `MonthSelect` (`.mc-field-sm`;
this month and the next 23, plus a stored month that has fallen outside that
window) scoped to that one visit, and a remove button that drops the whole
visit. The cascade rules and storage are in
[`scheduling-and-visits.md`](scheduling-and-visits.md).
