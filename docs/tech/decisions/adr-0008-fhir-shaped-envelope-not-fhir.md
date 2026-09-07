# ADR-0008: FHIR-shaped, not FHIR-conformant, with LOINC identity

Status: accepted · 2026-09-07

## Context

Two vocabulary-and-shape choices were made early and never written
down. The interchange envelope
([`interchange-format.md`](../interchange-format.md)) is organised
exactly like FHIR's lab model — diagnostic reports containing
observations, each with reference ranges, an interpretation, a
comparator and a specimen — and every analyte is identified by a
LOINC code, never by its printed name.

[ADR-0002](adr-0002-borrow-fhir-shapes-not-fhir.md) recorded only
the narrow half of this: three field *shapes* borrowed from FHIR
to solve three modelling problems. It did not record why the whole
envelope follows FHIR's outline, why LOINC and not SNOMED CT
identifies analytes, or — the part that keeps costing time —
exactly where the format diverges from FHIR. Without that list,
"it's FHIR-shaped" reads to a newcomer as "it's FHIR", and the
first attempt to run it through a FHIR validator fails
confusingly.

The constraints that decide this are unusual. The app is
local-first with no backend, holds one subject's data, and its
payloads are written by a chatbot from a photographed report and
then hand-edited by the user in the Diagnostic Report detail view.
Anything the format demands, a chatbot has to emit correctly and a
human has to be able to read and fix.

## Decision

**The envelope is deliberately FHIR-shaped and deliberately not
FHIR-conformant, with LOINC as the sole analyte vocabulary.**

FHIR supplies the outline and the field names, so the concepts are
the ones the domain already agreed on, and a later mapping to real
FHIR stays mechanical. Conformance is refused, because every
mechanism that makes FHIR conformant — resource identity,
references between resources, CodeableConcept everywhere — costs
JSON that a chatbot must get right and a human must read past,
and buys nothing for a single-subject file with no second system
at the other end.

LOINC is the analyte identity because it is the vocabulary FHIR
itself points at: `Observation.code` is bound to
"[LOINC Codes](https://hl7.org/fhir/R4/observation.html)", and
SNOMED International describes its own joint work with Regenstrief
as integrating "LOINC's granular laboratory observables" into
SNOMED CT's framework
([SNOMED International](https://docs.snomed.org/implementation-guides/loinc-implementation-guide/introduction/1.-introduction)).
LOINC names the question; the app has almost no coded answers to
name.

## Divergences from FHIR

Verified against `web/public/schema/bloodtests-3.schema.json`,
`web/src/data/parseUpload.ts` and `web/src/utils/exportData.ts`.

- **No resources and no Bundle.** The file is one plain object,
  `{ schema, generatedAt, contentHash, subject?, sex?, birthYear?,
  notes?, diagnosticReports[] }` — not a Bundle with `type`,
  `timestamp` and `entry[]`. Nothing carries `resourceType`, `id`,
  `meta` or a `text` narrative.
- **Observations inline, not referenced.** FHIR's
  `DiagnosticReport.result` is `0..*` `Reference(Observation)`
  into a Bundle; here `observations` is an array of plain objects
  inside the report. One file, one reading order, no resolver.
- **No `status`, no `code`, no `category`.** FHIR makes `status`
  mandatory on both DiagnosticReport and Observation and `code`
  mandatory on both. This format has none of the three: a report
  is identified by `lab` plus `collectedAt`, and a chatbot has no
  way to know whether a printed report was `preliminary` or
  `final`.
- **LOINC as a bare string.** `loinc` is `"718-7"`, validated
  against `^(\d{1,7}-\d)?$` — not a CodeableConcept carrying
  `system: "http://loinc.org"`. The system is implied by the
  field name. The empty string is legal and means "the report
  printed no LOINC", which FHIR's `1..1 code` cannot express; the
  printed test name lives in a sibling `name` field as
  provenance, not in `code.text`.
- **Value is a number, not a Quantity.** `value` is a JSON number
  and `unit` the string the lab printed — no UCUM `system`/`code`
  pair (see [ADR-0007](adr-0007-ucum-as-the-unit-vocabulary.md)
  for the eventual target, and
  [ADR-0003](adr-0003-store-only-what-the-lab-printed.md) for why
  the printed form is kept). `comparator` uses FHIR's own code set
  but sits beside `value` instead of inside a Quantity, and
  `rawValue` — the printed result kept alongside the parsed one —
  has no FHIR counterpart at all.
- **Reference ranges flattened.** `low`/`high` are plain numbers,
  not SimpleQuantity; `label` is a free string where FHIR has
  `type` as a CodeableConcept; `appliesTo` is one object with a
  two-value `sex` enum, not `0..*` CodeableConcept; `ageLow` and
  `ageHigh` are two numbers, not `age` as a Range of quantities.
- **Coded fields as plain strings.** `interpretation` is a single
  code from FHIR's ObservationInterpretation set (`N`, `H`, `L`,
  `HH`, `LL`, `POS`, `NEG`, `A`) rather than `0..*` CodeableConcept
  with a system URI; `specimen` is an inline `{ material,
  additive }` of controlled words rather than
  `Reference(Specimen)`; `method` and `lab` are the printed
  strings, where FHIR wants a CodeableConcept and a
  `performer: Reference(Organization)`.
- **No Patient.** `subject` is one deliberately non-identifying
  string at envelope level, with `sex` and `birthYear` beside it
  purely as reference-range selectors — not a Patient resource
  referenced from every Observation. The file is about one person
  by construction, so the subject is a property of the file rather
  than of each row.
- **Dates renamed and coarsened.** `collectedAt` and `issuedAt`
  stand where FHIR has `effectiveDateTime` and `issued`, and
  collection time in FHIR properly belongs to
  `Specimen.collection.collectedDateTime`. Export writes
  `` `${date}T00:00:00Z` `` — a date padded to a midnight instant
  it does not actually know.
- **Report identifiers are a flat open map.** `identifiers` holds
  `visit` / `order` / `accession` plus any lab-specific key, all
  plain strings, rather than `identifier: [Identifier]` with
  system and value — and identifiers of the *person* are excluded
  from the file entirely.
- **Panels are not in the payload.** FHIR groups a battery through
  a parent Observation's `hasMember`, or through
  `DiagnosticReport.result`. Here monitoring panels are app
  catalog data (`web/public/data/panels.json`) joined on LOINC at
  read time, so the file carries results and nothing about how
  they group.

## Alternatives considered

- **FHIR proper (R4/R5).** The honest option, and the one that
  would give validators, libraries and a real path into other
  systems. It costs a Bundle of Patient, Specimen, Organization
  and Observation resources with `fullUrl` references between
  them, mandatory `status` and `code` on everything, and a
  CodeableConcept around every coded field — for a file a chatbot
  writes and a person edits by hand. The volume is the problem,
  not the concepts: nothing in FHIR's lab model is wrong here, it
  is simply built for exchange between institutions that this app
  does not have.
- **HL7 v2 ORU^R01.** The message format most labs actually emit,
  with results as OBX segments under an OBR observation request,
  under a PID. It is a pipe-delimited wire format for messaging
  between systems, not a document a browser stores in
  `localStorage` or a chatbot composes; it needs a parser on both
  ends, and there is no second system on the other end to justify
  one.
- **openEHR.** The strongest clinical model of the four: a
  laboratory test result OBSERVATION archetype containing
  analyte-result CLUSTERs, constrained into templates, with the
  model kept outside the software. That separation is exactly what
  a large multi-institution EHR needs and exactly what this app
  cannot use — the archetype/template toolchain, and the
  governance around it, is larger than the whole application.
- **SNOMED CT instead of, or alongside, LOINC.** SNOMED CT is a
  clinical ontology, and the convention in lab data is that LOINC
  identifies the observable and SNOMED CT codes qualitative
  *findings*. This app plots numbers: it has thousands of
  quantitative results and almost no coded answers, so a second
  vocabulary would sit in the file unused. Running both means
  maintaining the mapping between them, and the two organisations'
  own cooperative agreement is the reason not to bother — LOINC's
  observables are being expressed in SNOMED CT's framework
  upstream, so a later crosswalk is someone else's published
  artefact rather than this project's problem.

## Consequences

- No off-the-shelf interoperability. No FHIR validator, no FHIR
  client library, no server will accept this file, and it must
  never be described as FHIR — only as FHIR-shaped.
- The correctness burden moves in-house: validation is this
  project's own
  (`web/src/data/validateDiagnosticReports.ts`, plus the JSON
  Schema at `web/public/schema/bloodtests-3.schema.json`), and so
  is every rule the FHIR ecosystem would otherwise have supplied.
- In exchange, the payload is one a chatbot can emit from a
  photographed report on the first try and a human can read and
  correct in a table — which is the actual production path for
  every file this app ingests.
- Because the divergences above are all flattenings rather than
  disagreements, a FHIR export can be added later as a separate
  writer — a mapping pass over the same stored data — without
  changing the internal shape or the stored format. It would have
  to invent what the file does not carry: `status`, report
  `code`, resource ids, and a Patient.
- LOINC stays the only join key, so an observation with no LOINC
  is stored but joins nothing — the trade already recorded in
  [ADR-0004](adr-0004-derive-loinc-from-name-and-unit.md), which
  exists precisely because the printed report often omits it.

## What would force revisiting

- A second consumer that is not this app: data needing to go to a
  doctor, a hospital, or Apple Health. At that point the FHIR
  export stops being hypothetical and its cost is paid once, in a
  writer.
- Qualitative results becoming a real part of the data — a
  microbiology or serology panel where the answer is a coded
  finding rather than a number — which is the case SNOMED CT
  exists for and the one LOINC alone cannot carry.
- LOINC ceasing to be the vocabulary FHIR points at, which would
  remove the argument that makes it the cheap choice here.

## Sources

- [FHIR R4 DiagnosticReport](https://hl7.org/fhir/R4/diagnosticreport.html)
  and [Observation](https://hl7.org/fhir/R4/observation.html), HL7 —
  required elements, `result` references, `hasMember` panels,
  referenceRange structure.
- [ORU_R01 message structure](http://v2plus.hl7.org/2021Jan/message-structure/ORU_R01.html)
  and [OBX segment](http://v2plus.hl7.org/2021Jan/segment-definition/OBX.html),
  HL7 v2+.
- [Laboratory test result archetype](https://ckm.openehr.org/ckm/archetypes/1013.1.2191/mindmap/)
  and [Implementing laboratory tests in openEHR](https://ckm.openehr.org/ckm/document?cid=1013.17.116),
  openEHR Clinical Knowledge Manager.
- [SNOMED CT – LOINC partnership](https://www.snomed.org/our-partnerships/loinc)
  and the [LOINC Implementation Guide](https://docs.snomed.org/implementation-guides/loinc-implementation-guide/introduction/1.-introduction),
  SNOMED International — the October 2022 cooperative agreement and
  the LOINC Ontology.
