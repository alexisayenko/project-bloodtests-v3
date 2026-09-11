# Brand

Taking shape. A working name, Paneloom, and a chosen mark: the woven
knot, redrawn as SVG on 2026-09-10. The name is still not locked. The
direction is flat and geometric in navy and teal, deliberately not
looking like a laboratory.

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

- **Name**: working — **Paneloom**. Panel + loom: the monitoring panels
  the product is organized around, and the weaving of readings from
  different laboratories, units and years into one comparable series.
  Not locked; see "Names considered" below.
- **Visual direction**: flat, geometric, calm. Clinical without being
  cold — no red, no droplets, nothing that reads as a laboratory or a
  diagnosis.
  - **Palette**: fixed by the SVG redraw of the mark — deep navy
    `#062A4F` (dominant), teals `#3EB0B0` / `#2A9EA4`, mid blue-teals
    `#1F8D9A` / `#0D768F`. The landing concept adds near-white grounds
    and soft mint gradients.
  - **Texture**: flat vector, no gradients inside the mark itself.
  - **Typography**: geometric sans, rounded terminals, lowercase-heavy
    wordmark. Exact typeface unidentified — the lockups are generated
    raster, not set type. The app sets the wordmark as live text in its
    own font stack rather than tracing the raster letters.
  - **Mark**: the **woven knot**, chosen 2026-09-10 — two navy bands
    woven through two teal bands. Source of truth:
    [`paneloom-mark.svg`](paneloom-mark.svg), hand-drawn from
    `logo-woven-knot.png` as four rotated copies of one arm and stub,
    with no embedded raster.
- **Domain**: `paneloom.com`, registered 2026-09-09. The app is served
  from both `paneloom.com` and `blood.isayenko.net` (two custom-domain
  routes in `web/wrangler.jsonc`); `www.paneloom.com` does not resolve.
  `paneloom.app` / `.net` were unregistered on 2026-09-08; only `.com`
  is in [`budget.md`](../business/budget.md).
- **Wordmark / logo**: horizontal lockup, mark left of the wordmark,
  "Paneloom" in navy with "loom" sometimes carried in teal. Tagline
  used in the landing concept: *Track today. See tomorrow.*

The brief that produced both the name and the artwork is kept verbatim in
[`brief.md`](brief.md) — it is currently the fullest written statement of
the product's positioning.

## Logo candidates

Generated 2026-09-09, all 1254×1254 PNG with transparent backgrounds.
The woven knot was chosen and redrawn as SVG on 2026-09-10; the other
three remain raster-only candidates, kept for the record.

| File | Mark | Note |
| --- | --- | --- |
| [`logo-woven-knot.png`](logo-woven-knot.png) | interlaced square knot | **chosen** — the loom idea read literally; used by the landing concept |
| [`logo-panel-cards.png`](logo-panel-cards.png) | four linked cards | the panel idea read literally; busiest of the four at small sizes |
| [`logo-monogram-p.png`](logo-monogram-p.png) | letter P with a woven counter | most conventional; least tied to the product |
| [`logo-network-ring.png`](logo-network-ring.png) | ring of orbiting nodes | reads as network or community rather than weaving |

[`landing-concept.png`](landing-concept.png) is a full marketing-page
mockup. Its copy is worth keeping even if the visuals change: it states
the positioning this repo's `CLAUDE.md` still has as a TODO — *"Your
bloodwork history, woven into one timeline"*, and the three promises
*No accounts. No server. No medical advice.*

## Where applications live

Cross-folder assets (mark sources, font licenses) live here.
Per-folder applications live with their code.

| Where it appears | Location |
| --- | --- |
| Web favicon (vector) | `web/public/favicon.svg` |
| Web favicon (PNG fallback) | `web/public/favicon.png` |
| iOS home-screen icon | `web/public/apple-touch-icon.png` |
| App header mark | `web/public/brand/paneloom-mark.svg`, rendered by `TopBar.tsx` (768px and up) and `NavBar.tsx` (phones) |

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
| `paneloom.com` | **registered (2026-09-09)** — same on the default TLD |
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
