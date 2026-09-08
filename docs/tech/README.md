# Tech

Stack, infrastructure, and architectural decisions. The "how it
runs" layer — what's used to build and operate the product.
Product / business / UX live in their own sections.

## Current files

- [`interchange-format.md`](interchange-format.md) — envelope of
  the lab-data interchange file (spec; partially implemented —
  see its status note). Its machine-readable form is published at
  [`blood.isayenko.net/schema/bloodtests-3.schema.json`](https://blood.isayenko.net/schema/bloodtests-3.schema.json)
  (JSON Schema draft 2020-12, source `web/public/schema/`,
  version 3 only), held to the exporter's output by
  `web/test/envelope-schema.test.ts`.
- [`molar-masses.md`](molar-masses.md) — the molar-mass reference
  data: what `web/public/data/molar-masses.json` stores, the
  per-analyte table with its citations, the two conventional entries
  and why they are conventional, and the two hand-typed factors the
  consolidation corrected
  ([ADR-0011](decisions/adr-0011-molar-masses-are-data-factors-are-derived.md)).
- [`decisions/README.md`](decisions/README.md) — the ADR index
  (eleven records, `adr-NNNN-<slug>.md`, numbered independently of
  v2), with a per-ADR row and a note on which doc each decision
  governs. The index is the single list — don't duplicate it here.

## Reference data

Four of the files under `web/public/data/`, all of them data and none of
them mirrored in TypeScript
([ADR-0010](decisions/adr-0010-analyte-catalog-is-the-source-of-truth.md),
[ADR-0011](decisions/adr-0011-molar-masses-are-data-factors-are-derived.md)):

- **`analyses.json`** — the analyte catalog, and the single source of
  truth for everything the app knows about a LOINC code: names and
  translations, popup prose, `short` badge label, expected `unit`,
  `allowedUnits`, and `aliasOf` / `aliasLabel` on a unit or method
  variant of another code. See the
  [observation](../product/concepts/observation.md) concept.
- **`panels.json`** — the laboratory groups: how a lab orders and
  prints a set of analytes.
- **`monitoring-panels.json`** — the product's Monitoring Panels,
  composed over those groups (`panelId` / `panelIds` / `loincs`, then
  `excludeLoincs` and `extraLoincs`). See the
  [monitoring panel](../product/concepts/monitoring-panel.md) concept.
- **`molar-masses.json`** — the single source of truth for mass↔molar
  arithmetic: 17 analytes' molar masses (never factors), each computed
  from a molecular formula and the CIAAW 2021 atomic weights the file
  also tabulates, with retrieved citations and a `basis` saying whether
  the number is exact or conventional. `web/src/data/molarMasses.ts`
  scales one into the factor a unit pair needs, so the sibling table
  and the computed indices derive every factor rather than typing one.
  Described by
  [`blood.isayenko.net/schema/molar-masses-1.schema.json`](https://blood.isayenko.net/schema/molar-masses-1.schema.json)
  and detailed in [`molar-masses.md`](molar-masses.md).

`web/src/data/analyteCatalog.ts` imports the catalog and derives every
lookup map the app uses from it — short labels, expected and allowed
units, and the reverse alias map (primary → its variants) — so none of
them can drift from the file. `buildConditions` in
`web/src/components/conditions/markers.ts` resolves a Monitoring Panel
against the groups and the catalog. The first three files are described
by
[`blood.isayenko.net/schema/analytes-1.schema.json`](https://blood.isayenko.net/schema/analytes-1.schema.json)
(source `web/public/schema/analytes-1.schema.json`) and the fourth by
its own schema; all four are validated with ajv by
`web/test/reference-data.test.ts`, which also recomputes every molar
mass from its formula. Unlike the interchange envelope, these objects
are closed, so a mistyped key fails the suite.

## Upload & Edit Workflow

The core user journey for data ingestion and local editing:

1. **Build JSON** — User or a chatbot generates v3-format lab data JSON (using the envelope specified in [`interchange-format.md`](interchange-format.md)). The copyable chatbot prompt lives on the Diagnostic Reports page's "Add a report" card (step 1, expandable); it instructs the chatbot to prefer lab-printed LOINC codes over its own knowledge (but only codes matching the LOINC pattern — a lab-internal code like "900101" is treated as no printed code), keep one draw as one report, ignore footnote/flag markers, never translate test names (a multi-line or bilingual name collapses to one single-line string), skip pending results ("Not ready" / "Pending" / an empty cell) with a notice so they can be re-imported later, normalize decimal commas, preserve special-character units (μ, ×10⁹/L), silently self-check observation counts and then list every draw date + lab for the user to confirm nothing is missing, and deliver a downloadable UTF-8 .json file rather than dumping JSON into the chat (a fenced code block only as fallback).

2. **Upload** — File is imported into the app:
   - Parser (`web/src/data/parseUpload.ts`) validates v3 JSON structure and accepts nothing else — `schema: 1`, v2 canonical-draws and the two legacy array shapes were dropped in [ADR-0009](decisions/adr-0009-v3-only-and-rawname.md); an older file is converted first with `npm run convert:v3`.
   - **Validation tiers** (`web/src/data/validateDiagnosticReports.ts`): an observation missing its test name or a value (numeric `value` *or* non-empty `rawValue`), or carrying a non-empty code that isn't LOINC-shaped (`^\d{1,7}-\d$` — catches lab-internal codes like "900101"), is an **error**; an empty LOINC (the observation won't appear in panels or All Observations), a missing unit, and a missing reference range (no min+max pair and no reference text) are **warnings**. While any error exists, Monitoring Panels and All Observations are disabled in the nav and their routes redirect to Diagnostic Reports; Get Started and Reference Book stay reachable. Warnings are informational only.
   - Get Started's "Import JSON" button, the identical button on Diagnostic Reports' "Back up your database" card, and share-link imports replace all stored sessions (import-replace model); the "Add a report" card's step-3 **Add** button (with "Adding…" progress and "✓ Added N reports" feedback) and generated test data merge by session id instead. A v3 report's `identifiers` (visit/order/accession) feed the session id, so two same-day same-lab draws no longer collide and replace each other on merge.
   - All data stays local in `localStorage` — nothing reaches a server.

3. **Edit in Diagnostic Reports** — the management hub. Top to bottom: a collapsible "Database details" card, the reports table, the "Add a report" card, and a "Back up your database" card (Export JSON / Import JSON (replaces) / Clear behind a divider). The user can:
   - View parsed lab results grouped by report date/lab, with per-report error/warning dots.
   - Fix errors by inline-editing each observation's LOINC, value, and unit in the report detail view.
   - Cross-check LOINCs (`web/src/data/loincCheck.ts`): a "Cross-check LOINCs" button derives each row's LOINC deterministically from the printed name + unit ([ADR-0004](decisions/adr-0004-derive-loinc-from-name-and-unit.md)) — a Latin-name pass against catalog English names, then a `lang`-translation pass for Greek/Russian/Ukrainian printouts, with the row's unit hard-selecting among unit variants of one analyte — and treats a printed code as corroborating evidence only: ✓ derivation agrees with the code, ⚠ a confident derivation contradicts it (the warning names both codes; a derived code the printed one contradicts is offered as a chip, and an "Apply suggestions" button applies every confident fix through the edit draft in one click, Save/Cancel still gating persistence), ✗ unknown code with no derivation. Suggestion chips are unit-labeled where the unit disambiguates variants; the official LOINC name shows in grey under the printed name (printed name preserved as provenance; resolved names are session-only, never stored). A second-stage "Check online (NLM)" button, offered only for rows the offline pass couldn't resolve, sends test names — never values — to clinicaltables.nlm.nih.gov (results unit-selected the same way via EXAMPLE_UCUM_UNITS); this explicit opt-in is the single exception to the everything-stays-local rule.
   - Edit envelope metadata in "Database details": subject, sex, birth year, notes, plus a read-only `generatedAt` stamped on each export. Persisted under localStorage key `bloodtests_envelope_meta_v1` and written into the export envelope (empty fields omitted). Sex/birthYear are not yet *used* for reference-range selection — they're carried in the envelope only.

4. **Save Locally** — Changes auto-save to `localStorage` (no manual save button; data persists across sessions).

5. **Export** — User can export back to v3 envelope JSON (from Diagnostic Reports' "Back up your database" card):
   - Includes `generatedAt` and an updated `contentHash` for change detection, plus subject/sex/birthYear/notes when set in "Database details".
   - Writes a reduced envelope — not every spec field is emitted yet; see the [interchange-format status note](interchange-format.md).
   - Ready to share or version control.

**Data privacy:** Everything stays client-side. No file ever reaches a server except optionally via a share link on a Cloudflare Worker (read-only, no reverse lookup); the one other explicit-opt-in exception is the "Check online (NLM)" LOINC lookup, which sends test names (never values) to clinicaltables.nlm.nih.gov. The format itself carries no identity — see [`interchange-format.md#subject`](interchange-format.md#subject).

## Unit normalization

`web/src/data/unitNormalization.ts` runs three pure
stages: printed unit → canonical Latin spelling (Cyrillic and
Ukrainian unit tables, superscript folding, micro and multiplication
signs), Latin → UCUM code, then a check of that code's dimension
against the observation's LOINC. `normalizeObservationUnit` returns
all three in one result, alongside `convertValue` and
`canonicalUnitFor`. Nothing is stored: the printed value and unit stay
authoritative, a canonical form is derived per call, and an
unrecognized unit returns undefined rather than a guess — the tables
are a curated subset, not a UCUM parser, with the NLM UCUM library the
upgrade path ([task-0008](../tasks/task-0008.md)).

It has two callers, both on the way in rather than in a view.
`parseUpload.ts` runs it over every observation of every import route
and attaches the derived pair to the in-memory row as `canonical`
(step 2 above); `validateDiagnosticReports.ts` runs it again to raise
the two cases it cannot settle silently — a dimension contradiction
with a known sibling code, and a unit that maps to no UCUM code at all
— as warnings on the Diagnostic Reports dot. What does *not* exist is
the confirm-and-apply UI: a normalization warning names the problem
and stops there, unlike the LOINC cross-check's suggestion chips
([task-0011](../tasks/task-0011.md)).

The same folding helpers are shared, not duplicated: `loincCheck.ts`
builds its unit comparison key with `foldUnitGlyphs` and `toLatinUnit`
from this module, so a Cyrillic printed unit (`ммоль/л`, `тыс/мкл`), a
superscript digit (`×10⁹/L`) and the micro sign all reduce to the
catalog's Latin spelling before a code is derived from name + unit.

The case worth naming is mass versus molar. A `mmol/L` result stored
under Cholesterol's `[Mass/volume]` code `2093-3` is a **code** error,
not a number to convert, so the check suggests the analyte's
`[Moles/volume]` sibling `14647-2` — the rule
[ADR-0003](decisions/adr-0003-store-only-what-the-lab-printed.md)
sets, with UCUM fixed as the vocabulary by
[ADR-0007](decisions/adr-0007-ucum-as-the-unit-vocabulary.md).
`web/src/data/massMolarSiblings.ts` holds 20 curated pairs (each naming
its analyte's entry in
[`molar-masses.json`](molar-masses.md) rather than stating a factor;
the derived factor is recorded as data, never applied); their molar codes
were added to `web/public/data/analyses.json` (124 → 139 entries then,
159 now) and carry `aliasOf` pointing at the mass primary, so a molar
code folds into the same panel row, badge and chart series without touching
panels, tables or charts. To repair an
existing file, `node scripts/recode-molar.mjs <input.json>` from
`web/` rewrites `loinc` and nothing else — see
[`interchange-format.md`](interchange-format.md#a-wrong-unit-here-is-usually-a-wrong-loinc).
Product-level reasoning is the [unit](../product/concepts/unit.md)
concept; remaining work (the confirm-and-apply UI) is
[task-0011](../tasks/task-0011.md) — the catalog consolidation it
also asked for landed for `ALSO_REFS` and the allowed-unit sets with
[ADR-0010](decisions/adr-0010-analyte-catalog-is-the-source-of-truth.md),
while the sibling pairs still carry their own copy of each code's unit.

## Known limitations

Build- and dependency-level, and all currently accepted rather than
scheduled. Format and round-trip gaps are listed separately, under
[the interchange format](interchange-format.md#known-round-trip-gaps).

- **An oversized entry chunk, now mostly catalog.** The two chart tabs
  are `React.lazy`-split (`LabExploreView` ≈ 78 kB, `PanelChartsView`
  ≈ 14 kB), which took the entry chunk from ~698 kB to ~616 kB raw
  (~181 kB gzipped), still over Vite's "larger than 500 kB" advisory.
  What is left is largely
  `analyteCatalog.ts` importing `analyses.json` statically, so the
  catalog is bundled rather than fetched. It is an advisory, not an
  error, and a catalog that cannot arrive late is a fair trade on a
  single-page app — but the warning is real and the remaining fix (a
  dynamic `import()` of the catalog, or a raised
  `chunkSizeWarningLimit`) has not been taken, so a genuinely new size
  regression would hide inside it.

## Common slots

Don't pre-create — extract on first real entry. See
[Section, file, folder](../README.md#section-file-folder).

- **`stack.md`** — the v1 stack: framework, hosting, storage,
  payments, language, etc., with rationale per pick.
- **`architecture.md`** — system overview, data flow, key
  components.
(`decisions/` has been extracted — see [Current
files](#current-files).)

## Open questions

- [TODO: architectural decisions still open.]
