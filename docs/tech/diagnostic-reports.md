# Diagnostic Reports: upload, validation, cross-check

The data-management hub (`#reports`, `DiagnosticReportsView.tsx`; detail at
`#reports/<file>`, `DiagnosticReportDetailView.tsx`). The file format is
[`interchange-format.md`](interchange-format.md); unit handling is
[`units.md`](units.md).

## 1. Build JSON

The user or a chatbot produces a v3 envelope. The copyable chatbot prompt is
on the "Add a report" card (step 1, "Copy", with a "View prompt" toggle
expanding it); its text is `web/src/data/chatbotPrompt.ts` — user-facing
prose that follows the envelope, not the UI. It instructs the chatbot to
prefer lab-printed LOINC codes over its own knowledge (only codes matching the
LOINC pattern — a lab-internal code like "900101" is no printed code), keep
one draw as one report, ignore footnote and flag markers, never translate
test names (a multi-line or bilingual name collapses to one single-line
string), skip pending results with a notice, normalize decimal commas,
preserve special-character units (μ, ×10⁹/L), silently self-check
observation counts, list every draw date + lab for the user to confirm, and
deliver a downloadable UTF-8 `.json` file (a fenced code block only as
fallback).

## 2. Upload

`web/src/data/parseUpload.ts` accepts the v3 envelope and nothing else
(`{ schema: "3.x", diagnosticReports }` — `SCHEMA_VERSION` in
`envelopeSchema.ts`; any `"3.x"` is read, plus the legacy bare number `3`,
[ADR-0009](decisions/adr-0009-v3-only-and-rawname.md),
[ADR-0012](decisions/adr-0012-envelope-version-is-a-major-minor-string.md));
an older file is converted first with `npm run convert:v3`
(`web/scripts/convert-to-v3.mjs`). A report's `identifiers` (visit / order /
accession) feed the session id so two same-day same-lab draws do not collide
on merge; other envelope fields are ignored for now. Each observation's
printed name lives in `rawName`, never `name` — the friendly name is derived
from the LOINC at display time and never stored; `resultsStorage.ts`'s
`parseStoredSessions` reads a session stored under the earlier `analysis`
field into `rawName` on load. Import reads `rawUnit` in preference to
`unit`. `parseUpload.ts` is the single place unit normalization runs on
import, attaching the derived `canonical` pair.

Import routes: Get Started's "Import JSON" and share-link imports replace all
stored sessions; the "Add a report" card's step-3 **Add** button (with
"Adding…" progress and "✓ Added N reports" feedback) and generated test data
merge by session id. Sessions live in localStorage `bloodtests_upload_v1`;
changes auto-save, there is no manual save.

## 3. Validation

`web/src/data/validateDiagnosticReports.ts`, two tiers, shown as one status
dot per report row (red errors, amber warnings, green none):

- **Errors** — an observation missing its printed name or value (numeric
  `value` or non-empty `rawValue`), or carrying a non-empty code that is not
  LOINC-shaped (`^\d{1,7}-\d$`). While any exists, Monitoring Panels,
  Hormonal Pathways, Lipid Transport and All Observations are blocked
  ([`navigation-and-shell.md`](navigation-and-shell.md#blocking-while-errors-exist)).
- **Warnings** — an empty LOINC (the observation will not appear in panels
  or All Observations), a missing unit, a missing reference range (no
  min+max pair and no reference text), a printed unit whose dimension
  contradicts the code's property (naming the sibling code where one is
  known, the value never converted), and, lower-severity, a unit that
  resolves to neither a Latin spelling nor a UCUM code.

  Two warnings can be a faithful reflection of the report: MCHC printed in
  `%` (a legacy label for g/dL, [`units.md`](units.md#mchc-printed-in-)) and
  absolute differential counts printed with no range. Neither is silenced by
  code or "fixed" with an invented range
  ([ADR-0025](decisions/adr-0025-mchc-percent-is-not-an-accepted-unit.md)).

## 4. Edit and cross-check

The detail view allows inline editing of each observation's LOINC / value /
unit, saved to localStorage via `updateGroup`. The row helpers are
`reportDetailHelpers.ts`; the cross-check state is the `useLoincCrossCheck`
hook, passed as one object.

**Cross-check LOINCs** (`web/src/data/loincCheck.ts`,
[ADR-0004](decisions/adr-0004-derive-loinc-from-name-and-unit.md)) derives
each row's LOINC offline from printed name + unit: a Latin-name pass against
catalog English names, then a `lang`-translation pass for Greek / Russian /
Ukrainian printouts. The unit comparison key borrows `unitNormalization`'s
`foldUnitGlyphs` / `toLatinUnit`, so Cyrillic spellings, superscript digits
and the micro sign fold to the catalog's Latin form; per-code `ALLOWED_UNITS`
choose between variant codes and set confidence, and a candidate whose unit
dimension contradicts the row's is dropped outright (hemoglobin in g/L is
never offered HbA1c's %). A Cyrillic name must also cover a candidate's
translation, so a qualifier ("общий", "ЛПВП", "ЛПНП") decides between
siblings sharing "холестерин"; a word that names no analyte (acid, total,
serum, plasma, blood, level, count, "общий", "загальний") may settle between
siblings but never makes a match alone, and a translation carrying "общий"
asks no printout to repeat it. A printed -ic acid reads as its -ate anion
("Folic Acid", "Фолиевая кислота", "Фолієва кислота" are folate; "Ascorbic
Acid" is not uric acid), the translation pass reading "-иевая/-овая кислота"
and "-ієва/-ова кислота" both as printed and as the "-ат" anion. Alias-group
members collapse into one suggestion, the kept code picked by the row's unit.
The approximate token matching (Damerau-Levenshtein plus a length-bucketed
vocabulary index) is its own domain-free module, `fuzzyMatch.ts`.

A printed code is evidence only: ✓ derivation agrees (a code already the top
match agrees even without confidence, and gets no chips); ⚠ a confident
derivation contradicts it (the warning names both codes); ✗ unknown with no
derivation. Running the check applies every confident fix straight into the
edit draft and reports "✓ N codes filled automatically — review and Save",
re-runs over the updated rows, and leaves unit-labeled suggestion chips on
the rows it could not settle, each filling that row's LOINC on click —
Save/Cancel still gate persistence. Without a confident derivation, "Printed
name matches none of the names this code carries" shows only when the printed
name is none of the code's `friendlyName`, `shortName` or ru-RU / uk-UA names
(case and punctuation ignored) and shares too few words with its friendly,
LOINC or translated ones. The code's resolved name (`resolvedName`: its
`friendlyName`, or NLM's name for a code the catalog lacks) shows in grey
under the printed name; resolved names are session-only, never stored. The
mass-versus-molar unit repair feeds the same chip row
([`units.md`](units.md#mass-versus-molar-is-a-code-error)).

**Check online (NLM)** — a second-stage button, offered only for rows the
offline pass could not resolve, sends test names — never values — to
clinicaltables.nlm.nih.gov (results unit-selected the same way via
`EXAMPLE_UCUM_UNITS`). It is the only call that sends test names off-device
and lives alone in `web/src/data/loincNlm.ts`, so the privacy exception is a
file you can open by name. The app's other requests are its own origin's
`panels.json` / `monitoring-panels.json` and share-link payloads, and, when
the user signs in, Supabase auth and the Worker's GitHub-backed sync
([`account-and-sync.md`](account-and-sync.md)).

## 5. Export and clear

Export (`utils/exportData.ts`, from Account) writes a v3 envelope —
`schema`, `generatedAt`, `contentHash` (sha256 of the `diagnosticReports`
array only), subject / sex / birthYear / notes when set, and reduced reports
— as `blood-tests-export-<yyyymmdd>.json`; each observation's unit leaves as
the `unit` / `rawUnit` pair. A first round trip gains `rawUnit` and folds
spellings in `unit`, so it is not byte-identical; what holds, and is tested,
is that export → import → export is byte-identical. Which envelope fields are
implemented: [`interchange-format.md`](interchange-format.md).

The "Clear local DB" danger card (behind a confirm) removes the loaded
reports from this browser; Database details, backup and restore live on
Account ([`account-and-sync.md`](account-and-sync.md)).
