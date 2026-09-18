# Scheduling and Scheduled Visits

A schedule is a list of independent visits
([ADR-0016](decisions/adr-0016-scheduling-is-a-collection-of-independent-visits.md)).
Logic in `web/src/components/conditions/scheduled.ts`; the page is
`PlanVisitView.tsx` (`#plan`, reachable while validation errors exist);
pricing in `web/src/data/labPricing.ts` and `visitPlan.ts`.

## Storage

localStorage `bloodtests_scheduled_v1` holds `{visits: ScheduledVisit[]}`,
each `{id, loincs, indices, month?, selectedLabId?}` (`id` from the same
`newRowId()` helper as medications and results rows). A payload with no
`visits` array — one schedule object — migrates transparently on load into a
list of exactly one visit carrying its `loincs` / `indices` / `month` /
`selectedLabId` under a fresh id, unless it was fully empty, which migrates
to an empty list. A `lab` key left by an earlier laboratory picker is ignored
on load like any unknown field and never written, backups included.

`useScheduled` is owned by the shell (`MedicalConditionsPage.tsx`) rather than
Panel Detail, which remounts per panel, and handed down as one
`RowScheduling` / `IndexScheduling` per visit plus `onAddVisit` /
`onRemoveVisit` / `onSetMonth(visitId, month)`.

## Cascade

In the results tables ([`results-tables.md`](results-tables.md#scheduled-columns)):
scheduling an index also schedules its input observations in that same
visit; unscheduling it leaves them; toggling an observation re-derives that
visit's own indices (scheduled iff all its inputs are, within that visit).
The same cascade runs in Panel Detail and All Observations, never
cross-wired into another visit's column. A visit's month labels its own
schedule, not a partition of it — switching months leaves every checked row
checked. Removing a visit unschedules everything it had.

## Scheduled Visits page

One tab per visit (`TabBar`, labeled by the visit's month via
`formatMonthFullYear`, "Mar 2027", or "No month" when unset) showing exactly
the active visit's section, defaulting to the first and falling back if the
active one is removed; a single visit renders directly with no tab strip.
Each section: a "Planned for" pill (`MonthSelect`, the same component the
table headers use, calling the same `onSetMonth`) and a table card.

The table lists every visit-local scheduled observation, folded to its
primary code, as one "Observation" cell — `friendlyName`, with the short name
in parentheses where it differs, opening the analyte popup — beside one price
column per laboratory in `laboratories.json`. `visitPlan.ts` (called once per
visit, scoped to its own `loincs`) prices a bundle on its first covered row
and marks "in <label>" on the rest; a Total row is that visit's own
`quoteSchedule` call, where the lowest total is tinted green and marked
"Cheapest" — every laboratory sharing it, and none when the totals are in
different currencies or the lowest is zero.

A radio button in a laboratory's column header picks exactly one laboratory
for that visit (`selectedLabId`, each visit's radio group its own, keyed by
the visit's position). Once picked, every priced row's Observation cell shows
that lab's own product name — its `innerId`, when it has one, prefixed as
"<innerId> · <label>" — linked to the lab's `url` when one exists, with a row
unpriced at that lab falling back to the app's generic name and a marker
showing it is a fallback; a "Show generic names" control clears the
selection, since a native radio cannot self-deselect.

With no visits at all, the page shows an empty state naming the way to get
there: tick rows in the Scheduled column of Monitoring Panels or All
Observations, or add a visit there with the + button. The add/remove
affordances live only in the results tables.

## Backup

`scheduled-visits.json` in the backup zip; restored through `scheduled.ts`'s
own save function ([`account-and-sync.md`](account-and-sync.md)).
