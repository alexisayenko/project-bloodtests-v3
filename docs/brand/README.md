# Brand

[TODO: 1-2 sentences — what state the brand identity is in
(taking shape / locked / evolving), and the high-level direction.]

Folder-specific applications (favicon, web splash, social cards,
app icons, store screenshots) are derived from the mark and
live alongside the code that consumes them — under the relevant
code folder, not here.

For how brand applies to shipped UI (type scale, motion timings,
color-use rules, popup patterns, copy conventions), see
[`../ui-ux/style-guide.md`](../ui-ux/style-guide.md). This file
owns identity / spirit; the style guide operationalizes it.

## Section-local glossary

- **Mark** — the graphic-only identity element. Lives in this
  folder as the source of truth (e.g. `mark.svg` / `mark.png`)
  once chosen.
- **Wordmark** — text-only logo (the product's name set in a
  chosen typeface).
- **Logo** — full lockup of mark + wordmark.
- **Application** — the mark used inside another artifact (a
  favicon, an app icon, a splash screen). Lives with the
  platform that consumes it.
- **Variant** — alternate treatment of the same application
  (e.g. light/dark favicon).

## Current state

- **Name**: [TODO: working / locked + the name + rationale.]
- **Visual direction**: [TODO: 1-2 lines — minimal, ornate,
  themed-after-something, etc.]
  - **Palette**: [TODO: list of colors / hex values, or
    references to source material.]
  - **Texture**: [TODO: flat vector / brushstroke / hand-drawn.]
  - **Typography**: [TODO: serif / sans / mono / handwritten +
    any specific typefaces in use.]
  - **Mark**: [TODO: pictorial / abstract / letterform direction.]
- **Domain**: [TODO: registered domains + provider + dates +
  which is primary vs defensive.]
- **Wordmark / logo**: [TODO: TBD or describe the lockup.]

## Where applications live

Cross-folder assets (mark sources, font licenses) live here.
Per-folder applications live with their code.

| Where it appears | Location |
| --- | --- |
| [TODO: e.g. Web favicon] | [TODO: e.g. `web/public/favicon.svg`] |
| [TODO: e.g. Open Graph / social cards] | [TODO: `web/public/`] |
| [TODO: e.g. iOS app icon] | [TODO: `mobile/…` or remove if N/A] |

## Names considered

Optional. Useful when the name is still in motion.

| Name | Verdict |
| --- | --- |
| [TODO: candidate 1] | [TODO: chosen / passed because…] |

## Open questions

- [TODO: open decisions about mark, typeface, name lock-in,
  domains.]
