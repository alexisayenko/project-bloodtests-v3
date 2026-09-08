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
- **Domain**: `blood.isayenko.net` — subdomain, no separate
  registration.
- **Wordmark / logo**: [TODO: TBD or describe the lockup.]

## Where applications live

Cross-folder assets (mark sources, font licenses) live here.
Per-folder applications live with their code.

| Where it appears | Location |
| --- | --- |
| Web favicon | `web/public/favicon.png` |

## Names considered

Optional. Useful when the name is still in motion.

| Name | Verdict |
| --- | --- |
| `heman.cc` | candidate (2026-08-25) — short for "hematology analyzer" |
| `hematologyanalyzer.cc` | candidate (2026-08-25) — descriptive long form |
| `serum.im` | candidate (2026-08-25) — short, clinical, memorable |
| `in-vitro.cc` | candidate (2026-08-25) — lab-diagnostics term, hyphenated |
| `invitro.im` | candidate (2026-08-25) — same, unhyphenated (note: clashes with Invitro, the large RU/CIS lab chain) |
| `assay.guru` | candidate (2026-08-25) — playful, assay = lab test |
| `bioanalysis.cc` | candidate (2026-08-25) — descriptive, generic |
| `markerly.net` | candidate (2026-09-08) — coined from "marker", product-shaped rather than clinical |
| `markerly.cc` | candidate (2026-09-08) — same on the short TLD |
| `biomarks.net` | candidate (2026-09-08) — biomarkers, shortened |
| `biomarks.cc` | candidate (2026-09-08) — same on the short TLD |
| `bloodtests.cc` | candidate (2026-09-08) — plainly descriptive, matches the repo name |
| `paneloom.app` | candidate (2026-09-08) — panel + loom: the one name so far that says what the app does to the data, weaving readings from different labs and years into one fabric, rather than naming a lab test |
| `paneloom.com` | candidate (2026-09-08) — same on the default TLD |
| `paneloom.net` | candidate (2026-09-08) — same on `.net` |

Registration was checked by RDAP (`https://rdap.org/domain/<name>`) on
2026-09-08, verified against controls first: a known-registered name must
answer 200 and a nonsense one 404, or the answer means nothing. On that
basis every name above was unregistered except the two on `.im`, which are
unchecked: **`.im` has no RDAP service** — its control answered 404 as
well, so a 404 there means "not covered", not "free". Controls that did
pass, and so make their TLD's answers meaningful: `nic.cc`, `nic.guru`,
`nic.net` and `google.app` all answered 200; a nonsense `.com` answered 404.

Do not check these with the `whois` CLI. It does not follow registry
referrals here: every query, including domains that certainly exist,
returns IANA's record for the *TLD*, which reads as a hit and produces
confident nonsense in both directions. Confirm at a registrar before buying.

Two threads run through the list worth settling before one is locked.
Every name so far is a synonym for "lab test", so none of them says the
thing that distinguishes this from a lab's own portal — that the data
stays local and the point is the trend across years and labs. And the
`in-vitro` / `invitro` pair carries a live trademark risk: Invitro is a
large RU/CIS lab chain, which is the same market the reports this app
parses come from, and hyphenation does not dodge that.

## Open questions

- [TODO: open decisions about mark, typeface, name lock-in,
  domains.]
