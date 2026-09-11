# Observation

A single lab-measurable quantity, identified by its LOINC code — the atomic unit the product reasons about (e.g. Hemoglobin, TSH, Creatinine).

## Identity

- **LOINC code** — the canonical identifier (e.g. `2345-7`). Two observations are the same observation iff they share a LOINC code.
- **Short name** — a compact label for dense UI (list rows, table cells), e.g. `TSH`, `FT4`, `CREA`.
- **Full name** — the human-readable friendly name (`friendlyName` in the catalog), e.g. "Free T4", "Creatinine".
- **LOINC long common name** — LOINC's own canonical description string, shown for disambiguation and linked out to `loinc.org/<code>`.

## What it is not

- **Not a result** — an observation is the definition of *what* is measured (name, code). A result is *when* a specific value was measured for a specific person, recorded as an entry in a [diagnostic report](lab-report.md).
- **Not a unit or reference range** — the lab running the assay determines the unit and reference range for each result; these are reported per diagnostic-report entry, not fixed by the observation.
- **Not a panel** — an observation doesn't know which [monitoring panels](monitoring-panel.md) it belongs to; that grouping is owned by the panel, not the observation.

## Where it lives today

Defined per-LOINC in `web/public/data/analyses.json` — the analyte catalog, and the **single source of truth for everything the app knows about a code** ([ADR-0010](../../tech/decisions/adr-0010-analyte-catalog-is-the-source-of-truth.md)). One entry carries the LOINC long common name, the friendly name (`friendlyName`) and its ru/uk translations, the popup copy (description / scientific / why / testing frequency), the short name (`short`), the unit the code is expected in (`unit`) and any further units accepted for it (`allowedUnits`), and — on a unit or method variant of another code — `aliasOf` plus `aliasLabel` naming the primary whose row it folds into.

No fact about a code lives in TypeScript. `web/src/data/analyteCatalog.ts` derives the lookup maps the app uses (short labels, expected units, and the reverse alias map: primary → its variants) from the catalog at load, so they cannot drift from it. `web/public/schema/analytes-1.schema.json` describes an entry and `web/test/reference-data.test.ts` holds the file to it, so a malformed edit fails the suite rather than being ignored at runtime.

Being in the catalog is what makes a code derivable by the [LOINC cross-check](../../tech/decisions/adr-0004-derive-loinc-from-name-and-unit.md) — an entry is added when the product genuinely measures the analyte, not as a place to park a label.
