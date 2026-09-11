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

Every value lives once, as a custom property in `web/src/styles/index.css`'s
`:root`; inline styles reach it through `web/src/styles/tokens.ts`
(`COLOR`, `TINT`).

| Role | Token | Value |
|---|---|---|
| Page ground | `--surface-page` | `#f6f9fa` |
| Card | `--surface-card` (= `--surface`) | `#ffffff` |
| Mint wash (page header glow) | `--surface-mint` | `rgba(20,117,126,.06)` |
| Brand teal / deep | `--brand-teal` / `--brand-teal-deep` | `#3eb0b0` / `#2a9ea4` |
| Navy (ink) | `--navy` (= `--text`) | `#062a4f` |
| Primary fill + its text | `--primary` / `--primary-text` | `#0e5a66` / `#ffffff` |
| Link | `--link` | `#137a7f` |
| Accent (active, selection, text-safe teal) | `--accent` | `#14757e` |

Status is a deliberately soft set, independent of the brand palette:

| Status | Dot | Text | Background |
|---|---|---|---|
| In range | `--status-ok` `#4caf7a` | `--status-ok-text` `#1f6b45` | `--status-ok-bg` `#e3f4ea` |
| Borderline | `--status-warn` `#e6a93a` | `--status-warn-text` `#85600f` | `--status-warn-bg` `#fbf0db` |
| Out of range | `--status-bad` `#d9605a` | `--status-bad-text` `#8e2f2b` | `--status-bad-bg` `#fbe5e3` |
| Not tested | `--status-none` `#a8b0ba` | — | — |

- **Dot vs text.** The bare status token is for dots, borders and rules
  only; anything read as words (errors, "✓ Added", warnings) uses the
  `-text` token, since the dot colours do not clear AA as 13px text.
  `--status-*-bg-selected` is derived (`color-mix` with `--accent-line`),
  never typed.
- **Panel tints.** Each Monitoring Panel card takes one `--tint-<role>-*`
  family (`ink` icon, `bg` card, `icon` disc, `line` border): teal
  (default), blue, violet, amber, green, rose, cyan, slate, orange,
  indigo; Kidney and Anemia/Hematology borrow amber's and rose's
  surfaces with their own `--tint-ochre-ink` / `--tint-crimson-ink`.
- **Result status.** An [observation](../product/concepts/observation.md)'s
  result is 2-state against its lab reference range: green =
  in-range, red = out-of-range. A [computed
  index](../product/concepts/computed-index.md) is 3-state against
  its own cut-points instead: green = ok, amber = warn, red = bad.
  In the Results table a reading's status is a soft `-bg` tint behind
  the number, the digits in the `-text` colour, not a flood across the
  cell. A selected row blends that tint with the accent-tinted row
  selection (`--status-*-bg-selected`) rather than replacing it, so
  status stays visible while selected. The Monitoring Panels grid's
  chip dots add two states for the latest reading: amber = reported
  without a reference range, grey = never measured.
- **Accent.** Teal (`--accent`, `#14757e`) carries selection, relation
  marks, the phone nav's active tab and focus rings. The desktop
  sidebar's active section is a soft teal pill; the in-page tab strip
  underlines its active tab in `--brand-teal-deep` under navy text; the
  Scheduled ✓ and the primary button fill are `--primary`
  (`#0e5a66`).

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

One family, Manrope (400/500/600/700), with the system UI stack as
fallback. The scale is `FONT` in `tokens.ts`:

| Role | Token | Size / weight |
|---|---|---|
| Overline | `--font-overline` | 12px / 600, uppercase, `letter-spacing: .16em` |
| Body | `--font-body` | 14px |
| Small | `--font-small` | 13px |
| Card title | `--font-card-title` / `--font-card-title-lg` | 17px / 20px |
| Detail `<h1>` | `--font-detail-h1` | 28px |
| Display `<h1>` (page header) | `--font-display-h1` | 36px |

Shape and space tokens sit beside it: radii `--radius-pill` 999px,
`--radius-card` 16px, `--radius-control` 10px; shadows `--shadow-card`
(hairline ring + faint navy lift) and `--shadow-pop` (stronger, for
popups); spacing `--space-1`…`--space-6` = 4 / 8 / 12 / 16 / 24 / 32px.

### Components

Shared primitives live in `web/src/components/primitives/` (exported from
its `index.ts`); a view reaches for one of these before writing its own.
Where a state needs a selector an inline style cannot express (hover,
`aria-pressed`, `:disabled`, focus), the look lives in `index.css` under an
`mc-` class instead.

| Primitive | What it is |
|---|---|
| `Button` | Pill button; `variant` `primary` (`--primary` fill), `secondary` (teal outline, the default) or `danger` (red outline, `-text` label); `size` `xs` / `sm` / `md`; disabled greys out with a `not-allowed` cursor. |
| `FileButton` | The same pill as a label over a hidden file input, cleared after each pick so the same file can be picked twice. |
| `Card` | White surface, `--border-subtle` hairline, `--radius-card`, `--shadow-card`, 16×20px padding. |
| `CardParts` | `CardHeader` (optional icon, `CardTitle`, `CardDescription`, an aside on the right), `IconBadge` (a round tinted disc holding a line icon, 40px by default), `Overline` (11px uppercase muted label) and `DangerCard` (a `Card` with a rose hairline and wash, for actions that cannot be undone). |
| `SectionTitle` / `EmptyState` | A 14px semibold group heading; a muted 14px "nothing here yet" line. |
| `StatusDot` | An 8px dot in a status tone's colour (`TONE_DOT`), or any colour given. |
| `StatusChip` | A white pill with a status dot and label (`.mc-chip`), a `<button>` when clickable; the grid's marker and index chips. |
| `StatusToggle` | A status filter pill: dot, label (`TONE_LABEL`: In range / Borderline / Out of range / Not tested) and a count badge, `aria-pressed`; off, it goes transparent with a faded dot. |
| `SwitchToggle` | A labelled on/off switch as one button, `aria-pressed`, the track teal when on; the grid's "Compact view". |
| `SegmentedControl` | A pill group of mutually exclusive options (`.mc-segmented` / `.mc-segment`), the chosen one a raised white segment; the controls bar's unit system and sample limit. |

`styles.ts` holds the non-component styles: `TABLE` / `TABLE_TH` / `TABLE_TD`
(a plain table under a 1.5px accent rule), `CARD_TABLE_TH` / `CARD_TABLE_TD` /
`TABLE_CARD` (a table flush inside a `Card`, under a muted uppercase header
band), `FIELD_INPUT` (an inline text or select field), `OVERLINE`,
`DANGER_CARD` and `buttonStyle`. Form controls outside a table use the
`.mc-field` / `.mc-field-select` / `.mc-field-search` classes, with
`.mc-field-sm` for the Scheduled column's month select.

### Motion

- [TODO: standard durations — e.g. fast 150ms, default 250ms,
  slow 400ms.]
- [TODO: easing curves and when each is used.]

### Navigation

- **Top-level sections** (`NAV_ITEMS` in `routing.ts`, in this order:
  Get Started, Diagnostic Reports, All Observations, Monitoring Panels,
  Scheduled Visits, Medications, Reference Book, Account) are on every
  page, each its own URL hash (`#profile`, `#reports`, `#all`,
  `#panels`, `#plan`, `#medications`, `#reference`, `#account`) so
  browser back/forward always works. All Observations' non-default
  tabs are part of the hash too (`#all/trends`, `#all/in-range`).
- **Shell, by width.** From 768px up: a white top bar (mark and
  wordmark linking to Monitoring Panels, a lock and "Your data stays in
  this browser") over a left sidebar listing the sections with a line
  icon each, Account pinned to its foot; the active section is a soft
  teal pill. Below 768px: the wrapping top nav, which slides away
  scrolling down and back scrolling up; the active section is bold
  with a teal underline. Blocked sections (Monitoring Panels and All
  Observations while a report has errors) are dimmed with a
  `not-allowed` cursor in both.
- The section nav is the only cross-section navigation chrome — no
  breadcrumb trail anywhere. Nested position within a section (e.g.
  panel detail under Monitoring Panels) still gets its own URL hash so
  browser back/forward works, and keeps its parent section active. The
  two detail views are the exception: each puts a single link back
  before its `<h1>` — not a breadcrumb path. Panel Detail's is a round
  chevron button, followed by the panel's icon disc in its tint and the
  title over the panel description; Diagnostic Report detail's is a
  plain ‹ back to the reports list.
- **Page header banner.** Every top-level section opens with the same
  `PageHeader`: an uppercase teal overline, a two-tone title (second
  half in teal), two description lines and three icon "pillars" on the
  right, over a bottom rule. Detail views and Reference Book sub-pages
  use a plain `<h1>` instead.
- A popup is never part of the URL/history; navigating away always
  closes it rather than leaving it open over the next page.

### Interaction

- **Two-step cell open:** a data cell in the Results table arms on
  first click (selects it and highlights its row) and opens on a
  second click on that same armed cell — an Observations cell opens a
  popup for that specific result (friendly name, short name, date, laboratory,
  value, lab reference range); an Indices cell opens a popup for that
  specific computed value (friendly name, short name, date, "Calculated", value,
  ref-range, plus a same-draw lab-reported comparison when the lab
  independently reports that index) — distinct from the index
  popup its row label opens (formula, evidence level, references).
  Clicking a different cell re-arms instead
  of opening; the row label still opens on a single click.
- **Relation marks:** selecting a Results row marks its related rows
  — an index's input observations, or the indices an observation feeds
  — with a teal • in a fixed gutter left of the name. The gutter is
  reserved on every row (All Observations too, though it shows no
  marks) so a mark never shifts the text beside it.
- **Results table:** observations and computed indices share one
  table in a `Card`, under a muted uppercase header band, the indices
  below an "Indices" divider row — an overline label over a hairline
  that spans only the table's own columns — on both Panel Detail and
  All Observations.
- **Controls bar:** unit system and sample limit (each a
  `SegmentedControl`: SI / US, and 5 / 10 / 15 / All), panel select and
  marker search, each under a small label, sit inside the Results tab,
  between the tab strip and the table, and are not rendered on the
  other tabs. Panel Detail shows the panel select disabled rather than
  hiding it.
- **Monitoring Panels toolbar:** status filter toggles (one
  `StatusToggle` per status, all on by default, with its chip count)
  and the "All" / "Abnormal only" presets on the left; the "Compact
  view" switch and the search box on the right. A status switched off
  hides its chips in every card and the card count reads "N of M
  markers"; a card left empty stays, saying "No markers match". The
  filters are session state; Compact view is remembered. Compact view
  shows short names, drops the Observations / Indices labels and the
  "View panel →" link, and fits more, narrower columns.
- **Scheduled column:** a per-row single-click toggle (a native
  checkbox, visually hidden, ✓ in teal), set apart at the right of the
  table by a spacer column so it reads as a separate concern from the
  dated value cells. On Panel Detail's Results table and on All
  Observations, over one shared set — the same row toggled in either
  place is the same row. Its header is a control, not a label: a small
  month select beside a tri-state select-all box, both named through
  `aria-label` rather than a visible word. The month names what the schedule is *for* and never
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
- **Tab placement:** top (web) — the in-page
  Results/Trends/What's-in-range/Charts tabs use a top,
  underlined-active style, and so does the phone's section nav. Only
  the in-page strip is a shared component (`TabBar`, styled by
  `.mc-tabs` / `.mc-tab`: muted labels, the active one navy with a
  `--brand-teal-deep` underline, over a hairline); the phone nav keeps
  its own markup and inline `tabStyle` (teal label and underline),
  because it also carries a blocked state, its own spacing and font
  size, and an active tab derived from the route — the two share the
  idea, not the code. The desktop sidebar shares neither.
- [TODO: gesture conventions — long-press, swipe-to-delete.]

### Voice & copy

- [TODO: tone — friendly / neutral / formal.]
- [TODO: capitalization in titles — sentence case / title case.]
- [TODO: error message conventions — user-actionable, no
  blame.]

## Open questions

- [TODO: open style decisions awaiting resolution.]
