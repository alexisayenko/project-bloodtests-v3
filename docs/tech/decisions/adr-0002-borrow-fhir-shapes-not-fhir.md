# ADR-0002: borrow FHIR's shapes, without adopting FHIR

Status: accepted · 2026-08-27

## Context

The interchange format —
see [`interchange-format.md`](../interchange-format.md#standards-this-format-borrows-from) —
needed answers to problems that are not novel: results that are
not numeric, values printed as `< 0.01`, reference ranges that
are threshold-based, multi-band (Desirable / Borderline / High),
sex-specific or age-banded, and the lab's own verdict printed as
an arrow or a flag.

The previous model — a single `refMin`/`refMax` pair plus a
display-only `refText` — could represent none of those without
discarding something the report actually printed.

FHIR ([Fast Healthcare Interoperability
Resources](https://hl7.org/fhir), HL7's standard, itself
JSON-based) has field-tested answers to exactly these three:
`Observation.referenceRange` as a repeating element with
`low` / `high` / `type` / `appliesTo` / `age` / `text`,
`Quantity.comparator`, and `Observation.interpretation` codes.

## Decision

**Borrow the *shape* of those three answers; do not adopt FHIR
as the format.** They appear here as
[`referenceRanges`](../interchange-format.md#referenceranges),
[`comparator`](../interchange-format.md#comparator) and
[`interpretation`](../interchange-format.md#interpretation).

Full FHIR makes every field a CodeableConcept bound to a
terminology system, with references between Patient, Specimen and
DiagnosticReport resources — roughly an order of magnitude more
JSON than two self-owned apps need. Borrowing costs nothing,
because FHIR is a set of JSON shapes rather than a rival file
format.

This format's own [`DiagnosticReport`](../interchange-format.md#diagnosticreport) —
one report from one lab, covering one sample — takes its name from
FHIR's resource of the same name, borrowing the name but not its
reference-heavy shape.

Because the shapes match, a later export to real FHIR is a
mapping exercise rather than a redesign.

## Consequences

- Deliberately **not** borrowed: UCUM for
  [`unit`](../interchange-format.md#unit), which stays as the lab
  printed it, and SNOMED CT for coded values, where plain
  controlled strings (`serum`, `plasma`, `citrate`) are used
  instead.
- This file is not FHIR and must never be presented as such; no
  FHIR validator will accept it.
- Revisit when any of these appears: data needing to come in from
  or go out to a hospital, Apple Health, or a doctor; or a second
  consumer that is not one of these two apps.
