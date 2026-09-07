/* eslint-disable */
/**
 * GENERATED FILE — DO NOT EDIT BY HAND.
 *
 * Source schema: web/public/schema/bloodtests-3.schema.json
 * Generator:     web/scripts/generate-envelope-types.mjs
 * Regenerate:    npm run schema:types  (from web/)
 *
 * The committed copy is checked byte-for-byte by
 * web/test/envelope-types.test.ts, so a schema edit without a regeneration
 * fails CI.
 */

/**
 * One band the report printed for one result. Every sub-field is optional, but an entry needs at least one of `low`, `high` or `text` to mean anything — an entry carrying only a label bands nothing.
 */
export type InterchangeReferenceRange = ReferenceRange & ReferenceRange1;
export type ReferenceRange = {
  [k: string]: unknown;
};

/**
 * The blood-tests interchange envelope, schema 3. Machine-readable form of docs/tech/interchange-format.md: the JSON object that carries a set of lab reports for one person between systems. This schema describes version 3, which is the only version there is: the parser at blood.isayenko.net accepts nothing else, and a file stamped with the earlier 1 is converted offline with `npm run convert:v3` before it can be read. Objects are deliberately OPEN (no `additionalProperties: false`): the prose spec states that adding an optional field is not a breaking change and does not bump `schema`, and `identifiers` is specified to pass unrecognised lab keys through under the lab's own name — closing the objects would make every such forward-compatible file invalid against a schema that was never meant to reject it. Validation here is therefore about the fields the format defines, not about forbidding fields it has not defined yet. Fields the app does not yet read or write are still specified: the format is the contract, the implementation is a subset of it.
 */
export interface InterchangeEnvelope {
  /**
   * Required. A plain integer, not semver: a reader has one question — can I read this? — and a single number answers it. Bumped only on a breaking change (a field removed, renamed, or given a new meaning); adding an optional field does not bump it. 3 is the only accepted version — a file stamped 1 is an older format that has to be converted before it can be read.
   */
  schema: 3;
  /**
   * Optional. Full ISO 8601 UTC timestamp of when the file was written. Date-only is insufficient: a file gets regenerated more than once a day and two files from the same date must still be orderable. When absent, a reader treats the generation time as unknown and falls back to whatever ordering it has.
   */
  generatedAt?: string;
  /**
   * Optional. The `sha256:` prefix plus lowercase hex of JSON.stringify(diagnosticReports) — the diagnosticReports array only, never the whole file, so the field never has to hash itself. Purpose is change detection (has this file changed since I last imported it?), not corruption protection. When absent, a reader skips change detection and re-imports.
   */
  contentHash?: string;
  /**
   * Optional. An opaque id saying which person the file is about, so two people's files can never be silently merged into one table. It must not be, or contain, identity: no name, date of birth, passport, national health or insurance number. The mapping from this id to a person lives outside the file.
   */
  subject?: string;
  /**
   * Optional. A reference-range selector, not identity: real reports print separate ranges for women and men on the same analyte, so without this a reader has two candidate ranges and no basis to choose. Applies to every report in the file unless overridden per observation. When absent, a reader falls back to the range the report itself printed.
   */
  sex?: 'female' | 'male';
  /**
   * Optional. A year, not a date. Age is a property of when the sample was taken, so a birth year plus a report's collectedAt yields the age at collection, which is what an age-banded range bands on. A year rather than a full birth date because ranges band coarsely, and sex plus an exact date of birth plus lab results is close to identifying on its own.
   */
  birthYear?: number;
  /**
   * Optional. Free text the file's author writes for themselves: how the file was assembled, what a gap in it means, which source the numbers were transcribed from. Deliberately authored rather than copied out of a report — but it travels with the file, so it is visible to whoever opens a share link.
   */
  notes?: string;
  /**
   * Required. The reports themselves, one object per report/draw. Upload rejects an envelope whose array is empty.
   *
   * @minItems 1
   */
  diagnosticReports: InterchangeReport[];
  [k: string]: unknown;
}
/**
 * One report from one lab, covering one sample. A multi-section document from a single draw is one report; one PDF spanning several draw dates is several.
 */
export interface InterchangeReport {
  /**
   * Required. The laboratory's name, as printed. The same lab appears spelled several ways across years, so normalization belongs at import, where the variants are known — not in the schema, which would otherwise need a registry it cannot maintain.
   */
  lab: string;
  /**
   * Required. When the sample was taken, as a full ISO 8601 UTC timestamp. This is the date a trend plots against: the value describes the body at the moment of draw, not at any later moment in the lab's workflow.
   */
  collectedAt: string;
  /**
   * Optional. When the lab released the report. Often the same day as collection, but a send-out assay or a repeat run can separate the two. Plotting by this one moves a point to the right of where it belongs, so a value taken before a treatment can appear to come after it.
   */
  issuedAt?: string;
  /**
   * Optional. A flat map of the lab's own reference numbers, all keys optional and all values plain strings. Recognisable concepts get normalized keys, and any id whose concept is unrecognised passes through under the lab's own name for it — which is why this object stays open. The deciding rule: an identifier belongs here only if it identifies the REPORT; if it identifies the person (a patient number, a medical record number, a national identifier), it stays out of the file entirely.
   */
  identifiers?: {
    /**
     * The visit id.
     */
    visit?: string;
    /**
     * The lab's own report or order code.
     */
    order?: string;
    /**
     * The accession or lab number.
     */
    accession?: string;
    [k: string]: string | undefined;
  };
  specimen?: InterchangeSpecimen;
  /**
   * Required. The measured results on this report.
   */
  observations: InterchangeObservation[];
  [k: string]: unknown;
}
/**
 * Optional. What was sampled, stated once for the whole report as a default an individual observation may override. It matters clinically: the same analyte in serum versus plasma is not the same number. When absent, a reader must not assume a default.
 */
export interface InterchangeSpecimen {
  /**
   * Optional. What was sampled.
   */
  material?: string;
  /**
   * Optional. The tube additive where the lab states one. Kept separate from `material` because citrate plasma and EDTA plasma differ.
   */
  additive?: string;
  [k: string]: unknown;
}
/**
 * One measured result — one analyte, one number (or one printed word), with whatever the lab printed around it.
 */
export interface InterchangeObservation {
  /**
   * Required. The join key: every part of the app that puts two results side by side matches on LOINC and never on names. The shape is 1–7 digits, a hyphen, one check digit. The empty string is permitted and means the report printed no LOINC — such an observation is stored but joins nothing, so it appears in no panel. A lab's internal code (e.g. "900101") is not a LOINC and must not be put here; where no LOINC exists for a test at all, an invented code is worse than a missing row, because it joins.
   */
  loinc: string;
  /**
   * Required. The test name exactly as the lab printed it — human-readable provenance, never used for matching; see `loinc`. Named `rawName` rather than `name` because the canonical name is derived from the LOINC code at display time and deliberately never stored, so this field has no `name` sibling by design (unlike `rawValue`, which sits beside a parsed `value`).
   */
  rawName: string;
  /**
   * Optional. The numeric result, as a JSON number. Absent when the result is not numeric, in which case the result lives in `rawValue`.
   */
  value?: number;
  /**
   * Optional, borrowed from FHIR's Quantity comparator. A printed `< 0.01` is stored as value 0.01 with comparator `<`, so a below-detection-limit result stays a number that can be compared and plotted rather than prose re-parsed at every use. When absent, `value` is the measurement itself.
   */
  comparator?: '<' | '<=' | '>=' | '>';
  /**
   * Optional provenance. The result exactly as printed, including the non-numeric ones — "Negative", "not detected" — and the lossily-parsed ones, where `value` plus `comparator` cannot reproduce what the row said. Always safe to display; never parsed. When absent, a reader formats `value` and `unit` itself.
   */
  rawValue?: string;
  /**
   * Optional. The unit as printed. No conversion happens here: converted values belong nowhere in this file, only what the lab reported. A reader wanting other units converts at display time, from the reported pair. When absent, a reader must not assume a unit, and must not compare the number to a range in a different one.
   */
  unit?: string;
  /**
   * Optional provenance, NOT YET IMPLEMENTED — upload ignores it and export never writes it. The unit exactly as the lab printed it, kept against the day a normalization pass rewrites `unit` to a canonical form and the printed string would otherwise be lost. It stands to `unit` as `rawValue` stands to `value` plus `comparator`, and as the printed test name stands to a resolved LOINC name: the parsed field is what the app computes on, the raw one is what the paper said. While nothing normalizes units, `unit` already holds the printed string and this field is redundant — a writer should leave it out until the two can differ.
   */
  rawUnit?: string;
  /**
   * Optional. A list, not a single min/max pair, because one band cannot represent what reports actually print: named tiers, separate ranges for women and men, age bands, sometimes several on one row. Modelled on FHIR Observation.referenceRange. When absent, a reader falls back to whatever range its own catalog holds, or to none.
   */
  referenceRanges?: InterchangeReferenceRange[];
  /**
   * Optional. The lab's OWN verdict, as it printed it, using FHIR ObservationInterpretation codes: N normal, A abnormal, H high, L low, HH/LL critical, POS/NEG. Stored rather than recomputed because the lab's judgement is data the report carries, and because it gives a status to results with no usable numeric range. Precedence: show the lab's verdict when present, otherwise compute from `referenceRanges`.
   */
  interpretation?: 'N' | 'A' | 'H' | 'L' | 'HH' | 'LL' | 'POS' | 'NEG';
  specimen?: InterchangeSpecimen1;
  /**
   * Optional. The assay as printed — CHOD-POD, IFCC, direct, calculated. Two labs' numbers for one analyte are not always comparable across methods, so the method is worth carrying next to the number that depends on it. When absent, the assay is unknown and results are compared as if comparable.
   */
  method?: string;
  [k: string]: unknown;
}
export interface ReferenceRange1 {
  /**
   * Inclusive lower bound.
   */
  low?: number;
  /**
   * Inclusive upper bound.
   */
  high?: number;
  /**
   * The range verbatim, for display where bounds cannot capture what was printed.
   */
  text?: string;
  /**
   * The lab's own name for the band — Desirable, Borderline, High.
   */
  label?: string;
  /**
   * Which band applies to whom, for the reports that print more than one. The envelope's `sex` picks between them.
   */
  appliesTo?: {
    sex?: 'female' | 'male';
    [k: string]: unknown;
  };
  /**
   * Lower edge of the age band in years, matched against age at collection; see the envelope's `birthYear`.
   */
  ageLow?: number;
  /**
   * Upper edge of the age band in years, matched against age at collection.
   */
  ageHigh?: number;
  [k: string]: unknown;
}
/**
 * Optional. Overrides the report-level default for this one observation. When absent, the report-level `specimen` applies.
 */
export interface InterchangeSpecimen1 {
  /**
   * Optional. What was sampled.
   */
  material?: string;
  /**
   * Optional. The tube additive where the lab states one. Kept separate from `material` because citrate plasma and EDTA plasma differ.
   */
  additive?: string;
  [k: string]: unknown;
}
