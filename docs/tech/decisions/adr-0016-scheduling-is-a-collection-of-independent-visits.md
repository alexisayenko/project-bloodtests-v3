# ADR-0016: Scheduling is a collection of independent visits, not one global schedule

Status: accepted · 2026-09-13

## Context

Scheduling started as a single global object: one set of scheduled LOINCs,
one set of scheduled computed-index keys, one optional target month, one
optional laboratory selection — `{loincs, indices, month?, selectedLabId?}`,
stored whole under `bloodtests_scheduled_v1`. It answered exactly one
question: "what am I planning to order, and where." Every "Scheduled" column
in the results tables and the whole `#plan` page pointed at that one object.

That model cannot represent planning more than one draw at a time. A second
blood draw already on the horizon — a different month, a different
laboratory, an unrelated set of markers — had nowhere to go without either
overwriting the first draw's plan or inventing an ad-hoc second field that
the rest of the app would need special-casing to read. The single object was
also already stretched by the two fields that do not describe "what to
order" at all — `month` and `selectedLabId` — each of which is really a
property of one draw, not of scheduling as a whole.

## Decision

**Scheduling is a list of independent `ScheduledVisit` entries, each
carrying its own `id`, `loincs`, `indices`, optional `month` and optional
`selectedLabId`.** Storage becomes `{visits: ScheduledVisit[]}` under the
same `bloodtests_scheduled_v1` key.

- **A visit is the unit of everything.** Toggling an observation or a
  computed index, deriving an index from its scheduled inputs, setting a
  month, and picking a laboratory (`scheduled.ts`'s `toggleRow`,
  `toggleIndex`, `setScheduleMonth`, `setSelectedLab`) all take a `visitId`
  and act on that one visit's fields alone. No state is shared or read
  across visits — scheduling a marker in one visit has no effect on any
  other visit's rows, month, or lab selection.
- **A visit's `month` labels that visit's own schedule; it does not
  partition anything.** It answers "these are the tests I plan to order in
  March 2027" for that one visit. Changing it leaves every row checked in
  that visit checked — there is no cross-visit month axis, and no notion of
  "this visit's rows for this month" versus another month's.
- **The results tables render one Scheduled column per visit**, side by
  side in stable creation order, plus a trailing "add a visit" column; zero
  visits renders no visit columns at all, not a phantom empty default one.
  `#plan` mirrors this as one stacked section per visit, each with its own
  table, its own per-laboratory prices (`data/visitPlan.ts` and
  `quoteSchedule` called once per visit, scoped to that visit's own
  `loincs`), and its own laboratory radio group — a lab picked for one
  visit has no bearing on any other visit's prices or product-name
  substitution.
- **Row identity for scheduling stays keyed by analyte, not by visit.** A
  row's alias LOINCs (`withSiblings`) and an index's input LOINCs are
  resolved the same way regardless of which visit is asking; only the
  membership test — "is this LOINC in *this* visit's `loincs`" — is
  visit-scoped.
- **Migration is lossless and one-way.** A payload stored before this
  redesign — one schedule object with no `visits` array — is read as
  exactly one visit on load, carrying its `loincs`/`indices`/`month`/
  `selectedLabId` over as-is under a freshly generated id
  (`parseScheduled` in `scheduled.ts`). A stored payload that was itself
  fully empty (no rows, no indices, no month, no lab) migrates to an empty
  visit list instead of manufacturing a pointless empty visit. The same
  migration applies wherever the old shape can appear — a live
  `localStorage` value, an Account backup's `scheduled-visits.json`, or a
  legacy stray `lab` key (from an even earlier, already-removed laboratory
  picker), which is still just ignored on load like any unknown field, in
  both shapes.

## Alternatives considered

- **Keep one global `Scheduled` object and bolt on a second, ad-hoc slot**
  (e.g. a `nextVisit` field beside the existing one) for a second draw.
  Rejected: it only ever answers "how many draws am I currently planning"
  for whatever number of slots got hand-added, every view that reads
  scheduling state would need to know about each slot by name, and a third
  draw would repeat the problem instead of solving it.
- **Model visits as a map keyed by month** (one schedule per `YYYY-MM`).
  Rejected: it conflates "when" with "which visit," forces every visit to
  have a month before it can exist, and cannot represent two visits planned
  for the same month or one visit with no month decided yet — both of which
  the actual UI needs (a fresh "add a visit" click has no month at all).
- **A single schedule with a free-form list of "extra" rows tagged by an
  arbitrary visit label.** Rejected as the least structured option: it
  reintroduces exactly the one-object-many-concerns problem this ADR
  removes, just moved one level down, with no schema to keep a row's tag,
  month, and lab selection consistent with each other.

## Consequences

- Every caller of scheduling state now takes a `visitId`: `RowScheduling`
  and `IndexScheduling` (handed to the results tables) are one-per-visit
  values rather than one shared value, and `useScheduled` exposes
  `onAddVisit`/`onRemoveVisit` alongside the existing per-row/per-index
  callbacks.
- The results tables and `#plan` both grew multi-column/multi-section
  layouts where each previously rendered exactly one. `#plan`'s empty state
  now has to explain where the add/remove controls actually live (the
  results tables' Scheduled columns), since a page with nothing scheduled
  has nothing of its own to attach an "add" control to.
- A visit's month is genuinely just a label: nothing in `scheduled.ts` ever
  reads one visit's month to decide what another visit contains, and no
  code partitions the stored rows by month. `MonthSelect` (extracted so the
  same picker backs both the results-table column header and the `#plan`
  "Planned for" pill) only ever calls `onSetMonth(visitId, month)`.
- Removing a visit (`removeVisit`) drops everything it had — rows, indices,
  month, lab selection — with no effect on any other visit; there is no
  "undo" or trash for a removed visit.
- The showcase test-data generator and the Account backup/restore paths
  both moved to the visits-list shape; a backup restore's summary line now
  names the visit count instead of implying a single schedule.

## What would force revisiting

- A need for cross-visit interaction — for instance, warning that the same
  marker is scheduled in two visits close together, or sharing a laboratory
  selection across visits by default — since the model deliberately gives
  visits no shared state to hang that on today.
- A real per-visit identity beyond an opaque id — for instance naming a
  visit for a specific person once multi-user support exists — which would
  add a field but should not change the "each visit is fully independent"
  shape this ADR establishes.
- So many visits that "one column per visit" stops being a usable table
  layout, which would need a different presentation (e.g. a visit picker)
  without necessarily changing the underlying collection model.
