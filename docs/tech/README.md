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
  major version 3 only — every minor within it), held to the exporter's output by
  `web/test/envelope-schema.test.ts`.
- [`molar-masses.md`](molar-masses.md) — the molar-mass reference
  data: what `web/public/data/molar-masses.json` stores, the
  per-analyte table with its citations, the two conventional entries
  and why they are conventional, and the two hand-typed factors the
  consolidation corrected
  ([ADR-0011](decisions/adr-0011-molar-masses-are-data-factors-are-derived.md)).
- [`decisions/README.md`](decisions/README.md) — the ADR index
  (thirteen records, `adr-NNNN-<slug>.md`, numbered independently of
  v2), with a per-ADR row and a note on which doc each decision
  governs. The index is the single list — don't duplicate it here.

## Reference data

The five files under `web/public/data/`, all of them data and none of
them mirrored in TypeScript
([ADR-0010](decisions/adr-0010-analyte-catalog-is-the-source-of-truth.md),
[ADR-0011](decisions/adr-0011-molar-masses-are-data-factors-are-derived.md)):

- **`analyses.json`** — the analyte catalog, and the single source of
  truth for everything the app knows about a LOINC code: names and
  translations, popup prose, `shortName` (our badge abbreviation), expected `unit`,
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
- **`laboratories.json`** — the laboratory registry and the single source
  of truth for prices: per laboratory a currency, locale and as-of date,
  and price lines each covering every catalog LOINC they can satisfy.
  `web/src/data/labPricing.ts` costs the schedule from it. Described by
  [`blood.isayenko.net/schema/laboratories-1.schema.json`](https://blood.isayenko.net/schema/laboratories-1.schema.json);
  the mapping reasoning is in
  [`../content/laboratory-prices.md`](../content/laboratory-prices.md).

`web/src/data/analyteCatalog.ts` imports the catalog and derives every
lookup map the app uses from it — short names, expected and allowed
units, and the reverse alias map (primary → its variants) — so none of
them can drift from the file. `analyses.json`, `laboratories.json` and
`molar-masses.json` are imported statically and so ship inside the entry
bundle; `panels.json` and `monitoring-panels.json` are fetched from the
app's own origin at load (`web/src/data/DataContext.tsx`), so a panel edit
needs no rebuild. `buildConditions` in
`web/src/components/conditions/markers.ts` resolves a Monitoring Panel
against the groups and the catalog. The first three files are described
by
[`blood.isayenko.net/schema/analytes-1.schema.json`](https://blood.isayenko.net/schema/analytes-1.schema.json)
(source `web/public/schema/analytes-1.schema.json`) and the other two by
their own schemas; all five are validated with ajv by
`web/test/reference-data.test.ts`, which also recomputes every molar
mass from its formula. Unlike the interchange envelope, these objects
are closed, so a mistyped key fails the suite.

## Upload & Edit Workflow

The core user journey for data ingestion and local editing:

1. **Build JSON** — User or a chatbot generates v3-format lab data JSON (using the envelope specified in [`interchange-format.md`](interchange-format.md)). The copyable chatbot prompt lives on the Diagnostic Reports page's "Add a report" card (step 1, expandable), and its text in `web/src/data/chatbotPrompt.ts` — it is user-facing prose that follows this envelope, not the UI that shows it; it instructs the chatbot to prefer lab-printed LOINC codes over its own knowledge (but only codes matching the LOINC pattern — a lab-internal code like "900101" is treated as no printed code), keep one draw as one report, ignore footnote/flag markers, never translate test names (a multi-line or bilingual name collapses to one single-line string), skip pending results ("Not ready" / "Pending" / an empty cell) with a notice so they can be re-imported later, normalize decimal commas, preserve special-character units (μ, ×10⁹/L), silently self-check observation counts and then list every draw date + lab for the user to confirm nothing is missing, and deliver a downloadable UTF-8 .json file rather than dumping JSON into the chat (a fenced code block only as fallback).

2. **Upload** — File is imported into the app:
   - Parser (`web/src/data/parseUpload.ts`) validates v3 JSON structure and accepts nothing else — `schema: 1`, v2 canonical-draws and the two legacy array shapes were dropped in [ADR-0009](decisions/adr-0009-v3-only-and-rawname.md); an older file is converted first with `npm run convert:v3`.
   - **Validation tiers** (`web/src/data/validateDiagnosticReports.ts`): an observation missing its printed name or a value (numeric `value` *or* non-empty `rawValue`), or carrying a non-empty code that isn't LOINC-shaped (`^\d{1,7}-\d$` — catches lab-internal codes like "900101"), is an **error**; an empty LOINC (the observation won't appear in panels or All Observations), a missing unit, a missing reference range (no min+max pair and no reference text), a printed unit whose dimension contradicts the code, and a unit the tables cannot place are **warnings** (the last two are described under [Unit normalization](#unit-normalization)). While any error exists, Monitoring Panels and All Observations are disabled in the nav and their routes redirect to Diagnostic Reports; every other section — Get Started, Scheduled Visits, Medications, Reference Book and Account — stays reachable (`isNavItemBlocked` in `routing.ts`). Warnings are informational only.
   - Get Started's "Import JSON" button, the identical button on Diagnostic Reports' "Back up your database" card, and share-link imports replace all stored sessions (import-replace model); the "Add a report" card's step-3 **Add** button (with "Adding…" progress and "✓ Added N reports" feedback) and generated test data merge by session id instead. A v3 report's `identifiers` (visit/order/accession) feed the session id, so two same-day same-lab draws no longer collide and replace each other on merge.
   - All data stays local in `localStorage` — nothing reaches a server.

3. **Edit in Diagnostic Reports** — the management hub. Top to bottom: a collapsible "Database details" card, the reports table, the "Add a report" card, and a "Back up your database" card (Export JSON / Import JSON (replaces) / Clear behind a divider). The user can:
   - View parsed lab results grouped by report date/lab, with per-report error/warning dots.
   - Fix errors by inline-editing each observation's LOINC, value, and unit in the report detail view.
   - Cross-check LOINCs (`web/src/data/loincCheck.ts`): a "Cross-check LOINCs" button derives each row's LOINC deterministically from the printed name + unit ([ADR-0004](decisions/adr-0004-derive-loinc-from-name-and-unit.md)) — a Latin-name pass against catalog English names, then a `lang`-translation pass for Greek/Russian/Ukrainian printouts, with the row's unit hard-selecting among unit variants of one analyte, a candidate whose unit dimension contradicts the row's dropped outright (hemoglobin in g/L is never offered HbA1c's %), and a Cyrillic name required to cover a candidate's translation too, so a qualifier such as "общий", "ЛПВП" or "ЛПНП" decides between cholesterol siblings; a word that names no analyte (acid, total, serum, plasma, blood, level, count, "общий", "загальний") may settle between siblings but never makes a match — or a name agreement — alone, and a translation carrying "общий" asks no printout to repeat it, so a bare "Холестерин" still resolves to total cholesterol; a printed -ic acid reads as its -ate anion, so "Folic Acid" is folate and "Ascorbic Acid" is no longer uric acid, and the translation pass reads a printed "-иевая/-овая кислота" or "-ієва/-ова кислота" both as printed and as its "-ат" anion, so "Фолиевая кислота" is folate while "Мочевая кислота" still meets its own translation — and treats a printed code as corroborating evidence only: ✓ derivation agrees with the code (a code that is already the top match agrees even without confidence, with no chips), ⚠ a confident derivation contradicts it (the warning names both codes), ✗ unknown code with no derivation. Without a confident derivation, "Printed name differs from the LOINC name" shows only when the printed name is none of the code's display, badge or ru-RU/uk-UA names (case and punctuation ignored) and shares too few words with its English or translated ones. Running the check applies every confident fix through the edit draft immediately — no second click — and reports it as "✓ N codes filled automatically — review and Save", then re-runs the derivation over the updated rows, Save/Cancel still gating persistence; the rows it could not settle confidently keep clickable suggestion chips that fill that row's LOINC through the same draft. Suggestion chips are unit-labeled where the unit disambiguates variants; the official LOINC name shows in grey under the printed name (printed name preserved as provenance; resolved names are session-only, never stored). A second-stage "Check online (NLM)" button, offered only for rows the offline pass couldn't resolve, sends test names — never values — to clinicaltables.nlm.nih.gov (results unit-selected the same way via EXAMPLE_UCUM_UNITS); this explicit opt-in is the single exception to the everything-stays-local rule, and it lives in its own module, `web/src/data/loincNlm.ts` — the app's only request to another origin (its other `fetch`es, for `panels.json`, `monitoring-panels.json` and a share link's payload, stay on its own), in a file whose name says what it does, rather than a branch buried in the resolver. The resolver's approximate token matching (Damerau-Levenshtein plus a length-bucketed vocabulary index) is likewise its own domain-free module, `web/src/data/fuzzyMatch.ts`, with no tie to the analyte catalog. The React side is split the same way: `reportDetailHelpers.ts` holds the pure row helpers and `useLoincCrossCheck.ts` the cross-check state, which the detail view passes as one object instead of eight props.
   - Edit envelope metadata in "Database details": subject, sex, birth year, notes, plus a read-only `generatedAt` stamped on each export. Persisted under localStorage key `bloodtests_envelope_meta_v1` and written into the export envelope (empty fields omitted). Sex/birthYear are not yet *used* for reference-range selection — they're carried in the envelope only.

4. **Save Locally** — Changes auto-save to `localStorage` (no manual save button; data persists across sessions).

5. **Export** — User can export back to v3 envelope JSON (from Diagnostic Reports' "Back up your database" card):
   - Includes `generatedAt` and an updated `contentHash` for change detection, plus subject/sex/birthYear/notes when set in "Database details".
   - Writes a reduced envelope — not every spec field is emitted yet; see the [interchange-format status note](interchange-format.md).
   - Ready to share or version control.

**Data privacy:** Everything stays client-side. No file ever reaches a server except optionally via a share link on a Cloudflare Worker (read-only, no reverse lookup); the one other explicit-opt-in exception is the "Check online (NLM)" LOINC lookup, which sends test names (never values) to clinicaltables.nlm.nih.gov — the app's only request that leaves its own origin, and it is the whole of `web/src/data/loincNlm.ts`, so the exception can be audited by reading one short file. The format itself carries no identity — see [`interchange-format.md#subject`](interchange-format.md#subject).

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

It has three callers. `parseUpload.ts` runs it over every observation
of every import route and attaches the derived pair to the in-memory
row as `canonical` (step 2 above); `validateDiagnosticReports.ts` runs
it again to raise the cases it cannot settle silently — a dimension
contradiction, naming the sibling code where one is known and the code's
accepted units otherwise (another scale of the same dimension is not a
contradiction and raises nothing), and a unit that maps to no UCUM code
at all — as warnings on the Diagnostic Reports dot; and
`utils/exportData.ts` calls `ucumUnitFor` (stages 1–2 in one call) to
write the folded spelling to each observation's `unit`, with the
printed string beside it in `rawUnit`.

Of these warnings, only the one naming a sibling can be repaired in one click.
`unitRepairFor` (`reportDetailHelpers.ts`) offers the sibling code as a
chip in the report detail view's existing chip row, changing the
`loinc` alone through the same edit draft and Save/Cancel gate the
LOINC chips use — not auto-applied, because these warnings render on
mount and which of code and unit the lab got wrong is a judgement. The
unmappable unit has no chip: there is nothing to suggest, only tables
to extend ([task-0008](../tasks/task-0008.md)).

The same folding helpers are shared, not duplicated: `loincCheck.ts`
builds its unit comparison key with `foldUnitGlyphs` and `toLatinUnit`
from this module, so a Cyrillic printed unit (`ммоль/л`, `тыс/мкл`), a
superscript digit (`×10⁹/L`) and the micro sign all reduce to the
catalog's Latin spelling before a code is derived from name + unit. The
table layer borrows one more: `sameUnitScale` answers whether two printed
spellings denote the identical unit — same token kinds, same bases, ratio
exactly 1 —
so `ui.ts`'s `sharedUnit` can give a row one label when its readings only
*look* like two units (`uIU/mL` / `mIU/L`), while a genuine scale
difference still splits the label onto the cells. It compares, it never
converts, and an unrecognized unit answers "no" rather than optimistically
"yes". Given the row's LOINC, it also treats `U` and `IU` as one unit where
that code's LOINC property says which of the two it is measured in — a
catalytic activity or the arbitrary WHO kind, both sets derived from the
catalog's long common names in `analyteCatalog.ts` — and without a LOINC
they stay different
([ADR-0013](decisions/adr-0013-u-and-iu-fold-by-loinc-property.md)).

The case worth naming is mass versus molar. A `mmol/L` result stored
under Cholesterol's `[Mass/volume]` code `2093-3` is a **code** error,
not a number to convert, so the check suggests the analyte's
`[Moles/volume]` sibling `14647-2` — the rule
[ADR-0003](decisions/adr-0003-store-only-what-the-lab-printed.md)
sets, with UCUM fixed as the vocabulary by
[ADR-0007](decisions/adr-0007-ucum-as-the-unit-vocabulary.md).
`web/src/data/massMolarSiblings.ts` holds 21 curated pairs (each naming
its analyte's entry in
[`molar-masses.json`](molar-masses.md) rather than stating a factor;
the derived factor is never applied to a stored or exported value — its
one use is display-time, where the "What's in range" chart places a history
that crosses the mass/molar divide onto the single scale its reference band
is expressed in, which is what
[ADR-0003](decisions/adr-0003-store-only-what-the-lab-printed.md) means by
conversion belonging at display time; and each code declaring only
`{loinc, longCommonName}`, its unit taken from the catalog's
`DEFAULT_UNITS`); their molar codes
were added to `web/public/data/analyses.json` (124 → 139 entries then,
164 now) and carry `aliasOf` pointing at the mass primary, so a molar
code folds into the same panel row, badge and chart series without touching
panels, tables or charts. To repair an
existing file, `node scripts/recode-molar.mjs <input.json>` from
`web/` rewrites `loinc` and nothing else — see
[`interchange-format.md`](interchange-format.md#a-wrong-unit-here-is-usually-a-wrong-loinc).
Product-level reasoning is the [unit](../product/concepts/unit.md)
concept; [task-0011](../tasks/task-0011.md) closed on 2026-09-09, its
catalog consolidation complete — `ALSO_REFS` and the allowed-unit sets
folded into the catalog with
[ADR-0010](decisions/adr-0010-analyte-catalog-is-the-source-of-truth.md),
the factors into `molar-masses.json` with
[ADR-0011](decisions/adr-0011-molar-masses-are-data-factors-are-derived.md),
and the sibling pairs' last copy, each code's unit, derived from
`DEFAULT_UNITS` rather than restated. What it handed on rather than
finished is the UCUM parser itself, [task-0008](../tasks/task-0008.md).

## Deploy

The app ships as a Cloudflare Worker serving static assets
(`web/wrangler.jsonc`: worker `bloodtests`, `assets.directory` `./dist`,
custom domains `blood.isayenko.net` and `paneloom.com`). Deploys are automated: the `deploy`
job in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs
on every push to `main` and deliberately gates on nothing — it carries no
`needs:` and starts at once beside the `test` and `sonar` jobs, so a push is
live in about a minute. The trade is that lint and the tests report *after*
the code is already serving: a red suite means rolling forward, not a blocked
deploy, and the only check that can still stop a publish is `npm run build`'s
own `tsc -b`. It is guarded
by `if: github.ref == 'refs/heads/main' && github.event_name == 'push'`
so pull requests never publish. It runs its own `npm ci` and `npm run
build` (passing `GITHUB_SHA` and `BUILD_TIME` for the footer's build
stamp), then `cloudflare/wrangler-action@v3` with `workingDirectory: web`
and `command: deploy` — the same `wrangler deploy` that `npm run deploy`
runs locally — authenticated by the `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` repository secrets, with `permissions:
contents: read` and a `deploy-production` concurrency group so two pushes
cannot overtake each other. A manual `wrangler deploy` from `web/` still
works and is still needed for the case below.

### An automated deploy publishes no share links

This is the one accepted cost of automating the deploy, and it is not
subtle: **every existing `/?data=<guid>` share link returns 404 after a
CI deploy.**

The payloads live in `web/public/d/*.json`. They are real health data and
this repo is public, so they are gitignored; a manual deploy only ever
carried them because they had been copied into `web/public/d/` by hand
first. A CI runner checks out the repo and finds nothing there, so the
asset manifest it uploads simply has no `/d/` directory. The deploy does
not fail — `assets.directory` points at `./dist`, which the Vite build
always produces, an absent `public/` subdirectory is nothing for Vite to
copy, and the `/d/*` rule in `web/public/_headers` matching no file is
inert — the links just stop resolving. Re-publishing them means running
`wrangler deploy` from `web/` by hand with the files in place, which the
next push to `main` then undoes again.

The intended fix is to serve `/d/` from R2 rather than from the asset
bundle, so the build carries no health data at all and a share link no
longer depends on what happens to sit in someone's working copy.

The workflow says all of this twice: a comment block above the `deploy`
job and a step that emits it as a GitHub Actions warning annotation on
every run, so the consequence is visible in the run summary rather than
only in a doc.

## Known limitations

Build- and dependency-level, and all currently accepted rather than
scheduled. Format and round-trip gaps are listed separately, under
[the interchange format](interchange-format.md#known-round-trip-gaps).

- **An oversized entry chunk, the catalog its largest piece.** The two
  chart tabs are `React.lazy`-split (`LabExploreView` ≈ 78 kB,
  `PanelChartsView` ≈ 14 kB) and Account's backup loads `fflate` on click
  (≈ 32 kB), which once took the entry chunk from ~698 kB to ~616 kB raw;
  it has grown back since with every section added and measures ~763 kB
  raw (~227 kB gzipped) as of 2026-09-11, still over Vite's "larger than
  500 kB" advisory.
  Its largest single piece is `analyteCatalog.ts` importing
  `analyses.json` (~305 kB on disk) statically, so the catalog is bundled
  rather than fetched. It is an advisory, not an
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
