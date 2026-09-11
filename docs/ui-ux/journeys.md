# Journeys

Multi-screen paths — onboarding, first-add → save, recovery
flows. One section per journey while the list is short.

Starts as this flat file. Extracts to `journeys/<journey>.md` when
journeys accrue their own branch tables, screen-by-screen notes,
or open questions — see
[`../README.md#section-file-folder`](../README.md#section-file-folder).

For the journey concept and how it relates to screens, see
[`README.md`](README.md).

Every journey starts from the section nav: from 768px up a left sidebar
under a top bar, on a phone the wrapping top nav. Both list the same
eight sections in the same order — Get Started, Diagnostic Reports, All
Observations, Monitoring Panels, Scheduled Visits, Medications,
Reference Book, Account (the sidebar pins Account to its foot) — and
both grey out Monitoring Panels and All Observations while a diagnostic
report has errors.

## Browse a monitoring panel

Entry point → panel detail, with a historical values table.

- **Entry:** Monitoring Panels (panel grid; a "Search markers or
  panels…" box narrows the cards)
- **Screens (in order):** Monitoring Panels → panel detail (Results
  tab), opened from a card's header or, outside Compact view, its "View
  panel →" link
- **Branches:** on the grid, the status filter toggles (In range,
  Borderline, Out of range, Not tested, each with its count) hide the
  chips of any status switched off, and a
  card's count becomes "N of M markers"; the filters are not
  remembered. "Compact view" switches the chips to short names and drops
  the section labels and "View panel →" link to fit more cards, and is
  remembered
- **Branches:** the Results tab shows one table — observations, then
  the panel's computed indices under an "Indices" divider row — with
  the controls bar (unit system, sample limit, a disabled panel select,
  marker search) above it; the other tabs carry no controls bar
- **Branches:** on the Results tab, selecting an index row marks each
  of its input observations with a • left of the name; selecting
  an observation marks each index that uses it
- **Branches:** the Results tab's "Scheduled" column (right of the
  table) toggles a row into the global scheduled set with one click;
  scheduling an index also schedules its inputs, and an index reads
  scheduled once all its inputs are. Its header picks the month the
  schedule is for (a label on the one set, not a filter over it) and
  selects or clears every observation row the table is showing at once,
  the indices then following their inputs
- **Branches:** "Trends" tab is a placeholder for now
  ([task-0014](../tasks/task-0014.md))
- **Branches:** "What's in range" tab shows a normalized-overlay chart
  (every marker as % of its own reference range, plus the panel's
  computed indices normalized against their own ok/warn/bad
  cut-points) instead of the values table
- **Branches:** "Charts" tab shows the panel's markers as a 3D
  stacked-ribbon chart (one marker per depth plane, each normalized to
  its own observed range; checkbox picker up to 8 markers; From / To
  year selects listing only the years the data has, plus Translucent
  and Reset view; drag to rotate, scroll to zoom)
- **Exit / success:** viewer sees an observation's historical values
  and reference range

## Load data

Get lab results into the app — real or synthetic.

- **Entry:** Get Started
- **Screens (in order):** Get Started (Import JSON — replaces — or
  Generate Test Data — merges, then lands on All Observations' "What's
  in range" tab, `#all/in-range`) → Monitoring Panels / All
  Observations; or Get Started → Diagnostic Reports ("Add a report":
  copy the chatbot prompt, build a JSON with a chatbot, Add — merges)
- **Branches:** invalid JSON shows an inline parse error; Clear (with
  confirm, on Diagnostic Reports' "Clear local DB" danger card, beside
  "Back up your database") wipes all sessions
- **Exit / success:** panels and tables populate; uploads and
  generated data coexist (merged by session id)

## Plan a lab visit

Turn ticked rows into a costed order.

- **Entry:** the Scheduled column on Panel Detail's Results tab or on
  All Observations
- **Screens (in order):** Monitoring Panels → panel detail, or All
  Observations (tick rows, pick the month in the column header) →
  Scheduled Visits
- **Branches:** with nothing ticked, Scheduled Visits says so and points
  back to the Scheduled column; a row's name opens its observation
  popup
- **Exit / success:** one row per scheduled observation with a price
  column per laboratory — a bundle priced on its first row and marked
  "in <label>" on the rest, "—" where a laboratory does not sell it —
  over a Total row per laboratory that counts what it could not price,
  the cheapest total tinted green and marked "Cheapest"

## Record medications

Note what was taken, at what dosage, month by month.

- **Entry:** Medications
- **Screens (in order):** Medications (Edit → Add medication / Add past
  year, tick the months taken → Done)
- **Exit / success:** a medication / dosage table with a Jan–Dec month
  grid per shown year; every change is kept at once

## Back up, restore or clear everything

Move all of a browser's data out, back in, or away.

- **Entry:** Account
- **Screens (in order):** Account, three cards — "Export all data"
  downloads one zip (lab reports, medications, scheduled visits,
  laboratory prices, settings, manifest); "Import all data" reads such a
  zip back after a confirm; the "Clear all data" danger card, after a
  confirm, removes everything this app stores in the browser
- **Branches:** a zip that fails validation changes nothing; parts
  missing from the zip are left empty, and laboratory prices are never
  restored
- **Exit / success:** the result is reported per part
