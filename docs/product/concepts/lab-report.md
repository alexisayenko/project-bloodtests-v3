# Diagnostic report

The document a lab issues from one blood sampling (draw) — one date, one lab, a set of entries. What the product actually receives and parses; it never sees the draw independently.

**Terminology note:** This page uses the FHIR term *diagnostic report* rather than "lab report". They mean the same thing: one report from one lab, covering one sample. FHIR's `DiagnosticReport` is a well-established structure in healthcare IT; borrowing the term aligns our data model with that convention. See [ADR-0002](../tech/decisions/adr-0002-borrow-fhir-shapes-not-fhir.md) for why we borrow terminology and shapes selectively, not the full spec.

## Identity

- **Lab** — the laboratory's name.
- **Collected at** — when the sample was taken.
- **Observations** — one per [observation](observation.md) measured from the sample.

## DiagnosticReport structure

A diagnostic report is structured as:

```
{
  "lab": "NeoGenesis",
  "collectedAt": "2026-05-07T08:23:00Z",
  "issuedAt": "2026-05-13T15:26:00Z",    // optional
  "identifiers": { ... },                 // optional
  "specimen": { "material": "plasma" },   // optional
  "observations": [ /* Observation objects */ ]
}
```

Each observation is one line in the report:

- **LOINC** — which test was measured. The name/identity is looked up from the static catalog (see [observation](observation.md)); the report itself only needs to carry the LOINC code.
- **Value** — the numeric or non-numeric result produced by the lab's assay.
- **Unit** — the unit it was reported in (units vary by assay, so they travel with the observation, not globally).
- **Reference range** — the lab's own range for that assay, not a fixed universal range.
- **Method** — the assay used.

## What it is not

- **Not the draw itself** — the blood sampling is the physical event (a date + a needle); the diagnostic report is the document the lab issues after analyzing that draw. The product only ever sees the report.
- **Not an observation** — a diagnostic report doesn't define what an observation is; it records observations against them.

## Where it lives

- **Interchange format:** `DiagnosticReport` shape in [`docs/tech/interchange-format.md`](../tech/interchange-format.md#diagnosticreport)
- **Code:** `DiagnosticReport`/`Result` in `web/src/types/index.ts` (`date`, `place`, `items: Result[]`), populated via upload parsing (`parseUpload.ts`) and held in `ResultsContext`

Naming in both places (`DiagnosticReport`, `Result` + `Observation`) is aligned to FHIR terminology, though the data model is deliberately simplified (not a full FHIR import).
