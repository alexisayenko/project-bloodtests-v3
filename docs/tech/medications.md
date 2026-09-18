# Medications

`#medications` (`MedicationsView.tsx`, reachable while validation errors
exist): a medication table in a card with a Jan–Dec month grid per shown
year, kept by `web/src/data/medications.ts`'s `useMedications` under its own
localStorage key `bloodtests_medications_v1`, outside the envelope, export,
import and share links ([task-0018](../tasks/task-0018.md)); `medications.json`
in the backup zip ([`account-and-sync.md`](account-and-sync.md)).

## Row shape

A `MedicationRow` splits brand from active ingredient: `brand` is the name as
printed (a plain supplement name is often the whole of it); `compounds` is
zero or more free-text `{name, dose}` pairs (e.g. `valsartan` / `80mg`)
broken out only for combo drugs, empty being the common case; `notes` is
free-text timing / frequency, edit-only — view mode shows nothing of it. A row
saved in the earlier `name` / `dosage` shape is migrated losslessly by
`parseMedications` on read (`name` → `brand`, `dosage` → `notes` verbatim,
`compounds` empty), deliberately without parsing a parenthetical compound
note, since that pairing cannot be done reliably. The current shape is
described, documentation-only, by `web/public/schema/medications-1.schema.json`;
`medications.ts`'s lenient parser is the real gatekeeper.

## Rendering

The Medication cell renders the brand bold with a smaller muted line of
`"<name> <dose>"` compounds underneath — always rendered, even empty, so every
row keeps the same height. Each taken month is a soft bar that joins its
neighbours chronologically; December and the next year's January join into
one continuous bar, the year columns being a display grouping rather than a
break in the run (`medicationBars.ts` builds the same bars for the "What's in
range" chart's `MedicationLane`, [`charts.md`](charts.md)).

The Medication column is the only sticky one, carrying the results tables'
`.mc-col-cut` edge shadow, so only the month columns scroll horizontally. The
grid always renders every stored year's columns; a one-time mount `useEffect`
scrolls the table's own container (`scrollRef`) so the current year's first
month column lands right after the sticky column — computed from the current
year's index among the ascending `years` array, with the container's
`paddingRight` padded out when needed so the target stays reachable rather
than clamped short by the browser — leaving earlier years scrolled out of
view behind the sticky column and later years reachable by scrolling right.

Editing is behind an Edit / Done toggle; edit mode adds a compact repeatable
compound editor (name + dose inputs, add/remove per entry) under the brand
input and a free-text notes input under that.
