# Concerns

Cross-cutting axes the project organizes work around — orthogonal
to sections (`brand/`, `business/`, `tech/`, etc.). Each concern
carries an ID (`C1`, `C2`, …) so it can be referenced
unambiguously in conversation and frontmatter.

A concern captures a real-world unit of work that touches multiple
sections. Two common shapes:

- **Persistent layers** — product capabilities that live on once
  shipped. Example: a *subscription layer* touches business
  (pricing, legal terms), ui-ux (paywall screens), features
  (unlock, restore), and tech (billing integration, entitlement
  storage). Stays in play across the lifetime of the product.
- **Bounded release goals** — coherent bodies of work that close
  on a release event. Example: *first release on App Store*
  touches tech (stack picks, build pipeline), product
  (concepts + features), ui-ux (polish), brand (icons, store
  listing), business (pricing, store metadata). Concern closes
  once shipped; subsequent app-store work goes under a new
  concern (`v2 launch`, etc.).

Both shapes are referenced the same way — task frontmatter
(`concern: C2 - Subscription layer`). Persistent concerns
accumulate tasks indefinitely; bounded concerns close once their
event ships.

Concerns cut across spec sections: a single concern draws on
multiple sections simultaneously. That's why they live at the
top of `docs/`, not inside any one section.

Per-concern roll-ups live alongside as `tasks/C1.md`,
`tasks/C2.md`, …, regenerated when underlying task frontmatter
changes — see [`tasks/README.md`](tasks/README.md).

When a new area of work appears that doesn't fit any existing
concern, add a new `Cn` here first, then start tagging tasks
against it.

---

## C1 — [TODO: concern name]

[TODO: 1-3 sentences — what work falls under this slice. What it
spans across sections.]

- Lives in: [TODO: paths where this work shows up — e.g.
  `web/`, `data/`, `scripts/`]
- Source spec: [TODO: link to the relevant section/file]

## C2 — [TODO: concern name]

[TODO: …]

- Lives in: [TODO]
- Source spec: [TODO]

---

## Draft notes (2026-09-09, not yet formulated)

Sketched in conversation, kept so the thinking is not lost. Deliberately
not written as `C1` / `C2` yet — the names and the boundary between them
are still moving, and tagging tasks against a shape that changes costs
more than waiting.

**Something like "Core functionality"** — the engine. Import reports,
display observations, group by panels, descriptions and cited
references, charts for trends, normalize units and codes so different
laboratories compare, compute indices, validate the import and flag what
cannot be trusted, export and back up. Broadly built. The elaborations —
share links, the scheduler, the 3D chart, the Reference Book prose —
probably sit outside it.

**Something like "Make data trustworthy"** — the one that is barely
started, and the reason the app does not yet *feel* dependable even with
582 tests and cited sources. Tests establish that the code does what the
code intends; nothing establishes that the numbers correspond to what a
laboratory actually printed. Candidate pieces:

- Normalization — units and naming. Largely done (task-0011).
- LOINC validation and cross-check. Done (task-0007, task-0009).
- **User approval, with a hash as the signature of what was approved.**
  The envelope already carries `contentHash`, used today only as an
  integrity check. Making it record what the reader reviewed turns
  "approved" into a first-class state: divergence later shows the data is
  no longer the set that was checked, and the UI can separate verified
  reports from raw model output.
- **Verify the transcription against the source report.** The deepest
  hole: reports enter by pasting a prompt into a chatbot and pasting JSON
  back, so a model reads numbers off a PDF and nothing checks them. One
  misread digit propagates into every chart, index and trend, silently
  and permanently. See task-0005.
- **Cross-check reported against computed.** Laboratories print values
  the app also derives — LDL-C, non-HDL-C. Where both exist, a
  disagreement beyond rounding means one of the two is wrong. Costs
  nothing, since both numbers are already in the file.

The open question under all of this is what "trustworthy" is allowed to
mean when the pipeline begins with a language model reading a PDF.
