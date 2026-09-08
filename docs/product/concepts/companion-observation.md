# Companion observation

> **Status: planned, not built** — decided 2026-09-07
> ([ADR-0005](../../tech/decisions/adr-0005-companion-observations-are-not-panels.md)).
> Nothing in the app implements this yet; what follows is the agreed
> shape, pending research.

A soft "draw together" hint attached to one [observation](observation.md): another observation worth ordering on the same [diagnostic report](lab-report.md) because it makes the first one interpretable (e.g. Homocysteine with B12 / Folate / B6; Ferritin with Iron / Transferrin / TIBC; Calcium with Magnesium / Vitamin D / PTH; TSH with FT4; Glucose with Insulin).

## Structure

- **Owner** — the observation the hint hangs off (by LOINC code).
- **Companions** — the observations (by LOINC code) suggested alongside it.
- **Condition-independent** — the pair holds whichever [monitoring panel](monitoring-panel.md) the user is looking at; it's a property of the marker, not of a condition.

## What it is not

- **Not a monitoring panel** — a panel is a per-condition browsing group; a companion is per-marker and travels with the marker into every panel it appears in. Folding companions into panels would either duplicate them across panels or tie them to one condition.
- **Not a computed-index input** — an index's inputs are hard co-requirements (no inputs, no index), already wired to scheduling: scheduling an index schedules its inputs. A companion is a hint only; scheduling an observation never auto-schedules its companions.
- **Not stored per user** — like panels, it's reference data shipped with the app, not something recorded in a diagnostic report.

The three relation kinds side by side:

| Relation | Scope | Strength | Home |
| --- | --- | --- | --- |
| [Monitoring panel](monitoring-panel.md) | per condition | browsing group | `monitoring-panels.json` |
| [Computed index](computed-index.md) inputs | per index | hard co-requirement; drives scheduling | `INDEX_DEFS` |
| Companion observation | per marker | soft hint | `analyses.json` `companions` (planned) |

## Where it will live

A per-marker `companions` list (LOINC codes) in `web/public/data/analyses.json`, beside the marker's name/description copy. Surfaced in one place only: the Scheduled column of Panel Detail's Analysis tab, as a hint beside a scheduled observation whose companions aren't scheduled. No other UI.

Research comes first — per marker family, with sources and verbatim quotes, reviewed in `docs/product/companions-research.md` before the catalog is touched. Tracked as [task-0010](../../tasks/task-0010.md).
