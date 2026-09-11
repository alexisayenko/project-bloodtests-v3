# Pathway

> **Status: planned, not built** — specified 2026-09-11
> ([task-0024](../../tasks/task-0024.md),
> [ADR-0014](../../tech/decisions/adr-0014-pathway-wiring-is-mermaid-generated-to-json.md)).
> Nothing in the app implements this yet; what follows is the agreed shape.

One hormonal axis drawn as its wiring — organ bands, signals, carriers and enzymes joined by pathway arrows — with the user's own values for a selected month placed on it.

A [monitoring panel](monitoring-panel.md) lists markers; a pathway shows how they act on each other, so a reading is seen at the point in the axis where it happens.

## Scope for now

- **Men only, gonadal axis first.** The women's axis comes later, and with it FAI.
- **Month stepper** — one month at a time, stepping through the months the data has.
- **"Measured only | Full pathway"** — a toggle between the parts with a reading that month and the whole wiring, unmeasured parts grey.

## Node kinds

A node kind describes a **role in the axis, not chemistry**. T and LH are both signals although one is a steroid and one a glycoprotein; the chemical class appears only in hover text. A molecule can play several roles — T is a signal and the substrate of two conversions — and the line carries the relation, never a second kind.

Drawn: bands, signals, carriers, enzymes, badges and lines. **Not drawn**: cells, tissues and regions, and receptors — no node, shape or icon for any of them.

### Band

An organ, drawn as a horizontal band: Hypothalamus, Pituitary, Testes, Blood transport, Target tissues. Blood transport is a compartment rather than an organ, drawn as a band alike.

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

A molecule that carries information along the axis: T, E2, DHT, cortisol, GnRH, Kp, LH, FSH, prolactin, inhibin B. It is raised by the signal upstream, made by a conversion, or enters as a side input (cortisol, prolactin); every arrow that changes it lands on it. Where it comes from, and for T, DHT and E2 the target-cell receptor each acts on, is hover text. **DHT and E2 are end nodes**: no arrow draws their action on target cells.

The central T in Blood transport is the free pool: labeled "T", it carries **no amount** — the Free T badge shows it.

### Carrier

A binding protein: SHBG, albumin. T bound to a carrier is drawn **docked on it**, and docked T shows "T" plus its calculated amount (the same Vermeulen arithmetic as `cft` / `biot`). A carrier has no pathway arrow: **"more SHBG → less free T" is implied by docking and the ⇄ exchange, not drawn**, and the SHBG hover card says so.

### Enzyme

A converter: aromatase (T → E2), 5α-reductase (T → DHT), drawn as a node on its conversion path in the Target tissues band. Where it works is hover text.

## Badges

Badges are descriptive — they report a value, they do not make a diagnosis. Two kinds, on the right:

- **Measures** of pools — Total T, Free T, Bioavailable T — each joined to the T bubbles it sums.
- **Ratios** of processes, each tied to what it reads:

| Ratio | Reads | Direction |
| --- | --- | --- |
| T/LH | the LH → ↑T arrow, at its "Leydig cells" label | output per unit of drive |
| DHT/T | 5α-reductase | higher = more conversion |
| T/E2 | aromatase | **low T/E2 = more aromatization** |

**Face** — value, unit, status dot, and a provenance icon: measured, calculated, or not measured (with a grey "–").

**Hover** — the badge, its association lines and what it links to light up in one highlight color. The highlight is never a status color, so it cannot be read as a judgement.

**Click** — expands meaning, what low means, what high means, and caveats. Wherever an index exists the text is `INDEX_DEFS`', never restated: `cft` for Free T, `biot` for Bioavailable T, and `tlh`, `dhtt`, `te2` for the ratios, a shorter summary derived from it at most. Only Total T, which has no index, has its own text with citations.

## Lines

Two families, visually distinct:

- **Association** — no arrowhead, faint, no thickness. Part of (a measure badge to the pools it sums), ratio link (a ratio badge to the enzyme or cell label it reads), docking (T on its carrier). A node sits in its band by containment, not by a line.
- **Pathway arrows** — signaling (signal → signal), conversion (T → enzyme → product), feedback and crosstalk (dashed), and exchange (⇄, free T ↔ docked T, unmarked).

A pathway arrow is **uncolored**. Its effect is marked on the target end: **↑B** means "B rises when the source rises", **↓B** "B falls when the source rises" — B being the arrow's target signal, a conversion's product (↑DHT) included. Its **thickness** has three steps, set by where the **source** value sits in its reference range; it is grey when the source was not measured that month.

## Icons

Custom SVG icons, one per role, drawn by us in the woven-knot logo's line style — navy, 2px, round caps, no fills. ChatGPT, stock and AI images are inspiration only, never shipped.

| Role | Icon |
| --- | --- |
| Signal | a small hub with three branches ending in circles |
| Carrier | a ball of one thick woven thread with steroids docked in its gaps — SHBG holds one deep in a gap, Albumin two or three loosely at its edge |
| Enzyme | a closed ring of interlocked links (a hexagonal chain), no outward stubs |
| Provenance | flask = measured, calculator = calculated, dashed circle = not measured |

Carriers alone come filled — navy outline, teal fill, amber steroids — for diagram nodes, with a 24px line version and a soft 3D rendering for hover cards. A detailed steroid is angular fused rings, three hexagons and one pentagon. Badge groups carry no icon, and there is no tissue, cell or receptor icon.

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
