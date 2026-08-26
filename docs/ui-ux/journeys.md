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
- **Screens (in order):** Monitoring Panels → panel detail (Analysis
  tab)
- **Branches:** "What's in range" tab shows a normalized-overlay chart
  (every marker as % of its own reference range, plus the panel's
  computed indices normalized against their own ok/warn/bad
  cut-points) instead of the values table
- **Exit / success:** viewer sees an observation's historical values
  and reference range

## Load data

Get lab results into the app — real or synthetic.

- **Entry:** Get Started
- **Screens (in order):** Get Started (Upload JSON or Generate Test Data)
  → Monitoring Panels / All Observations
- **Branches:** invalid JSON shows an inline parse error; Clear (with
  confirm) wipes all sessions
- **Exit / success:** panels and tables populate; uploads and
  generated data coexist (merged by session id)
