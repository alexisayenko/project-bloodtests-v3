# Style guide

The in-project visual and interaction reference, plus the
platform style guides we hold ourselves to. Sets the standards
the product looks and behaves under.

For identity-level direction (palette, typography family, voice
tone, mark), see [`../brand/README.md`](../brand/README.md).
This guide *operationalizes* brand at the UI layer — the
brand-derived rules below (color use, type scale, motion, voice
& copy) should trace back to decisions there.

## External references

Platform-level guides we conform to. Defer to these unless we
have a documented reason to diverge — record divergences in
[In-project conventions](#in-project-conventions) below with
their rationale.

- iOS — [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines)
- Android — [Material Design 3](https://m3.material.io/)
- Web a11y — [WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/)

## In-project conventions

Project-specific rules that go beyond — or deliberately override
— the platform defaults. Add as patterns crystallize; cite the
rationale per rule so future-us can revisit.

### Color

- [TODO: e.g. red = destructive (delete, irreversible). Used
  for destructive confirmations only.]
- [TODO: accent color use cases — call-to-action, success
  state, brand surfaces.]
- **Result status.** An [observation](../product/concepts/observation.md)'s
  result is 2-state against its lab reference range: green =
  in-range, red = out-of-range. A [computed
  index](../product/concepts/computed-index.md) is 3-state against
  its own cut-points instead: green = ok, amber = warn, red = bad.
  A selected table row blends its cell color with the row-selection
  blue rather than replacing it, so status stays visible while
  selected.

### Numbers

- **Adaptive-precision, by magnitude:** `≥ 100` -> 0 decimals,
  `≥ 10` -> 1, `≥ 1` -> 2, `< 1` -> 3. Trailing zeros are stripped.
  Locale-agnostic (`.` as the decimal separator) — locale-aware
  formatting is a separate render-time concern. Ported from
  `project-bloodtests-v2`'s `engine/src/format.ts` (`fmtNum`).
- **Where each display mode applies:** the Results table (many
  dates at once) always uses adaptive precision, for a readable,
  consistent column — a lab's own printed digit count varies too
  much draw to draw to scan well in bulk. The popup's single-value
  reconciliation blocks ("Latest", "Lab reported") instead prefer
  the result's `rawValue` — the string exactly as the lab report
  shows it, no rounding — since that's the surface for checking a
  value against the paper report; see
  [`../product/concepts/lab-report.md`](../product/concepts/lab-report.md)
  for the reported-value vs. computed-value distinction.
- Computed indices are pre-quantized to 2dp before adaptive
  precision is applied (matches `project-bloodtests-v2`'s
  historical display, e.g. `0.4475` -> `0.45`, not `0.448`).

### Typography

- [TODO: type scale — base size, line-height, weight ladder.]
- [TODO: typeface pairing — display + body + mono.]

### Motion

- [TODO: standard durations — e.g. fast 150ms, default 250ms,
  slow 400ms.]
- [TODO: easing curves and when each is used.]

### Navigation

- **Top-level sections** (Get Started, Diagnostic Reports, All
  Observations, Monitoring Panels, Reference Book) are a persistent
  top nav on every page, each section its own URL hash (`#profile`,
  `#reports`, `#all`, `#panels`,
  `#reference`) so browser back/forward always works. Active section:
  bold + blue underline.
- The persistent top nav is the only cross-section navigation
  chrome — no breadcrumb trail anywhere. Nested position within a
  section (e.g. panel detail under Monitoring Panels) still gets its
  own URL hash so browser back/forward works. Panel Detail is the one
  exception: a back chevron (‹) before its `<h1>` name, a single link
  back to the Monitoring Panels grid — not a breadcrumb path.
- A popup is never part of the URL/history; navigating away always
  closes it rather than leaving it open over the next page.

### Interaction

- **Two-step cell open:** a data cell in the Results table arms on
  first click (selects it and highlights its row) and opens on a
  second click on that same armed cell — an Observations cell opens a
  popup for that specific result (name, short name, date, laboratory,
  value, lab reference range); an Indices cell opens a popup for that
  specific computed value (name, short name, date, "Calculated", value,
  ref-range, plus a same-draw lab-reported comparison when the lab
  independently reports that index) — distinct from the index
  popup its row label opens (formula, evidence level, references).
  Clicking a different cell re-arms instead
  of opening; the row label still opens on a single click.
- **Relation marks:** selecting a Results row marks its related rows
  — an index's input observations, or the indices an observation feeds
  — with a blue • in a fixed gutter left of the name. The gutter is
  reserved on every row (All Observations too, though it shows no
  marks) so a mark never shifts the text beside it.
- **Scheduled column:** a per-row single-click toggle (`role=checkbox`,
  ✓ in primary blue), set apart at the right of the table by a spacer
  column so it reads as a separate concern from the dated value cells.
  On Panel Detail's Observations and Indices tables and on All
  Observations, over one shared set — the same row toggled in either
  place is the same row. Its header is a control, not a label: a month
  pill above a tri-state select-all box that carries the word
  "Scheduled". The month names what the schedule is *for* and never
  filters it; select-all covers only the rows currently on screen, so a
  filtered table never schedules something the reader cannot see.
- **Unit labels:** the unit sits once in the row's name column when
  every reading in the row is on one scale. Two spellings of the same
  unit count as one scale — `uIU/mL` and `mIU/L` are the same unit, so
  a row printed both ways still gets a single label, and no number
  moves. When the scales genuinely differ — a lab that
  switched mid-history, or a molar code folded into its mass
  primary's row — the row-level unit disappears and each cell carries
  its own in grey beside the number, so a figure is never shown under
  another reading's scale.
- [TODO: popup dismissal — backdrop tap, swipe-down, both.]
- **Tab placement:** top (web) — both the section nav and the
  Results/Trends/What's-in-range/Charts tabs use the same top,
  underlined-active style. Only the in-page strip is a shared component
  (`TabBar`); the section nav keeps its own markup, because it also
  carries a blocked state, its own spacing and font size, and an active
  tab derived from the route — it shares the look (`tabStyle`), not the
  component.
- [TODO: gesture conventions — long-press, swipe-to-delete.]

### Voice & copy

- [TODO: tone — friendly / neutral / formal.]
- [TODO: capitalization in titles — sentence case / title case.]
- [TODO: error message conventions — user-actionable, no
  blame.]

## Open questions

- [TODO: open style decisions awaiting resolution.]
