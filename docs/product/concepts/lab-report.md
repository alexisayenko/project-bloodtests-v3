# Lab report

The document a lab issues from one blood sampling (draw) — one date, one lab, a set of entries. What the product actually receives and parses; it never sees the draw independently.

## Identity

- **Date** — when the draw was taken.
- **Place** — the lab that performed it.
- **Entries** — one per [observation](observation.md) measured from the draw.

## Lab report entry

Each entry is one line in the report:

- **Observation** — which LOINC was measured. The name/identity is looked up from the static catalog (see [observation](observation.md)); the report itself only needs to carry the LOINC code.
- **Result** — the value produced by the lab's assay, plus the unit it was reported in (units vary by assay, so they travel with the entry, not the observation).
- **Reference range** — the lab's own range for that assay, not a fixed universal range.
- **Method** — the assay used.

## What it is not

- **Not the draw itself** — the blood sampling is the physical event (a date + a needle); the lab report is the document the lab issues after analyzing that draw. The product only ever sees the report.
- **Not an observation** — a lab report doesn't define what an observation is; it records results against observations.

## Where it lives today

`DiagnosticReport`/`Result` in `web/src/types/index.ts` (`date`, `place`, `items: Result[]`), populated via upload parsing (`parseUpload.ts`) and held in `ResultsContext`. Code naming (`DiagnosticReport`/`Result`) is aligned to FHIR terminology for lab reports.
