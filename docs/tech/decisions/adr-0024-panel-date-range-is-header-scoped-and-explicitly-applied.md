# ADR-0024: The panel date-range control is header-scoped and changes data only through an explicit binding

Status: accepted · 2026-09-18

## Context

Panel Detail needs one compact control for choosing how much longitudinal data
to inspect. The first home for it is Trends, where it will eventually constrain
the summary cards, selected-observation chart and history table together. A
normal select cannot show both the available years and how many laboratory
reports occur in each year; a permanently visible slider would consume space
needed by the chart.

The visual control has been approved before its filtering contract. Shipping
its placement must not accidentally make one part of the page show a different
time window from another, nor silently change the existing Results, What's in
range or Charts tabs.

## Decision

The range control sits at the far right of the Panel Detail header, on the same
row as the panel identity (for example, **Hypogonadism**). It appears while the
Trends tab is active. It is not a second application navigation bar and it does
not replace Paneloom's existing top bar or sidebar.

Its closed state shows `start year — end year` and a disclosure chevron. Its
popup is anchored below the trigger, right-aligned, and overlays the tab content
without reserving height or moving the chart. The popup contains:

- a summary of the selected year range;
- one horizontally scrollable timeline;
- calendar years below the line and the count of distinct laboratory reports
  above each year;
- two circular handles and an accent segment between them;
- earlier/later scroll buttons; and
- a **Show all reports** reset when the selection is narrower than the available
  history.

Years or their ticks are the hit targets. Clicking one moves the nearest handle;
the handles never cross. Horizontal dragging/scrolling moves the timeline, not
the handles. The trigger exposes `aria-expanded`, the popup is a labelled
dialog, every year announces its report count, Escape closes it, and clicking
outside closes it.

For the current increment the control is **presentational and locally
interactive only**: opening it, scrolling it and moving its displayed handles
must not filter any application data. `TrendsView` continues to receive the
complete `allResults` collection. Binding the range is a separate change that
must apply one shared interval atomically to the observation cards, main chart
and history table. Until that binding is implemented, the selection is not
persisted and must not affect the other Panel Detail tabs.

When binding is implemented, the number above a year means distinct imported
diagnostic reports that contain at least one result belonging to the current
panel, not the number of observation rows. The current placement prototype has
only panel dates available and may use those dates to draw its provisional
counts; the binding work must pass report/session identity into the control and
replace that approximation before counts acquire filtering semantics.

## Consequences

- The title row remains the single place to understand the panel and its active
  longitudinal window.
- Opening the picker cannot cause layout shift or reduce chart width.
- A partial integration cannot produce mismatched date windows across cards,
  chart and table: there is deliberately no data binding yet.
- The control's UI state is disposable on navigation or reload until a later
  decision explicitly chooses persistence.
- The future binding needs diagnostic-report identity, not only flattened
  `ResultEntry` rows, to label report counts truthfully.

## What would force revisiting this

- Product testing shows that a global range must also constrain Results, What's
  in range and Charts, in which case the state belongs above the tab views.
- Mobile testing shows the title row cannot hold a usable trigger; the trigger
  may wrap, but the popup must remain an overlay.
- The product chooses result-count presets (last 5 / 10 / 15) as a second
  selection mode. That mode needs an explicit contract for how it coexists with
  the year handles; it must not be inferred from the current timeline.
