# Pathway

> **Status: planned, not built** — specified 2026-09-11
> ([task-0024](../../tasks/task-0024.md),
> [ADR-0014](../../tech/decisions/adr-0014-pathway-wiring-is-mermaid-generated-to-json.md)).
> Nothing in the app implements this yet; what follows is the agreed shape.

One hormonal axis drawn as its wiring — sites, signals, carriers and enzymes joined by pathway arrows — with the user's own values for a selected month placed on it.

A [monitoring panel](monitoring-panel.md) lists markers; a pathway shows how they act on each other, so a reading is seen at the point in the axis where it happens.

## Scope for now

- **Men only, gonadal axis first.** The women's axis comes later, and with it FAI.
- **Month stepper** — one month at a time, stepping through the months the data has.
- **"Measured only | Full pathway"** — a toggle between the parts with a reading that month and the whole wiring, unmeasured parts grey.

## Node kinds

A node kind describes a **role in the axis, not chemistry**. T and LH are both signals although one is a steroid and one a glycoprotein; the chemical class appears only in hover text. A molecule can play several roles — T is a signal and the substrate of two conversions — and the line carries the relation, never a second kind.

### Site

Where something happens, nested **organ → region/tissue → cell → receptor**, drawn as a band, a small label, a large shape and a dot on the cell's edge. A receptor is the deepest site level: every signaling and feedback arrow lands on one, and every receptor has at least one arrow landing on it.

| Organ | Region / tissue | Cell | Receptors |
| --- | --- | --- | --- |
| Hypothalamus | ARC | Kp neurons | AR, ER-α, PRLR |
| Hypothalamus | POA—ME | GnRH neurons | KISS1R, GR |
| Pituitary | Anterior pituitary | Gonadotrophs | GnRHR, ER-α, Betaglycan |
| Testes | Interstitium | Leydig cells | LHR |
| Testes | Seminiferous tubules | Sertoli cells | FSHR |
| Target tissues | Prostate · skin · fat · bone | Target cells | AR, ER |

**Blood** is a band with no regions or cells — a compartment, not a site. The GnRH neurons carry no AR or ER-α: they largely lack both, so sex-steroid feedback lands on the Kp neurons (largely rodent evidence, to be verified against a retrieved citation).

### Signal

A molecule that carries information between sites: T, E2, DHT, cortisol, GnRH, Kp, LH, FSH, prolactin, inhibin B. It is secreted by a cell, made by a conversion, or enters as a side input (cortisol, prolactin), and acts by landing on a receptor.

The central T in Blood is the free pool: labeled "T", it carries **no amount** — the Free T badge shows it.

### Carrier

A binding protein: SHBG, albumin. T bound to a carrier is drawn **docked on it**, and docked T shows "T" plus its calculated amount (the same Vermeulen arithmetic as `cft` / `biot`). A carrier has no pathway arrow: **"more SHBG → less free T" is implied by docking and the ⇄ exchange, not drawn**, and the SHBG hover card says so.

### Enzyme

A converter: aromatase (T → E2), 5α-reductase (T → DHT). An enzyme sits inside the cell that expresses it and is drawn as a node on its conversion path.

## Badges

Badges are descriptive — they report a value, they do not make a diagnosis. Two kinds, on the right:

- **Measures** of pools — Total T, Free T, Bioavailable T — each joined to the T bubbles it sums.
- **Ratios** of processes, each tied to the node whose activity it reads:

| Ratio | Reads | Direction |
| --- | --- | --- |
| T/LH | Leydig cells | output per unit of drive |
| DHT/T | 5α-reductase | higher = more conversion |
| T/E2 | aromatase | **low T/E2 = more aromatization** |

**Face** — value, unit, status dot, and a provenance icon: measured, calculated, or not measured (with a grey "–").

**Hover** — the badge, its association lines and the nodes it links to light up in one highlight color. The highlight is never a status color, so it cannot be read as a judgement.

**Click** — expands meaning, what low means, what high means, and caveats. Wherever an index exists the text is `INDEX_DEFS`', never restated: `cft` for Free T, `biot` for Bioavailable T, and `tlh`, `dhtt`, `te2` for the ratios, a shorter summary derived from it at most. Only Total T, which has no index, has its own text with citations.

## Lines

Two families, visually distinct:

- **Association** — no arrowhead, faint, no thickness. Part of (a measure badge to the pools it sums), ratio link (a ratio badge to the cell or enzyme it reads), docking (T on its carrier). Nesting — a cell inside its organ — is drawn by containment, not by a line.
- **Pathway arrows** — secretion (cell → signal, unmarked), conversion (T → enzyme → product), signaling (signal → receptor), feedback and crosstalk (dashed), and exchange (⇄, free T ↔ docked T, unmarked).

A pathway arrow is **uncolored**. Its effect is marked on the target end: **↑B** means "B rises when the source rises", **↓B** "B falls when the source rises" — B being what the target cell then secretes, a target receptor's own activation (↑AR), or a conversion's product (↑DHT). Its **thickness** has three steps, set by where the **source** value sits in its reference range; it is grey when the source was not measured that month.

## Icons

Custom SVG icons, one per role, drawn by us in the woven-knot logo's line style — navy, 2px, round caps, no fills. ChatGPT, stock and AI images are inspiration only, never shipped.

| Role | Icon |
| --- | --- |
| Signal | a small hub with three branches ending in circles |
| Carrier | a ball of one thick woven thread with steroids docked in its gaps — SHBG holds one deep in a gap, Albumin two or three loosely at its edge |
| Enzyme | a closed ring of interlocked links (a hexagonal chain), no outward stubs |
| Tissue / region | a circle looking into tissue: four or five rounded, irregular cells with nucleus dots; it also stands for a cell |
| Receptor | a Y-shaped receptor spanning a double-line membrane arc |
| Provenance | flask = measured, calculator = calculated, dashed circle = not measured |

Carriers alone come filled — navy outline, teal fill, amber steroids — for diagram nodes, with a 24px line version and a soft 3D rendering for hover cards. A detailed steroid is angular fused rings, three hexagons and one pentagon. Badge groups carry no icon.

## Notation

The wiring reads in the same notation as the Reference Book's HP Axis page:

```text
signal → (site · subsite) ↑/↓ nextSignal → (site · subsite) ↑/↓ … ⟲
```

It is written as a restricted Mermaid flowchart — subgraph nesting gives the site level, node shape the kind — and generated to one file, `pathways.json`, which both views read ([ADR-0014](../../tech/decisions/adr-0014-pathway-wiring-is-mermaid-generated-to-json.md)), so the drawing and the text cannot disagree.

## What it is not

- **Not a monitoring panel** — a panel is a browsing group of markers; a pathway is a directed graph of roles, and a marker appears in it only where it acts.
- **Not diagnostic** — arrows and badges describe the user's values against the wiring; they do not classify primary vs secondary hypogonadism.
- **Not stored** — the wiring is reference data shipped with the app; the values on it are read from the user's [observations](observation.md) and [computed indices](computed-index.md) at display time.

## Deliberately out

- **FAI** (T / SHBG × 100) — validated in women and poor in men, so it joins with the women's axis.
- **An SHBG → ↓Free T arrow** — docking and ⇄ carry the effect.
