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

- **Prefer the lab's own printed value.** A result's `rawValue` (the
  string exactly as the lab report shows it) is displayed as-is — no
  rounding, no reformatting. It's the reconciliation surface against
  the paper report; touching it defeats that purpose.
- **Adaptive-precision fallback.** Only when there's no `rawValue`
  (a value we computed, or one with no printed string) do we round,
  by magnitude: `≥ 100` -> 0 decimals, `≥ 10` -> 1, `≥ 1` -> 2,
  `< 1` -> 3. Trailing zeros are stripped. Locale-agnostic (`.` as
  the decimal separator) — locale-aware formatting is a separate
  render-time concern.
- Ported from `project-bloodtests-v2`'s `engine/src/format.ts`
  (`fmtNum`) and its use in `engine/src/matrix.ts`; see
  [`../product/concepts/lab-report.md`](../product/concepts/lab-report.md)
  for the reported-value vs. computed-value distinction.

### Typography

- [TODO: type scale — base size, line-height, weight ladder.]
- [TODO: typeface pairing — display + body + mono.]

### Motion

- [TODO: standard durations — e.g. fast 150ms, default 250ms,
  slow 400ms.]
- [TODO: easing curves and when each is used.]

### Interaction

- [TODO: popup dismissal — backdrop tap, swipe-down, both.]
- [TODO: tab placement — bottom (mobile), top (web), neither.]
- [TODO: gesture conventions — long-press, swipe-to-delete.]

### Voice & copy

- [TODO: tone — friendly / neutral / formal.]
- [TODO: capitalization in titles — sentence case / title case.]
- [TODO: error message conventions — user-actionable, no
  blame.]

## Open questions

- [TODO: open style decisions awaiting resolution.]
