# Concepts

Domain nouns — stable things the product reasons about,
independent of any UI. One file per concept.

Audience: developers and agents working on the codebase. Concepts
are the durable vocabulary the product is built around; features
([`../features/`](../features/)) act on concepts.

## What a concept is

A concept is a *noun* in the product vocabulary — a thing that
exists in the product's mental model and persists across UIs and
features. Each file covers data model, invariants, edge cases,
and constraints.

Current concepts: [observation](observation.md),
[monitoring panel](monitoring-panel.md),
[diagnostic report](lab-report.md), [computed index](computed-index.md).

## What a concept is not

- **Not a feature** — features are verbs (capabilities). They
  live in [`../features/`](../features/).
- **Not a screen** — screens are pages where concepts and
  features are exposed. They live in
  [`../../ui-ux/screens/`](../../ui-ux/screens/).
- **Not implementation detail** — concepts describe the product's
  view of the noun, not the database table. The data model in a
  concept doc is product-shaped, not storage-shaped.

## Naming convention

File name = the concept name in `kebab-case.md`
(e.g. `painting.md`, `garment.md`, `palette.md`).

Singular nouns. The folder is plural; the files are singular.

## File structure

Each concept file is project-specific. Sections emerge from
what the concept actually needs — a static reference noun has
a different shape from a stateful entity, and concepts within
the same project often differ from each other. Don't impose a
fixed skeleton.

The only convention: lead with the concept name as `# Title`
and a one-line definition underneath, so a reader knows what
they're looking at without reading further.

```markdown
# <Concept name>

One-line definition. What this noun *is* in product terms.

[concept-specific sections — pick what fits this concept]
```

## Adding a new concept

1. A domain noun emerges in design or implementation.
2. Create `concepts/<noun>.md` (kebab-case, singular).
3. Cross-link from any feature specs that act on it.
