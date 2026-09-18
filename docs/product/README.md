# Product

Paneloom helps people make sense of their bloodwork as a connected
picture over time, so they can participate more confidently in
conversations with their doctor. Three pillars shape every feature:
**reduce complexity** — make results, units, reference ranges, and
terminology easier to navigate, and flag possible inconsistencies for
review; **show the whole picture** — connect related measurements and
show how they change over time, keeping gaps and uncertainty visible
(by "holistic view" we mean helping you understand how your blood test
results relate to each other and change over time, while recognizing
that they are only one part of your overall health picture); and
**build understanding** — explain what measurements represent and how
they relate, helping people research, prepare questions, and understand
the context of their doctor's recommendations. Users don't need to
arrive with medical knowledge, but understanding their results involves
learning — Paneloom makes that learning approachable and connects it
to their own data. The Reference Book and pathway diagrams are central
to this purpose: they explain what a marker represents and how related
processes work, enough to build a solid understanding without
requiring a deep dive into molecular biology or biochemistry.

**Purpose:** enable anyone who receives bloodwork to understand more
than whether each number falls inside a reference range — to see the
connections, the trends, and the context that makes a conversation
with a specialist productive.

For the wider docs/ map and what-lives-where, see
[`../README.md`](../README.md).

## Folder map

The product subtree (full docs tree in
[`../README.md#subtree-map`](../README.md#subtree-map)):

```text
product/
├── README.md      # this file — core idea + product-section glossary
├── concepts/      # one file per domain noun — entry: concepts/README.md
└── features/      # one file per product capability — entry: features/README.md
```

## Glossary

Vocabulary for the product section. Domain words ("painting",
"garment", "palette") are *concept names* — they belong in
[`concepts/`](concepts/), not here.

The product taxonomy is a four-level chain — each level composes
the next. See [`../README.md#glossary`](../README.md#glossary)
for the cross-tree index.

- **Concept** — a *noun* in the product vocabulary — a stable
  thing the product reasons about, independent of any UI. One file
  per concept in [`concepts/`](concepts/). Covers data model,
  invariants, edge cases.
- **Feature** — a *verb* — the smallest unit that delivers value
  to the user. One file per feature in [`features/`](features/).
  A feature acts on one or more concepts.
- **Screen** — a *place* — a UI page where features get exposed.
  One file per screen in
  [`../ui-ux/screens/`](../ui-ux/screens/). A single feature can
  appear on multiple screens; a single screen hosts multiple
  features.
- **Journey** — a *sequence* — a path the user takes across
  multiple screens (onboarding, first-add → save, recovery flow).
  Journeys live in
  [`../ui-ux/journeys.md`](../ui-ux/journeys.md) (one section per
  journey, extracts to `journeys/` when they grow). A journey threads
  screens; defined and detailed in
  [`../ui-ux/README.md`](../ui-ux/README.md).
- **Constraint** — a self-imposed product limit ("we won't do X,
  even though we technically could"). Distinct from *compliance*
  (externally imposed; lives in
  [`../business/compliance.md`](../business/compliance.md)).

The chain in one line: **concept = noun, feature = verb,
screen = place, journey = sequence**. If you can phrase the spec
as "the user can [verb]", it's a feature. If it's "the thing
called [noun]", it's a concept. If it's "the page where the user
is when they do it", it's a screen. If it's "the path from one
page to the next", it's a journey.

For **Concerns** — the cross-cutting work-area axis used in task
frontmatter (orthogonal to product sections) — see
[`../concerns.md`](../concerns.md).

## Constraints

Self-imposed product limits — things we won't do even though we
technically could. Externally-imposed obligations (licensing,
compliance, attribution) live in
[`../business/compliance.md`](../business/compliance.md), not here.

- **Understanding, not diagnosis.** Paneloom supports understanding
  and preparation; clinical interpretation and decisions about what
  to do next belong with a qualified specialist. This shapes
  features (no risk scores, no treatment suggestions) and wording
  (always "consult a specialist" — we are not doctors).
- **Your data stays yours.** Results live in the browser. Nothing
  leaves the device except through a deliberately generated share
  link and an explicit, values-free LOINC name lookup (NLM). No
  backend accounts are required for the core experience.
