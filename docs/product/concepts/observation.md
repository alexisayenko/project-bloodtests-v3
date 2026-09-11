# Observation

A single lab-measurable quantity, identified by its LOINC code — the atomic unit the product reasons about (e.g. Hemoglobin, TSH, Creatinine).

## Identity

- **LOINC code** — the canonical identifier (e.g. `2345-7`). Two observations are the same observation iff they share a LOINC code.
- **Friendly name** — the clinical name the UI shows (`friendlyName`), e.g. "Free T4", "Creatinine".
- **Short name** — our compact label for dense UI (`shortName`), e.g. `TSH`, `FT4`, `CREA`.
- **LOINC name** — LOINC's own long common name (`longCommonName`), shown for disambiguation and linked out to `loinc.org/<code>`.

Each is defined once, in [Names](#names) below.

## What it is not

- **Not a result** — an observation is the definition of *what* is measured (name, code). A result is *when* a specific value was measured for a specific person, recorded as an entry in a [diagnostic report](lab-report.md).
- **Not a unit or reference range** — the lab running the assay determines the unit and reference range for each result; these are reported per diagnostic-report entry, not fixed by the observation.
- **Not a panel** — an observation doesn't know which [monitoring panels](monitoring-panel.md) it belongs to; that grouping is owned by the panel, not the observation.

## Where it lives today

Defined per-LOINC in `web/public/data/analyses.json` — the analyte catalog, and the **single source of truth for everything the app knows about a code** ([ADR-0010](../../tech/decisions/adr-0010-analyte-catalog-is-the-source-of-truth.md)). One entry carries the LOINC long common name, the friendly name (`friendlyName`) and its ru/uk translations, the popup copy (description / scientific / why / testing frequency), the short name (`shortName`), the unit the code is expected in (`unit`) and any further units accepted for it (`allowedUnits`), and — on a unit or method variant of another code — `aliasOf` plus `aliasLabel` naming the primary whose row it folds into.

No fact about a code lives in TypeScript. `web/src/data/analyteCatalog.ts` derives the lookup maps the app uses (short names, expected units, and the reverse alias map: primary → its variants) from the catalog at load, so they cannot drift from it. `web/public/schema/analytes-1.schema.json` describes an entry and `web/test/reference-data.test.ts` holds the file to it, so a malformed edit fails the suite rather than being ignored at runtime.

Being in the catalog is what makes a code derivable by the [LOINC cross-check](../../tech/decisions/adr-0004-derive-loinc-from-name-and-unit.md) — an entry is added when the product genuinely measures the analyte, not as a place to park a label.

## Names

The single source of truth for what each name is called — one term per concept, the same in code, data, schema, UI and docs.

| Field | Called in prose / UI | What it is |
|---|---|---|
| `rawName` | printed name ("Printed name" column) | The test name exactly as the lab printed it, in any language. Provenance only: kept on the result and in the interchange envelope, never shown in place of a friendly name. Stored sessions from before the rename carry it as `analysis`, read into `rawName` on load. |
| `friendlyName` | friendly name ("Name" column) | The clinical name the app prints, derived from the LOINC code at display time and never stored on a result. |
| `shortName` | short name | Our badge abbreviation (`TSH`, `HbA1c`), falling back to `friendlyName` where an entry has none. Ours — **not** LOINC's SHORTNAME field. |
| `longCommonName` | LOINC name (under the code in the Reference Book's LOINC database) | LOINC's own long common name, verbatim — the authority on what the code means. |
| `aliasLabel` | alias label | On a unit or method variant of another code (`aliasOf`), how it differs from its primary: "nmol/L unit", "IFCC unit". |

Computed indices use the same two names: an index's `friendlyName` ("Atherogenic coefficient") and `shortName` ("AC"). Its `inputKeys` (`TC`, `HDL-C`) are keys into `MARKER_LOINC`, not names shown to anyone.

The LOINC cross-check's `resolvedName` is not a separate kind of name: it is the printed code's `friendlyName` from the catalog (its `longCommonName` only if it had none), or NLM's name for a code the catalog lacks.
