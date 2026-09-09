# Journeys

Multi-screen paths — onboarding, first-add → save, recovery
flows. One section per journey while the list is short.

Starts as this flat file. Extracts to `journeys/<journey>.md` when
journeys accrue their own branch tables, screen-by-screen notes,
or open questions — see
[`../README.md#section-file-folder`](../README.md#section-file-folder).

For the journey concept and how it relates to screens, see
[`README.md`](README.md).

## Browse a monitoring panel

Entry point → panel detail, with a historical values table.

- **Entry:** Monitoring Panels (panel grid)
- **Screens (in order):** Monitoring Panels → panel detail (Results
  tab)
- **Branches:** on the Results tab, selecting an index row marks each
  of its input observations with a blue • left of the name; selecting
  an observation marks each index that uses it
- **Branches:** the Results tab's "Scheduled" column (right of both
  tables) toggles a row into the global scheduled set with one click;
  scheduling an index also schedules its inputs, and an index reads
  scheduled once all its inputs are. Its header picks the month the
  schedule is for (a label on the one set, not a filter over it) and
  selects or clears every row the table is showing at once
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
  Generate Test Data — merges) → Monitoring Panels / All Observations;
  or Get Started → Diagnostic Reports ("Add a report": copy the chatbot
  prompt, build a JSON with a chatbot, Add — merges)
- **Branches:** invalid JSON shows an inline parse error; Clear (with
  confirm, on Diagnostic Reports' "Back up your database" card) wipes
  all sessions
- **Exit / success:** panels and tables populate; uploads and
  generated data coexist (merged by session id)
