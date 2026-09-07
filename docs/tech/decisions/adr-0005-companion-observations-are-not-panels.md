# ADR-0005: companion observations are not panels

Status: accepted · 2026-09-07

## Context

Some markers are only interpretable when drawn with others:
homocysteine against B12 / folate / B6, ferritin against iron /
transferrin / TIBC, calcium against magnesium / vitamin D / PTH,
TSH against FT4, glucose against insulin. The app already has two
relation kinds — monitoring panels (`panels.json`: per-condition
groups of LOINCs the user browses) and computed-index inputs
(`INDEX_DEFS`: hard co-requirements, wired to scheduling so that
scheduling an index schedules its inputs) — and the obvious move
was to express "draw together" as more panels, or as extra panel
membership.

Neither fits. A companion pair is per-marker and
condition-independent: ferritin wants iron / transferrin / TIBC
whether the user is looking at Anemia or Fatty Liver. As a panel
it would either be a pseudo-condition ("Iron Studies") competing
with real ones in the grid, or need duplicating into every panel
that carries ferritin. And it is soft: nothing breaks when a
companion is missing, unlike an index input, so wiring it into
scheduling as a hard rule would over-schedule.

## Decision

**Companion observations are a third relation kind, distinct from
panels and index inputs.** They live as a per-marker `companions`
list (LOINC codes) in `web/public/data/analyses.json`, beside the
marker's existing copy, and surface only as a soft hint in the
Scheduled column of Panel Detail's Analysis tab. Panels stay
per-condition browsing groups; index inputs stay the only relation
that drives scheduling. Concept page:
[companion observation](../../product/concepts/companion-observation.md).

Not built yet. Research per marker family, with sources and
verbatim quotes, is reviewed in `docs/product/companions-research.md`
before the catalog changes.

## Consequences

- `analyses.json` becomes the home for per-marker relations, not
  just copy; `panels.json` stays purely condition → LOINC list.
- The Analysis tab gains one more relation to render beside the
  existing index-input • markers; the hint must read as a
  suggestion, not as a missing-input error.
- Scheduling semantics are unchanged: scheduling an observation
  never auto-schedules its companions.
- A companion list without a cited source doesn't ship — the
  research doc gates the catalog.

## What would force revisiting

- Companions turning out to be condition-dependent in practice
  (the same marker wanting different companions in different
  panels).
- Users treating the hint as mandatory, making a hard "schedule
  with companions" action worth adding — at which point it
  converges on index-input semantics.
