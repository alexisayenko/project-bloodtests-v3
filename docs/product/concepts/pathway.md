# Pathway

> **Status: two static axis pages built** (Hormonal Pathways, Lipid Transport) — specified 2026-09-11
> ([task-0024](../../tasks/task-0024.md),
> [ADR-0014](../../tech/decisions/adr-0014-pathway-wiring-is-mermaid-generated-to-json.md)).
> `HormonalPathwaysView.tsx` draws four captioned zones on one canvas —
> Brain (a hypothalamus–pituitary image, `brain-pituitary.png`, centred on T's
> vertical axis, with forked arrows to FSH and LH leaving its left side and,
> as of 2026-09-16, estradiol's feedback from blood E2 entering its right side,
> marked "↓"), Blood Transport, Testes, Target
> tissues — with pathway arrows measured from the DOM (re-measured as nodes,
> images, fonts or values change), the canvas beside the badge column down to a
> 1280px viewport (spacing tightens first, then the zones zoom out), and, as of 2026-09-16,
> a testosterone pools donut (SHBG-T, Albumin-T, Free T, with callouts) atop
> six clickable badges (Total T, Bioavailable T, one merged Free Testosterone
> — its face cFT (Vermeulen), expanded into Measured (LOINC `2991-8`, with the
> lab's range) and Calculated (Vermeulen and Ly & Handelsman, their identical
> zones shown once, plus Labcorp's 1.5–3.2 % adult male range) — then T/LH,
> DHT/T, T/E2), now on the user's own readings: a ‹ date › stepper over the Hypogonadism
> panel's results-table dates (latest by default), values in the SI/US unit
> system through a toggle bound to the shell's persisted setting, each
> testosterone fraction also shown as % of total T, the Vermeulen values and
> bound pools from `testosteronePools`, the other indices from `INDEX_DEFS`,
> and, when a draw has no albumin, a select choosing no fallback, the nearest
> measured albumin, or 4.3 g/dL (the default). That row of selects under the
> diagram also carries "Testosterone molar mass" — 288.4 g/mol
> (PubChem), the default, or 280 g/mol (issam.ch calculator) — which re-solves
> only this page's Vermeulen values, unpersisted, as a labelled cross-check
> aid ([ADR-0020](../../tech/decisions/adr-0020-constants-from-cited-data-calculators-are-cross-checks.md)). Node captions are
> chips with status dots; a chip or badge expands in place to a reference
> range — the lab's own when printed, else the cited, adult-male ranges of
> `pathway-reference-ranges.json`, `INDEX_DEFS`' zones for indices, none for
> the calculated pools. Each receptor node carries a compact "Effects ▸"
> chip opening a card of what its activation does in adult men, every bullet
> citing [n] sources from `pathway-receptor-effects.json`. No `pathways.json` yet — the wiring is hand-coded in
> the component — and of the feedback arrows only that one E2 → brain arrow.
> Where the
> build departs from what follows (zones, not bands, their captions turned 90°
> counter-clockwise in a left gutter; the E2 feedback drawn solid into the
> brain as a whole rather than dashed to Kp and LH; badges in one column;
> association lines hidden at rest; cells and receptors drawn; a date stepper
> rather than a month stepper; a default albumin; a merged Free Testosterone
> badge and a pools donut, an expanded badge overlaying rather than pushing down its neighbors, and the
> enzyme and receptor icons drawn as shared, transparent PNG artwork —
> `enzyme-icon.png`, `receptor-icon.png` — rather than hand-drawn per-role
> SVG), task-0024's
> status note records it. No protein on the page renders a real structure
> image any more: FSH and LH briefly did (PDB 1XWD, 7FII), then settled back
> onto the same `HormoneIcon` schematic as every other signal, and aromatase
> and 5α-reductase briefly did too (PDB 3EQM, 7C83) before settling onto the
> shared enzyme icon — task-0024's log has both reversals.
>
> **Second axis page, 2026-09-16: Lipid Transport** (`#lipids`,
> `LipidTransportView.tsx`, [task-0060](../../tasks/task-0060.md)) — its own
> nav item after Hormonal Pathways rather than an axis tab, redrawn 2026-09-17
> ([task-0062](../../tasks/task-0062.md)) as three pathway zones — Intestine,
> Liver (with HMG-CoA reductase docked on it and a bare cholesterol icon
> beside it as its synthesized product) and Blood Transport — each of the six
> lipoprotein particles (Chylomicron, VLDL, IDL, LDL, HDL, Lp(a)) now a
> holder-plus-cargo diagram in the same visual language SHBG uses to hold
> docked testosterone: a carrier icon named for its structural apolipoprotein
> (ApoB-100 for VLDL/IDL/LDL/Lp(a), ApoB-48 for chylomicron, ApoA-I for HDL)
> bonded to a stack of small TRIG/Chol circles whose COUNT depicts the amount
> aboard, never one scaled icon. VLDL → IDL → LDL is drawn as one particle
> transforming, with no bond between the stages, both its TRIG and Chol counts
> tapering down the chain (illustrative, not to scale); chylomicron, HDL and
> Lp(a) are drawn unconnected to that chain, none of them being one of its
> transformation stages. A badge column rings each particle's own
> Chol/TRIG/apo icon directly on hover, focus or open, rather than a chip row
> under it. The particle glyphs are no longer either generated artwork or
> geometry computed from `lipoprotein-particles.json` — every one is now a
> hand-drawn `customIcons.tsx` glyph like the rest of the app's icons, so
> [ADR-0022](../../tech/decisions/adr-0022-illustrative-artwork-and-data-drawn-glyphs-coexist.md)
> now bears only on the liver image. Only the liver → VLDL arrow, plus a
> second, enzyme → synthesized-cholesterol arrow, of its flows are drawn.
> **Both pages share one engine**, `pathwayShared.ts` and `PathwayParts.tsx` — reference and source
> blocks, date stepper, one-open-at-a-time dismissal, the DOM-measured overlay
> with association lines hidden at rest, re-measured on resize, image load,
> fonts and each page's own layout key, and the level-of-organisation `SIZE`s —
> while each page hand-codes its own layout and wiring
> ([ADR-0021](../../tech/decisions/adr-0021-pathway-pages-share-one-overlay-engine.md)).
> The rest of this page describes the gonadal axis.

One axis drawn as its wiring — a hormonal axis, or a transport pathway such as lipid transport — organ bands, signals, carriers and enzymes joined by pathway arrows — with the user's own values for a selected month placed on it.

A [monitoring panel](monitoring-panel.md) lists markers; a pathway shows how they act on each other, so a reading is seen at the point in the axis where it happens.

## Scope for now

- **Men only, gonadal axis first.** The women's axis comes later, and with it FAI.
- **Month stepper** — one month at a time, stepping through the months the data has.
- **"Measured only | Full pathway"** — a toggle between the parts with a reading that month and the whole wiring, unmeasured parts grey.

## Node kinds

A node kind describes a **role in the axis, not chemistry**. T and LH are both signals although one is a steroid and one a glycoprotein; the chemical class appears only in hover text. A molecule can play several roles — T is a signal and the substrate of two conversions — and the line carries the relation, never a second kind.

Drawn: bands, signals, carriers, enzymes, badges and lines. **Not drawn**: cells, tissues and regions, and receptors — no node or shape for any of them. Cells and tissues have a role icon, never a diagram node; receptors have none.

### Band

An organ, drawn as a zone of one canvas and named by a small uppercase caption turned 90° counter-clockwise in a gutter down its left edge, its description on hover: Brain (hypothalamus and pituitary), Blood Transport, Testes, Target tissues. Blood Transport is a compartment rather than an organ, drawn as a zone alike. (The spec's five horizontal bands became these four zones in the first build.)

**Where an arrow acts is data, not drawing.** Each arrow keeps its site as organ → region/tissue → cell → receptor, shown as its hover text — "T acts on Kp neurons in the arcuate nucleus via the androgen receptor":

| Arrow | Organ | Region / tissue | Cell | Receptor |
| --- | --- | --- | --- | --- |
| Kp → ↑GnRH, Cortisol → ↓GnRH | Hypothalamus | POA—ME | GnRH neurons | KISS1R, GR |
| T → ↓Kp, E2 → ↓Kp, PRL → ↓Kp | Hypothalamus | ARC | Kp neurons | AR, ER-α, PRLR |
| GnRH → ↑LH / ↑FSH, E2 → ↓LH, Inhibin B → ↓FSH | Pituitary | Anterior pituitary | Gonadotrophs | GnRHR, ER-α, Betaglycan |
| LH → ↑T | Testes | Interstitium | Leydig cells | LHR |
| FSH → ↑Inhibin B | Testes | Seminiferous tubules | Sertoli cells | FSHR |

Only two cells are ever seen, as **small text on their arrow**: "Leydig cells" on LH → ↑T and "Sertoli cells" on FSH → ↑Inhibin B. No sex-steroid feedback acts at the GnRH neurons: they largely lack AR and ER-α, so it acts at the Kp neurons (largely rodent evidence, to be verified against a retrieved citation).

### Signal

A molecule that carries information along the axis: T, E2, DHT, cortisol, GnRH, Kp, LH, FSH, prolactin, inhibin B. It is raised by the signal upstream, made by a conversion, or enters as a side input (cortisol, prolactin); every arrow that changes it lands on it. Where it comes from, and for T, DHT and E2 the target-cell receptor each acts on, is hover text. **DHT and E2 end at the receptors**: DHT's arrow lands on the androgen receptors and E2's path, through blood E2, on the estrogen receptors; no further arrow leaves either receptor. What each receptor's activation does in adult men is an **Effects** card under it instead — a short list, every effect citing its sources, read from `pathway-receptor-effects.json`.

The central T in Blood transport is the free pool: labeled "T", it carries **no amount** — the Free T badge shows it.

### Carrier

A binding protein: SHBG, albumin. T bound to a carrier is drawn **docked on it**, and docked T shows "T" plus its calculated amount (the same Vermeulen arithmetic as `cft` / `biot`). A carrier has no pathway arrow: **"more SHBG → less free T" is implied by docking and the ⇄ exchange, not drawn**, and the SHBG hover card says so.

### Enzyme

A converter: aromatase (T → E2), 5α-reductase (T → DHT), drawn as a node on its conversion path in the Target tissues band. Where it works is hover text.

## Badges

Badges are descriptive — they report a value, they do not make a diagnosis. They sit in one column on the right, under a testosterone pools donut, in the order Total T, Bioavailable T, Free Testosterone, T/LH, DHT/T, T/E2, with no group headings; Free Testosterone is one badge for every free-T value — measured (`2991-8`) and calculated by Vermeulen and by Ly & Handelsman — its face the Vermeulen figure, and every testosterone fraction also shows its % of total T. Two kinds:

- **Measures** of pools — Total T, Free T, Bioavailable T — each joined to the T bubbles it sums.
- **Ratios** of processes, each tied to what it reads:

| Ratio | Reads | Direction |
| --- | --- | --- |
| T/LH | the LH → ↑T arrow, at its "Leydig cells" label | output per unit of drive |
| DHT/T | 5α-reductase | higher = more conversion |
| T/E2 | aromatase | **low T/E2 = more aromatization** |

**Face** — value, unit, status dot, and a provenance icon: measured, calculated, or not measured (with a grey "–").

**Hover, focus or open** — its association lines appear, hidden at rest: one purple bus from the badge to a lane above its targets, a stub down to each, and a dashed ring around each target. Purple is never a status color, so it cannot be read as a judgement.

**Click** — expands meaning, what low means, what high means, and caveats (static text in the component in the first build). Wherever an index exists the text is to be `INDEX_DEFS`', never restated: `cft` for Free T, `biot` for Bioavailable T, and `tlh`, `dhtt`, `te2` for the ratios, a shorter summary derived from it at most. Only Total T, which has no index, has its own text with citations.

## Lines

Two families, visually distinct:

- **Association** — no arrowhead, no thickness, hidden until its badge is hovered, focused or open. Part of (a measure badge to the pools it sums), ratio link (a ratio badge to the enzyme or cell label it reads), docking (T on its carrier). A node sits in its band by containment, not by a line.
- **Pathway arrows** — signaling (signal → signal), conversion (T → enzyme → product), feedback and crosstalk (dashed), and exchange (⇄, free T ↔ docked T, unmarked).

A pathway arrow is **uncolored**. Its effect is marked on the target end: **↑B** means "B rises when the source rises", **↓B** "B falls when the source rises" — B being the arrow's target signal, a conversion's product (↑DHT) included. Its **thickness** has three steps, set by where the **source** value sits in its reference range; it is grey when the source was not measured that month.

## Icons

Custom SVG icons, one per role, redrawn by us in `customIcons.tsx` when used (Alex's final choices, 2026-09-11). Generated artwork may also ship, as illustration only — the brain image and Lipid Transport's liver are ChatGPT-generated, and both pages say so in a muted note — but any shape whose geometry encodes a quantity is drawn from cited reference data, and labelled artwork never stands in for it ([ADR-0022](../../tech/decisions/adr-0022-illustrative-artwork-and-data-drawn-glyphs-coexist.md)); Lipid Transport's particle icons (`CholesterolIcon`, `TriglycerideIcon`, joining `CarrierIcon`) are hand-drawn `customIcons.tsx` glyphs like every other role, no longer generated or data-computed.

| Role | Icon |
| --- | --- |
| Signal / hormone | a small hub circle with three branches ending in hollow circles, navy line |
| Carrier / transport protein | SHBG and albumin alike: a dense cluster of round beads — flat teal fill, navy outline — with an amber steroid docked in it, like a space-filling protein model |
| Enzyme | 5α-reductase and aromatase: a ring of small beads (a circular chain of small circles), light teal/blue |
| Cells / tissues | a few loose blue circles, each with a smaller circle (nucleus) inside |
| Provenance | flask = measured, calculator = calculated, dashed circle = not measured |

The carrier and the cells must stay visually distinct: a dense filled cluster against a few separate outlined circles with nuclei. A detailed steroid is angular fused rings, three hexagons and one pentagon. Badge groups carry no icon, and there is no receptor icon.

**Glyph size encodes level of organisation, not molecular mass** (Alex, 2026-09-16) — consistent with node kinds being roles, not chemistry — as an ordinal hierarchy doubling per step: molecular actors (the signals T, DHT, both E2, FSH and LH; the carriers SHBG and albumin; the enzymes; the receptors; and the SHBG-bound and albumin-bound T circles, the T docked inside each scaled to fit) 32px; cells (Sertoli, Leydig) 64px; organs (the brain image) 128px. Glyphs sit bare, with no tile or frame, and a new node takes the size of its level.

## Notation

The wiring reads in the same notation as the Reference Book's HP Axis page:

```text
signal → (site · subsite) ↑/↓ nextSignal → (site · subsite) ↑/↓ … ⟲
```

It is written as a restricted Mermaid flowchart — one subgraph per band, node shape the kind — with each arrow's site in a hand-edited sidecar, and generated to one file, `pathways.json`, which both views read ([ADR-0014](../../tech/decisions/adr-0014-pathway-wiring-is-mermaid-generated-to-json.md)), so the drawing and the text cannot disagree.

## What it is not

- **Not a monitoring panel** — a panel is a browsing group of markers; a pathway is a directed graph of roles, and a marker appears in it only where it acts.
- **Not diagnostic** — arrows and badges describe the user's values against the wiring; they do not classify primary vs secondary hypogonadism.
- **Not stored** — the wiring is reference data shipped with the app; the values on it are read from the user's [observations](observation.md) and [computed indices](computed-index.md) at display time.

## Deliberately out

- **FAI** (T / SHBG × 100) — validated in women and poor in men, so it joins with the women's axis.
- **An SHBG → ↓Free T arrow** — docking and ⇄ carry the effect.
- **Drawn cells, regions and receptors** — kept as per-arrow site data, shown on hover.
