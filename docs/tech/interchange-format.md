# Interchange format — envelope

The wrapper of a lab-data interchange file: the JSON object that carries a set of lab reports for one person between systems.

> **Status: under design.** Nothing implements this envelope yet. The current app accepts the shapes described in `web/src/data/parseUpload.ts`.

## Shape

```json
{
  "schema": 1,
  "generatedAt": "2026-08-26T21:14:09Z",
  "contentHash": "sha256:<hex>",
  "subject": "p-7fa3",
  "sex": "female",
  "birthYear": 1972,
  "reports": [ /* LabReport objects, specified below */ ]
}
```

Seven keys: `schema` and `reports` are required, `generatedAt`, `contentHash`, `subject`, `sex` and `birthYear` are optional. This page specifies the envelope only.

The split follows from who writes the file: a hand-written or hand-edited file must be valid without computing a hash, and the two provenance fields plus `subject`, `sex` and `birthYear` are conveniences the converter fills in, not things a reader needs to function.

## `schema`

**Required.** A plain integer, not semver. A reader has exactly one question — *can I read this?* — and a single number answers it; a three-part version invites comparison logic nobody needs.

Bump only on a **breaking** change: a field removed, renamed, or given a new meaning. Adding an optional field is not breaking, and does not bump.

## `generatedAt`

**Optional** — when absent, a reader treats the file's generation time as unknown and falls back to whatever ordering it has (import order, file mtime), rather than rejecting the file.

Full ISO 8601 UTC timestamp — `T` separates date and time, `Z` means UTC.

Date-only is insufficient: a file gets regenerated more than once a day, and two files from the same date must still be orderable.

## `contentHash`

**Optional** — when absent, a reader skips change detection and re-imports the file.

The `sha256:` prefix plus lowercase hex of `JSON.stringify(reports)` — the **reports array only**, never the whole file, so the field never has to hash itself.

Purpose is **change detection**: *has this file changed since I last imported it?* It is not corruption protection — HTTPS and `JSON.parse` already cover transport integrity.

Caveat: `JSON.stringify` is key-order-sensitive, so two semantically identical files can hash differently. If that ever matters, the stricter option is a canonical (sorted-key) serialization.

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

## `reports`

**Required.** Array of LabReport objects, specified below — see [lab report](../product/concepts/lab-report.md) for the product-level noun.

The [Observation](../product/concepts/observation.md) shape inside a report is specified below.

## LabReport

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

**FHIR** — [Fast Healthcare Interoperability Resources](https://hl7.org/fhir), HL7's modern standard, itself JSON-based. Worth stating plainly: FHIR is a set of JSON shapes, not a rival file format, so borrowing from it costs nothing. This format takes the shape of three of its answers — [`referenceRanges`](#referenceranges) as a list with applicability (`Observation.referenceRange`), [`comparator`](#comparator) for printed values like `< 0.01` (`Quantity.comparator`), and [`interpretation`](#interpretation) codes (`Observation.interpretation`) — while deliberately **not** adopting FHIR wholesale: every FHIR field is a CodeableConcept bound to a terminology system, roughly an order of magnitude more JSON than two self-owned apps need. The practical consequence of matching shapes is that exporting to real FHIR later is a mapping exercise rather than a redesign, which matters the day data has to come in from or go out to a hospital, Apple Health, or a doctor.

**UCUM** — [Unified Code for Units of Measure](https://unitsofmeasure.org), the standard FHIR uses for units. This format does **not** use it: [`unit`](#unit) is stored as the lab printed it, because the point is to record what the report said, not to normalize it. UCUM is what units would map to on the day they need to be machine-comparable.

**SNOMED CT** — [the clinical terminology](https://www.snomed.org) behind coded results and specimen types, and the standard vocabulary for values like specimen material. This format uses plain controlled strings instead — `serum`, `plasma`, `citrate` — for the same simplicity reason it declines FHIR's CodeableConcepts.

## Observation

One measured result — one analyte, one number (or one printed word), with whatever the lab printed around it.

```json
{
  "loinc": "2093-3",
  "name": "Total Cholesterol",
  "value": 186.65,
  "comparator": "<",
  "rawValue": "< 0.01",
  "unit": "mg/dL",
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

### `name`

**Required.** The test name as the lab printed it, a plain string. It is human-readable provenance — what the row said on paper — and it is never used for matching; see [`loinc`](#loinc).

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

Overrides the LabReport default for this one observation, with the same `material` / `additive` shape and the same controlled vocabularies.

### `method`

**Optional** — when absent, the assay is unknown and results are compared as if comparable.

The assay as printed — CHOD-POD, IFCC, direct, calculated. Two labs' numbers for one analyte are not always comparable across methods, so the method is worth carrying next to the number that depends on it.

### No `us` / `si` sibling blocks

Deliberately absent. v2 and v3's canonical shape requires all three of `original` / `us` / `si` for every value, and the two converted ones are derived numbers sitting in the same object as a measurement, where they are easily mistaken for one. Only what the lab printed is stored; conversion is a display concern.

## Not in this file

- **No patient identity** — see [`subject`](#subject).
- **No source-document filenames** (`sourceFile`) — a lab's PDF filename is sometimes the patient's own name.
- **No full dates of birth** — only the coarse [`birthYear`](#birthyear), which bands age without pinning a day.
- **No referring doctor's name** — it appears in report headers, and it is both a third party's personal data and a hint at what the patient was being investigated for.
- **No report header block** — a lab report's header carries the patient's name and a date of birth. A parser must take at most the birth *year* from that region and drop the rest, rather than copy it into `identifiers`, which is the easy mistake because the header's reference numbers sit in the same table as the name.

Any free-text passthrough field is where identity re-enters, whatever the intent. The format therefore prefers codes, numbers, units, and controlled strings over free text.

## Open questions

- Whether canonical serialization replaces `JSON.stringify` for `contentHash`.
