# Interchange format — envelope

The wrapper of a lab-data interchange file: the JSON object that carries a set of lab reports for one person between systems.

Machine-readable form of this page: [`https://blood.isayenko.net/schema/bloodtests-3.schema.json`](https://blood.isayenko.net/schema/bloodtests-3.schema.json) (source: `web/public/schema/bloodtests-3.schema.json`), JSON Schema draft 2020-12. It describes **version 3 only**, and so does the upload parser: the two now agree, and nothing else is read; see [`schema`](#schema). Objects in it are deliberately open (no `additionalProperties: false`), because adding an optional field is not a breaking change here and [`identifiers`](#identifiers) is specified to pass unrecognised lab keys through. `web/test/envelope-schema.test.ts` holds it to the exporter's output and to this page's fields.

> **Status: partially implemented.** This page is the full spec; the app implements a subset of it.
>
> - **Upload** (`web/src/data/parseUpload.ts`) accepts the v3 envelope and **nothing else** — no `schema: 1`, no project-bloodtests-v2 canonical draws, no legacy flat or grouped shapes; anything else fails with "Unrecognized JSON shape". Older files are converted first with `npm run convert:v3` (see [ADR-0009](decisions/adr-0009-v3-only-and-rawname.md)). It reads only `schema` (`3`) and `diagnosticReports`. Per report it reads `lab`, `collectedAt` (date part only), `observations`, and `identifiers` — the first of `visit`/`order`/`accession` is folded into the session id so two same-day same-lab draws don't collide on merge (it isn't stored beyond that). Per observation it reads `loinc`, `rawName`, `value`, `comparator`, `rawValue`, `unit`, `method`, and `referenceRanges` — flattened to a single min/max pair plus display text. It also runs unit normalization over every observation on the way in (`web/src/data/unitNormalization.ts`), the one place in the app that does: the printed `value` and `unit` are kept exactly as read, and where the unit places cleanly and the conversion to the code's canonical UCUM unit is known, the derived pair is attached to the in-memory row as `canonical` — never written back to `value`/`unit`, and never exported. Still **ignored on upload**: `generatedAt`, `contentHash` (never verified), `subject`, `sex`, `birthYear`, `notes`; per-report `issuedAt` and `specimen`; per-observation `interpretation`, `specimen` and `rawUnit`; range `label`/`appliesTo`/`ageLow`/`ageHigh` (kept only as display text, not used for range selection).
> - **Export** (`web/src/utils/exportData.ts`) writes `schema`, `generatedAt` (always), `contentHash` (sha256 of `JSON.stringify(diagnosticReports)`, per [ADR-0001](decisions/adr-0001-content-hash-plain-stringify.md)), `subject`/`sex`/`birthYear`/`notes` when set in the Diagnostic Reports "Database details" card (kept in localStorage under `bloodtests_envelope_meta_v1`; empty fields omitted), and `diagnosticReports` — per report `lab`, `collectedAt` (stored date at `T00:00:00Z`), `observations`; per observation `loinc`, `rawName`, and when present `value`, `rawValue`, `unit`, `method`, and a single `{ low, high, text }` reference range. **Never written yet**: per-report `issuedAt`/`identifiers`/`specimen`; per-observation `comparator`, `interpretation`, `specimen`, `rawUnit`, and multi-band/`label`/`appliesTo`/age-banded ranges. The import-time `canonical` form is deliberately absent from that list: it is derived, not reported, so the exporter's field-by-field mapping never emits it and an import-then-export round trip is byte-identical (`web/test/export-data.test.ts`).

### Known round-trip gaps

The subset above is not symmetric, and the asymmetries cost something. Each of these is known and currently accepted, not a bug report:

- **A `comparator` does not survive an export.** Upload reads it, so a printed `< 0.01` arrives as value `0.01` plus `<` and displays correctly. Export's field-by-field mapping omits it, so the same row leaves as a bare `0.01` — a below-detection-limit reading silently promoted to a measured one. Round-tripping a file therefore loses the distinction [`comparator`](#comparator) exists to preserve, and loses it in the direction that makes the data look more certain than it is.
- **`identifiers` is read but never written, so the collision it prevents returns on re-import.** Upload folds the first of `visit`/`order`/`accession` into the session id precisely so two same-day same-lab draws stay separate. Export writes neither the identifier nor anything else that distinguishes them, so exporting a database that holds both and importing it back merges them into one report: the fix applied at import is undone by the next export.
- **`interpretation` and `specimen` are dropped on the way in.** Both are specified, both are in the schema, and upload reads neither — so a file that carries the lab's own H/L flag or states that a value came from plasma loses that on import, and export cannot write back what was never held. The consequence for [`interpretation`](#interpretation) is that its stated precedence rule (lab's verdict first, computed status otherwise) has no path to fire today.
- **An empty database exports a file its own schema rejects.** `buildExportEnvelope` filters out reports with no observations and writes whatever remains, including nothing: with no data stored, Export JSON produces `"diagnosticReports": []`. [`diagnosticReports`](#diagnosticreports) is required and the published schema sets `minItems: 1`, so that file fails validation, and the upload parser refuses it with "diagnosticReports must be a non-empty array" — the app can write a file it will not read back.
- **`npm run convert:v3` drops a decimal comma rather than reading it.** The converter coerces each `value`, `refMin` and `refMax` with `Number()` and keeps the result only when finite, so a legacy value written `1,5` becomes `null` instead of `1.5`. A row that loses its `value` this way and carries no `rawValue` then fails validation as a missing result value — visible, at least, rather than silently wrong. The chatbot prompt asks for decimal commas to be normalized at the source, which is why this has not bitten; the converter does not do it itself.

## Shape

```json
{
  "schema": 3,
  "generatedAt": "2026-08-26T21:14:09Z",
  "contentHash": "sha256:<hex>",
  "subject": "p-7fa3",
  "sex": "female",
  "birthYear": 1972,
  "notes": "Rebuilt from the lab PDFs, March 2026.",
  "diagnosticReports": [ /* DiagnosticReport objects, specified below */ ]
}
```

Eight keys: `schema` and `diagnosticReports` are required, `generatedAt`, `contentHash`, `subject`, `sex`, `birthYear` and `notes` are optional. This page specifies the envelope only.

**Envelope-level fields.** `sex` and `birthYear` are optional at the envelope level, not per-report. They act as defaults: when present, they apply to all DiagnosticReports in the file unless overridden per-observation. When absent, a reader falls back to ranges printed on the report itself.

The split follows from who writes the file: a hand-written or hand-edited file must be valid without computing a hash, and the two provenance fields plus `subject`, `sex` and `birthYear` are conveniences the converter fills in, not things a reader needs to function.

## `schema`

**Required.** A plain integer, not semver. A reader has exactly one question — *can I read this?* — and a single number answers it; a three-part version invites comparison logic nobody needs.

**Current value: `3`, and the only accepted one.** `1` — the number the same shape carried before the renumber to match the project version — is **no longer accepted on import**; nor is `2`, which was never issued, nor any other number. A file stamped `1` (an earlier export, a share-link payload under `web/public/d/`, old dev data) is converted once, offline, with `npm run convert:v3 -- <file>`; the converter reads every legacy shape the app has dropped. See [ADR-0009](decisions/adr-0009-v3-only-and-rawname.md), which supersedes [ADR-0006](decisions/adr-0006-envelope-schema-numbered-3.md)'s "`1` stays accepted".

The value lives in one place — `web/src/data/envelopeSchema.ts` (`SCHEMA_VERSION`) — read by the exporter and the upload parser alike.

Bump only on a **breaking** change: a field removed, renamed, or given a new meaning. Adding an optional field is not breaking, and does not bump.

## `generatedAt`

**Optional** — when absent, a reader treats the file's generation time as unknown and falls back to whatever ordering it has (import order, file mtime), rather than rejecting the file.

Full ISO 8601 UTC timestamp — `T` separates date and time, `Z` means UTC.

Date-only is insufficient: a file gets regenerated more than once a day, and two files from the same date must still be orderable.

## `contentHash`

**Optional** — when absent, a reader skips change detection and re-imports the file.

The `sha256:` prefix plus lowercase hex of `JSON.stringify(diagnosticReports)` — the **diagnosticReports array only**, never the whole file, so the field never has to hash itself.

Purpose is **change detection**: *has this file changed since I last imported it?* It is not corruption protection — HTTPS and `JSON.parse` already cover transport integrity.

Caveat: `JSON.stringify` is key-order-sensitive, so two semantically identical files can hash differently. Plain serialization is a deliberate choice over a canonical (sorted-key) one — see [ADR-0001](decisions/adr-0001-content-hash-plain-stringify.md), which also states what would force revisiting it.

## `subject`

**Optional** — when absent, a reader treats the file as being about an unspecified person, and must not assume it belongs to any person it already knows.

An opaque id saying **which person** the file is about, so two people's files can never be silently merged into one table.

It must not be, or contain, identity: no name, date of birth, passport, national health or insurance number. Lab results plus a name is identifiable medical data — this format deliberately carries no identity, and the mapping from `subject` to a person lives outside the file, wherever the reader chooses to keep it.

## `sex`

**Optional** — when absent, a reader must fall back to showing whichever reference range the report itself printed, rather than guessing which one applies.

Which reference range to pick. Real reports print separate ranges for women and men on the same analyte — haemoglobin, ferritin, creatinine — so without this the app has two candidate ranges and no basis to choose between them.

A controlled value: `female` or `male`.

It is a range selector, not identity — the reasoning about what identity the file may carry lives in [`subject`](#subject).

## `birthYear`

**Optional** — when absent, a reader treats the person's age as unknown and falls back to the range the report printed, as with [`sex`](#sex).

A year as an integer, not a date. Age is not a property of the person but of when the sample was taken: a stored "age" is wrong a year later, and wrong differently for every report in the file. A birth year plus a report's [`collectedAt`](#collectedat) yields the age at collection, which is the number a range actually bands on.

A year rather than a full birth date because reference ranges band coarsely — children, adults 15–65, over 65. A full date would add precision nobody uses, and sex plus an exact date of birth plus lab results is close to identifying on its own; see [`subject`](#subject).

## `notes`

**Optional** — when absent, a reader shows nothing and loses nothing; no behaviour depends on it.

Free text the file's **author** writes for themselves: context about the file as a whole — how it was assembled, what a gap in it means, which source the numbers were transcribed from.

This does not contradict the format's avoidance of free text. The rule stated under [Not in this file](#not-in-this-file) is about **passthrough** — fields a parser copies out of a lab report, where a name or a patient number rides along by accident because it sat in the same table. `notes` is deliberately authored, not copied: whatever is in it, a person put there on purpose.

Caveat: anything written here travels with the file, so it is visible to whoever opens a share link. It is not a place for anything the reader should not see.

Scope is the **envelope only** for now. Per-report and per-observation notes are deliberately deferred, though the likely real value is at the observation level — "was not fasting", "two weeks after flu", "different lab, method changed" — which is the context that makes an odd value readable a year later. Adding them later is not a breaking change and does not bump [`schema`](#schema).

## `diagnosticReports`

**Required.** Array of DiagnosticReport objects, specified below — see [diagnostic report](../product/concepts/lab-report.md) for the product-level noun.

The [Observation](../product/concepts/observation.md) shape inside a report is specified below.

## DiagnosticReport

One report from one lab, covering one sample.

```json
{
  "lab": "NeoGenesis",
  "collectedAt": "2026-05-07T08:23:00Z",
  "issuedAt": "2026-05-13T15:26:00Z",
  "identifiers": { "visit": "<visit-id>", "order": "<order-code>", "accession": "<accession-no>" },
  "specimen": { "material": "plasma", "additive": "citrate" },
  "observations": [ /* Observation objects, specified below */ ]
}
```

### `lab`

**Required.** The laboratory's name, a plain string. The same lab appears spelled several ways across years, so normalization belongs at import, where the variants are known — not in the schema, which would otherwise need a registry it cannot maintain.

### `collectedAt`

**Required.** When the sample was taken. This is the date a trend plots against: the value describes the body at the moment of draw, not at any later moment in the lab's workflow.

Same encoding as the envelope's [`generatedAt`](#generatedat) — full ISO 8601 UTC timestamp.

### `issuedAt`

**Optional** — when absent, a reader knows only when the sample was taken, which is all a trend needs.

When the lab released the report. Often the same day as collection, but a send-out assay or a repeat run can put the two days apart. Plotting by this one moves a point to the right of where it belongs, so a value taken before a treatment can appear to come after it.

### `identifiers`

**Optional** — when absent, a reader falls back to whatever else distinguishes two reports.

A flat map of the lab's own reference numbers; all keys optional, values plain strings. Recognisable concepts get normalized keys — `visit`, `order`, `accession` — and any id whose concept is unrecognised passes through under the lab's own name for it.

The purpose is answering *is this the same report I already have?*, which only works if one concept has one key across labs — hence normalization rather than verbatim capture.

No parallel copy of the lab's original labels is kept alongside the normalized keys: it would be provenance nobody reads, and a free-text passthrough is exactly where identity re-enters.

The deciding rule needs no per-lab judgement: **an identifier belongs in the file only if it identifies the report. If it identifies the person, it stays out.**

In, because they identify the report: the lab's own report or order code, the visit id, the accession or lab number.

Out, because they identify the person:

- A lab's **patient** number — printed variously as "Patient ID", "UHID No." or "Clinic ID". It is the key that pulls up the person's name in that lab's system, which is precisely what the format's opaque [`subject`](#subject) avoids.
- More seriously, a **national identifier** — a national identity number, or a national health-system beneficiary number. These resolve straight to the person outside the lab entirely, so no lab-local scoping limits the damage.

### `specimen`

**Optional** — when absent, a reader knows only that the report has no stated default, and must not assume one.

What was sampled, stated once for the whole report as a **default** that an individual Observation may override. It matters clinically because the same analyte measured in serum versus plasma is not the same number — potassium reads higher in serum — so a value without its specimen is ambiguous.

`material` is optional: what was sampled — `serum`, `plasma`, `whole blood`, `urine`. A controlled vocabulary, not free text, for the same reason the rest of the format prefers controlled strings.

`additive` is optional: the tube additive where the lab states one — `citrate`, `EDTA`, `heparin`. Kept separate from `material` because citrate plasma and EDTA plasma differ.

Both levels exist because real reports do it both ways — some print the specimen once in the header, others print it next to each analyte — so the format carries a report default with a per-observation override, as FHIR does with `Observation.specimen`. The Observation-level override is [`specimen`](#specimen-1) in the Observation shape below.

### `observations`

**Required.** Array of [Observation](../product/concepts/observation.md) objects, specified below.

## Standards this format borrows from

This format is not a standard and does not try to be one. It does borrow, and the borrowing is uneven: one standard is required outright, a few lend their shapes, and two are named here only so it is clear they were considered and left out.

**LOINC** — Logical Observation Identifiers Names and Codes, maintained by the [Regenstrief Institute](https://loinc.org). The universal code answering *which test is this*. The format **requires** it and matches on nothing else: [`loinc`](#loinc) is the only join key, and names are provenance. It is free to use and searchable at [loinc.org](https://loinc.org).

**HL7** — [Health Level Seven International](https://www.hl7.org), the standards body behind healthcare data exchange. Context only: this format implements none of its wire protocols, and nothing here is an HL7 message.

**FHIR** — [Fast Healthcare Interoperability Resources](https://hl7.org/fhir), HL7's modern standard, itself JSON-based. Worth stating plainly: FHIR is a set of JSON shapes, not a rival file format, so borrowing from it costs nothing. This format takes the shape of three of its answers — [`referenceRanges`](#referenceranges) as a list with applicability (`Observation.referenceRange`), [`comparator`](#comparator) for printed values like `< 0.01` (`Quantity.comparator`), and [`interpretation`](#interpretation) codes (`Observation.interpretation`) — while deliberately **not** adopting FHIR wholesale: every FHIR field is a CodeableConcept bound to a terminology system, roughly an order of magnitude more JSON than two self-owned apps need. The practical consequence of matching shapes is that exporting to real FHIR later is a mapping exercise rather than a redesign, which matters the day data has to come in from or go out to a hospital, Apple Health, or a doctor. See [ADR-0002](decisions/adr-0002-borrow-fhir-shapes-not-fhir.md), which also states what would force revisiting it, and [ADR-0008](decisions/adr-0008-fhir-shaped-envelope-not-fhir.md) on why the envelope around those shapes is FHIR-*shaped* rather than a FHIR document — the file is one person's reports in one flat wrapper, not a `Bundle` of `Patient` / `DiagnosticReport` / `Observation` resources joined by reference.

**UCUM** — [Unified Code for Units of Measure](https://unitsofmeasure.org), the standard FHIR uses for units. No field in this format holds a UCUM code: [`unit`](#unit) is stored as the lab printed it, because the point is to record what the report said, not to normalize it. UCUM is settled as the vocabulary units map to when they need to be machine-comparable, and the app already derives one in memory to check a unit against its code (see [A wrong unit here is usually a wrong `loinc`](#a-wrong-unit-here-is-usually-a-wrong-loinc)) — but nothing writes it to a file, and won't until [`rawUnit`](#rawunit) starts being written. See [ADR-0007](decisions/adr-0007-ucum-as-the-unit-vocabulary.md) and the [unit](../product/concepts/unit.md) concept.

**SNOMED CT** — [the clinical terminology](https://www.snomed.org) behind coded results and specimen types, and the standard vocabulary for values like specimen material. This format uses plain controlled strings instead — `serum`, `plasma`, `citrate` — for the same simplicity reason it declines FHIR's CodeableConcepts.

## Observation

One measured result — one analyte, one number (or one printed word), with whatever the lab printed around it.

```json
{
  "loinc": "2093-3",
  "rawName": "Total Cholesterol",
  "value": 186.65,
  "comparator": "<",
  "rawValue": "< 0.01",
  "unit": "mg/dL",
  "rawUnit": "mg/dl",
  "referenceRanges": [
    { "low": 200, "label": "Desirable", "text": "< 200.00 Desirable" },
    { "low": 200, "high": 239, "label": "Borderline" },
    { "high": 40, "appliesTo": { "sex": "female" } },
    { "low": 20, "high": 43, "ageLow": 15, "ageHigh": 65 }
  ],
  "interpretation": "L",
  "specimen": { "material": "serum" },
  "method": "CHOD-POD"
}
```

### `loinc`

**Required.** The join key. Every part of the app that puts two results side by side — panels, the reference catalog, the results index, the charts — matches on LOINC and never on names, so an observation without one is stored but joins nothing: it sits in the file and appears nowhere.

Mapping a lab's printed test name to a LOINC code happens when the file is **built**, with a human confirming the match, so the file itself is always clean — a reader never guesses, and no name-matching heuristic exists downstream to go wrong.

Where no LOINC exists for a test at all — post-Soviet measures such as the prothrombin index have none — that observation is left out of the file rather than given an invented code. A made-up code is worse than a missing row, because it joins.

### `rawName`

**Required.** The test name exactly as the lab printed it, a plain string. It is human-readable provenance — what the row said on paper — and it is never used for matching; see [`loinc`](#loinc).

It is called `rawName`, not `name`, because there is no `name` to sit beside it: the canonical name is **derived from the LOINC code at display time and deliberately never stored**, so nothing in the file ever holds an authored or normalized name. That makes the pairing different from [`rawValue`](#rawvalue) beside [`value`](#value), where both halves are stored — here the raw half is the only half, and the field name says so rather than letting `name` imply a canonical string the format does not carry.

Renamed from `name` in [ADR-0009](decisions/adr-0009-v3-only-and-rawname.md), while the format was still fed by one producer.

### `value`

**Optional** — absent when the result is not numeric, in which case the result lives in [`rawValue`](#rawvalue).

The numeric result, as a JSON number.

### `comparator`

**Optional** — when absent, [`value`](#value) is the measurement itself.

One of `<`, `<=`, `>=`, `>`, borrowed from FHIR's Quantity comparator. A printed `< 0.01` is stored as value `0.01` with comparator `<`, so a below-detection-limit result stays a number that can be compared and plotted rather than prose that has to be re-parsed at every use.

### `rawValue`

**Optional** — when absent, a reader falls back to formatting [`value`](#value) and [`unit`](#unit) itself.

The result exactly as printed, including the non-numeric ones — `Negative`, `not detected`. Always safe to display; never parsed.

### `unit`

**Optional** — when absent, a reader must not assume a unit, and must not compare the number to a range in a different one.

The unit as printed. No conversion happens here: converted values belong nowhere in this file, only what the lab reported. A reader that wants other units converts at display time, from the reported pair.

Printed and canonical are two different things, and today this field holds only the printed one — the product-level distinction is the [unit](../product/concepts/unit.md) concept, and the canonical vocabulary it will eventually hold is settled as UCUM in [ADR-0007](decisions/adr-0007-ucum-as-the-unit-vocabulary.md). Nothing rewrites this field. The app derives a canonical pair at import and holds it beside the printed one in memory, and the `canonicalUnit` helper folds spellings **only** to compare a row's unit against a LOINC code's allowed set — neither changes what is stored or written.

#### A wrong unit here is usually a wrong `loinc`

A file can carry a unit that is not merely spelled oddly but measures the wrong *kind* of thing for the code beside it — `mmol/L`, a substance-per-volume unit, stored under Cholesterol's `[Mass/volume]` code `2093-3`. That is now detectable offline, without a network call and without a UCUM parser: `web/src/data/unitNormalization.ts` reads the printed unit into UCUM and compares its dimension against the units the code accepts, and `web/src/data/massMolarSiblings.ts` holds the curated `[Mass/volume]` ↔ `[Moles/volume]` LOINC pairs for the analytes where labs routinely differ.

The remedy is the sibling **code** — `14647-2` for the example above — never a converted number: converting would produce a figure no lab printed, which is exactly what [ADR-0003](decisions/adr-0003-store-only-what-the-lab-printed.md) rules out. `value`, `rawValue`, `unit` and `referenceRanges` stay as the report had them; only [`loinc`](#loinc) is wrong, and only `loinc` changes.

The check now runs on every imported file rather than only offline. `web/src/data/validateDiagnosticReports.ts` turns a dimension contradiction with a known sibling into a warning naming the printed unit, the code on the row and the sibling to move to, and a unit that resolves to neither a Latin spelling nor a UCUM code into a softer warning saying the row is left exactly as printed and is not comparable across units — the second is how the curated tables learn what they are missing. Both appear on the Diagnostic Reports table's existing warning dot and in the report's detail view; neither blocks anything, because neither is a defect in the file's *record* of what the lab printed.

To repair an envelope in bulk, offline: `node scripts/recode-molar.mjs <input.json>` from `web/`. It takes a file already stamped `schema: 3` (run `npm run convert:v3` first otherwise), writes `<input>.recoded.json` unless `-o` says otherwise (`--force` overwrites), and validates the result against the published schema with Ajv before writing it. It has **no npm alias**, unlike `npm run convert:v3` — invoke it by path.

### `rawUnit`

**Optional, and not implemented** — upload ignores it, export never writes it, and nothing in the app reads it today.

The unit exactly as the lab printed it, kept as provenance for the day a normalization pass rewrites [`unit`](#unit) to a canonical form. `unit` would then hold the normalized string and `rawUnit` what the paper said, so the rewrite is auditable and reversible rather than lossy.

The canonical form is UCUM — decided in [ADR-0007](decisions/adr-0007-ucum-as-the-unit-vocabulary.md), with the product-level reasoning on the [unit](../product/concepts/unit.md) concept page and the work tracked as [task-0011](../tasks/task-0011.md).

The pairing is the format's existing one, twice over: [`rawValue`](#rawvalue) preserves a printed `< 0.01` that [`value`](#value) plus [`comparator`](#comparator) parse lossily, and [`rawName`](#rawname) preserves each observation's printed test name against the official LOINC name the app resolves at display time. In each pair the parsed field is what code computes on, and the raw one is the record of what was read.

It is specified ahead of use rather than added later because the normalization it guards against is the change that would otherwise destroy the printed string in place — by which point no reader could tell a normalized unit from a printed one. Until something normalizes, `unit` already holds the printed string and this field is redundant: a writer should leave it out while the two cannot differ.

### `referenceRanges`

**Optional** — when absent, a reader has no lab-printed band and falls back to whatever range its own catalog holds, or to none.

A **list**, not a single min/max pair, because one band cannot represent what reports actually print: labs print named tiers, separate ranges for women and men, and age bands, sometimes several on one row.

Sub-fields, all optional:

- `low`, `high` — inclusive bounds.
- `label` — the lab's own name for the band: Desirable, Borderline, High.
- `appliesTo.sex` — for the reports that print separate ranges for women and men; the envelope's [`sex`](#sex) picks between them.
- `ageLow` / `ageHigh` — the age band in years, matched against age at collection; see [`birthYear`](#birthyear).
- `text` — the range verbatim, for display where bounds cannot capture what was printed.

Modelled on FHIR `Observation.referenceRange` (`low` / `high` / `type` / `appliesTo` / `age` / `text`), so the shape is one a reader may already know.

Each entry needs at least one of `low`, `high` or `text` to mean anything; an entry carrying only a label bands nothing.

### `interpretation`

**Optional** — when absent, a reader computes status from [`referenceRanges`](#referenceranges).

The lab's **own** verdict, as it printed it — an arrow, a flag, `POS` / `NEG`. Values follow FHIR's ObservationInterpretation codes: `N` normal, `A` abnormal, `H` high, `L` low, `HH` / `LL` critical, `POS` / `NEG`.

It is stored rather than recomputed for two reasons: the lab's judgement is data the report carries, and it gives a status to results that have no usable numeric range at all.

Precedence: **show the lab's verdict when present, otherwise compute from `referenceRanges`.**

### `specimen`

**Optional** — when absent, the report-level [`specimen`](#specimen) applies.

Overrides the DiagnosticReport default for this one observation, with the same `material` / `additive` shape and the same controlled vocabularies.

### `method`

**Optional** — when absent, the assay is unknown and results are compared as if comparable.

The assay as printed — CHOD-POD, IFCC, direct, calculated. Two labs' numbers for one analyte are not always comparable across methods, so the method is worth carrying next to the number that depends on it.

### No `us` / `si` sibling blocks

Deliberately absent. v2 and v3's canonical shape requires all three of `original` / `us` / `si` for every value, and the two converted ones are derived numbers sitting in the same object as a measurement, where they are easily mistaken for one. Only what the lab printed is stored; conversion is a display concern — see [ADR-0003](decisions/adr-0003-store-only-what-the-lab-printed.md), which also states what would force revisiting it.

## Not in this file

- **No patient identity** — see [`subject`](#subject).
- **No source-document filenames** (`sourceFile`) — a lab's PDF filename is sometimes the patient's own name.
- **No full dates of birth** — only the coarse [`birthYear`](#birthyear), which bands age without pinning a day.
- **No referring doctor's name** — it appears in report headers, and it is both a third party's personal data and a hint at what the patient was being investigated for.
- **No report header block** — a lab report's header carries the patient's name and a date of birth. A parser must take at most the birth *year* from that region and drop the rest, rather than copy it into `identifiers`, which is the easy mistake because the header's reference numbers sit in the same table as the name.

Any free-text passthrough field is where identity re-enters, whatever the intent. The format therefore prefers codes, numbers, units, and controlled strings over free text.

## Open questions

- ~~Whether canonical serialization replaces `JSON.stringify` for
  `contentHash`.~~ Decided: plain `JSON.stringify` —
  [ADR-0001](decisions/adr-0001-content-hash-plain-stringify.md).
- Whether [`subject`](#subject) earns its place: files are replaced on
  import and there is one file per person, so it is currently insurance
  against merging two people's data rather than something in use.
