# Observation

A single lab-measurable quantity, identified by its LOINC code — the atomic unit the product reasons about (e.g. Hemoglobin, TSH, Creatinine).

## Identity

- **LOINC code** — the canonical identifier (e.g. `2345-7`). Two observations are the same observation iff they share a LOINC code.
- **Short name** — a compact label for dense UI (badges, chip grids), e.g. `TSH`, `FT4`, `CREA`.
- **Full name** — the human-readable display name, e.g. "Free T4", "Creatinine".
- **LOINC long common name** — LOINC's own canonical description string, shown for disambiguation and linked out to `loinc.org/<code>`.

## What it is not

- **Not a result** — an observation is the definition of *what* is measured (name, code, reference info). A result is *when* a specific value was measured for a specific person. Results are recorded against an observation.
- **Not a panel** — an observation doesn't know which [monitoring panels](monitoring-panel.md) it belongs to; that grouping is owned by the panel, not the observation.

## Where it lives today

Defined per-LOINC in `web/public/data/analyses.json` (source of truth for name/description/testing-frequency copy in en/ru/uk).
