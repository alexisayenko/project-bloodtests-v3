# CLAUDE.md

Fast-path context for Claude Code. Full human-oriented docs:
[docs/](docs/).

## Key principle

> [TODO: one-line principle that governs every product decision]

[TODO: one paragraph elaborating how this principle applies — what
decisions are weighed against it, what gets cut when it doesn't
reinforce the principle.]

## Product

[TODO: one paragraph — what it is, who uses it, mechanic,
monetization.]

## Tech stack

React 19 + TypeScript + Vite, in `web/`. No backend — panel/analyte
reference data ships as static JSON (`web/public/data/`), uploaded lab
results are parsed client-side and kept in `localStorage`. That
reference data is the single source of truth and is never mirrored in
TypeScript (ADR-0010): `analyses.json` is the analyte catalog, one
entry per LOINC carrying its names, translations and popup prose plus
`short` (badge label), `unit` (expected unit), `allowedUnits`, and
`aliasOf`/`aliasLabel` on a unit or method variant of another code;
`web/src/data/analyteCatalog.ts` imports it and derives every lookup
map from it at load (`SHORT_LABELS`, `DEFAULT_UNITS`, `ALLOWED_UNITS`,
and the reverse alias map `ALSO_REFS` / `ALIAS_TO_PRIMARY`), so none
can drift. Panels have two layers: `panels.json` holds the laboratory
groups (how a lab orders and prints a set), `monitoring-panels.json`
holds the product's Monitoring Panels composed over them
(`panelId`/`panelIds`/`loincs`, then `excludeLoincs`/`extraLoincs`,
array order = render order), with `buildConditions` (`markers.ts`) as
the resolver — it maps LOINCs one-to-one and does not fold aliases, so
Insulin Resistance still excludes HbA1c's IFCC code `59261-8` despite
its `aliasOf`. All three files are described by
`web/public/schema/analytes-1.schema.json` (draft 2020-12, closed
objects) and validated with ajv by `web/test/reference-data.test.ts`. The same
pattern carries mass↔molar arithmetic: `web/public/data/molar-masses.json` is
the single source of truth for it and stores molar masses, never conversion
factors — 17 analytes, each with the molecular formula its
`molarMassGPerMol` is computed from, the CIAAW 2021 standard atomic weights the
file also tabulates, a `basis` of `compound` / `element` / `conventional`, and
retrieved citations (PubChem CID, or CIAAW for an element) carrying the source's
own mass as a cross-check; `web/src/data/molarMasses.ts` scales one into the
factor a given unit pair needs (`massPerMolarUnit` / `molarPerMassUnit`), so
`massMolarSiblings.ts` and `computedIndices.ts` derive every factor they use
instead of typing one — the pairs themselves are declared once, in
`computedIndices.ts`'s exported `INDEX_UNIT_PAIRS` (8 analytes), which the
Reference Book reads rather than restating T3's and DHEA-S's pairs, as it did
while those two backed a computed index but no `MASS_MOLAR_SIBLINGS` entry — so
"38.6664 mg/dL per mmol/L" cannot drift from
"cholesterol is 386.664 g/mol" (it had: glucose was 18.018 in one file and
18.016 in the other). `web/public/schema/molar-masses-1.schema.json` describes
it in the same closed-object style, and the same test file recomputes each mass
from its formula and holds it to its sources. See
[`docs/tech/molar-masses.md`](docs/tech/molar-masses.md) and
[ADR-0011](docs/tech/decisions/adr-0011-molar-masses-are-data-factors-are-derived.md).
A read-only
share link, `/?data=<guid>`, fetches `/d/<guid>.data.json` and imports it
through the same parse path as an upload, then strips the param; in
parallel it fetches an optional `/d/<guid>.meta.json` per-link
presentation config (`showPanels` — an allowlist of panel display names
limiting the Monitoring Panels grid, and with it All Observations' panel
options and the indices they scope, though its observation rows always show
everything — plus `settings`, which seeds the shared table controls
(`unitSystem`, `sampleLimit`) only when the visitor has none stored yet; the
retired `dateOrder` an older link may still carry is dropped in
`parseSettings` like any other unrecognized field), where a missing, 404 or malformed
meta simply means "no meta" and never fails the import. A stored meta
never outlives the link it came from: `applySharedMeta` clears before it
stores, and Clear and every replacing import (`uploadFile`, behind both
"Import JSON" buttons) call `clearSharedMeta`, so a link without meta
inherits no allowlist and a stale `showPanels` cannot go on hiding panels
after the data it belonged to is gone; merges leave it alone. Nothing
migrates a meta stored before that behavior existed, though: such a one
survives until the visitor clears or replaces their data, and until then
it goes on filtering the grid and the All Observations panel select with
nothing on screen to say why — the one real instance was an allowlist
naming every panel but Hypogonadism, left by a link that had hidden it. The
payloads are real health data and are gitignored (`web/public/d/*.json`)
because this repo is public, so a deploy needs them copied in locally
first. `web/public/_headers` serves `/d/*` as
`noindex`/`private`, and `robots.txt` disallows `/d/`. Deploys as
a Cloudflare Worker (static assets) to `blood.isayenko.net` via
`web/wrangler.jsonc`. Deploy runs from CI: the `deploy` job in
`.github/workflows/ci.yml` publishes on every push to `main` once the
quality gates pass. Because a CI checkout has no `web/public/d/*.json`,
an automated deploy carries NO share-link payloads and every existing
`/?data=<guid>` link 404s until someone re-runs `wrangler deploy` by hand
with the files copied in — accepted for now; the intended fix is serving
`/d/` from R2 so the build carries no health data at all. A footer
(`components/Footer.tsx`) stamps whichever build you are looking at:
`vite.config.ts` injects the commit hash and a build timestamp, `buildInfo.ts`
falls back to the local commit outside CI so the stamp is never empty, and the
hash links to its commit on GitHub.
The app shell is `web/src/components/conditions/MedicalConditionsPage.tsx`
(route + results + shared settings + popup state); each section renders
its own sibling view component (`PanelsGridView` / `PanelDetailView` /
`AllObservationsView` / `DiagnosticReportsView` /
`DiagnosticReportDetailView` / `ProfileView` / `ReferenceBookPage`, plus shared
`NavBar` / `ControlsBar` / `ResultTables` / `Popup` and `TabBar` — the in-page
tab strip Panel Detail and All Observations both render; `NavBar` deliberately
does not use it, since it differs in container, three-state colors, its
blocked/`not-allowed` state and its route-derived active tab, and shares only
`tabStyle`), with pure helpers
in `markers.ts` / `routing.ts` / `ui.ts` / `resultsLookup.ts` /
`reportDetailHelpers.ts` (the report-detail row helpers) and
`data/generateTestData.ts`; the report detail view's cross-check state lives in
the `useLoincCrossCheck` hook, which is what it passes around instead of eight
separate props. On a narrow screen both of a results table's headers are
retrievable rather than resident: `TableScroller.tsx` wraps every table
(observations and both indices tables) and, on mobile only — `useIsMobile`
(`web/src/hooks/useIsMobile.ts`) reading the stylesheet's own `max-width: 767px`
as `MOBILE_QUERY`, so the JS-mounted overlays exist exactly where the CSS
placing them applies — parks the marker-name column and the date header row at
a 5px sliver each, opened by a pull (`usePullReveal.ts`: follows the finger,
commits past 40% of the remaining travel, springs back otherwise, and takes a
sub-6px gesture as a tap on the sliver) and, for the dates, by a thumb-sized
"Dates" chip, which is the control people are meant to find. The column is the
real first column held by `position: sticky` at a negative offset, so it cannot
drift out of line with the rows; the header has to be a copy — vertical sticky
would resolve against the scrolling box rather than the page — and is kept
aligned by rendering the same `colgroup` and `thead` (over `ui.ts`'s shared
`RESULT_TABLE` and `LABEL_COL_WIDTH`) in a fixed box of the same width with the
horizontal scroll mirrored onto it. Nothing is conditionally rendered, so the
real header and labels keep their place in the accessibility tree. The header
handle carries no `touch-action` and claims each `touchmove` only in the
direction that moves the panel, so a page scroll begun on it still scrolls. The
nav joins in: `useHideOnScroll.ts` slides it off going down the page and back
going up, and `NavBar` publishes its height as `--mc-nav-h` / `--mc-nav-offset`
so a revealed header parks under it rather than behind it. Still open from the
same ticket (task-0015): the per-cell tap that would name one cell's date and
analyte is unbuilt, and `popupPosition`'s left clamp still goes negative below
a ~396px viewport for the 380px index popup. In a results table the number and its unit label always move
together: `ui.ts`'s `displayedResult` / `sharedUnit` / `buildRowCells` label a
reading with its own code's unit — a molar variant folded into its mass
primary's row keeps `mmol/L`, never the primary's `mg/dL` — and a row whose
readings sit on two scales loses its row-level unit and labels each cell
instead. Two spellings of one unit are not two scales, though: `sharedUnit`
falls back to `unitNormalization`'s `sameUnitScale`, which folds both to Latin,
computes prefix × volume and demands identical kinds and a ratio of exactly 1,
so a TSH history printed `uIU/mL`, `mIU/L` and `мкМЕ/мл` carries one `mIU/L`
label (the row's own catalog/SI-US unit when that belongs to the same unit,
else the readings' majority spelling) with no number converted, while `mg/dL`
against `mmol/L` still splits onto the cells. The identities it folds unconditionally are the pure decimal-prefix ones — `IU/L` = `mIU/mL`, `mIU/L` = `uIU/mL`, `ng/mL` = `ug/L` and `mg/L` = `ug/mL`. `U` and `IU` fold too, but only where the analyte permits it, and the permission is asked of the LOINC property rather than of the spelling: an analyte is measured in one of the two arbitrary units, not both, so whichever name a lab printed there is only one unit it can have meant. Two properties grant it, in opposite directions — a catalytic activity (`[Enzymatic activity/volume]`, 8 codes: ALT, AST, ALP, GGT, amylase, lipase, cholinesterase, CK), where the unit is the 1964 enzyme unit and a printed `IU/L` is `U/L`; and the arbitrary WHO kind (`[Units/volume]`, 12 codes: insulin, TSH, FSH, LH, prolactin, thyroglobulin, anti-TPO, TRAb, anti-CCP, rheumatoid factor, antithrombin activity, oxLDL), where the unit is the International Unit and a printed `µU/mL` is `µIU/mL` — which is what keeps the owner's insulin history, printed `µU/mL` nine times and `µIU/mL` five, under one row label. Both sets are derived from the catalog's own long common names by `analyteCatalog.ts`'s `propertyOf` / `U_IU_FOLD_REASON` (ADR-0010), never hand-listed; under any other property, and with no analyte supplied, `U` and `IU` stay different scales, and one analyte's `IU` never meets another's. The conversion itself is `computedIndices.ts`'s
`convertUnit`, which
folds a printed spelling to Latin before matching, so `ммоль/л` converts like
`mmol/L` (it used to match no rule, leaving the printed number under a
converted label). Monitoring Panels grid cards list each
panel's observations and, below a divider, its computed indices
(`INDEX_DEFS`, in `data/indexDefs.ts` — the clinical definitions, prose and
citations, split from the engine in `computedIndices.ts` and importing its types
one-directionally, with no re-export back so no cycle forms), both dot-colored
by status. Cardiovascular Risk carries both calculated LDL-C estimates —
`ldlf` (Friedewald, LOINC `13457-7`) and `ldls` (Sampson/NIH equation 2, no
LOINC exists for the method) — each returning null outside its own validity
range (TG ≥ 400 and > 800 mg/dL) so it renders as `–` rather than a
confidently wrong number; Martin-Hopkins is deferred to task-0012. An index
reads its inputs through `MARKER_CANDIDATE_LOINCS`, which expands
`MARKER_LOINC` through the catalog's derived alias maps and places each value
in the formula's unit or declines it, so a molar-coded history computes the
same indices a mass-coded one does — before that it computed none at all.
Panel Detail has a back
chevron (‹) before its title, back to the grid. Panel Detail and All
Observations each carry a "What's in range" tab — a normalized-overlay
time chart (every marker, and every panel's
computed indices, plotted as % of its own reference range or ok-zone
band on one shared axis, with a panel picker (a marker or index shared
across panels groups under every relevant one), zoom, autoscale, and a
"not taken" section, which also names readings dropped because their unit
could not be placed on the series' band scale) — built from v2's
`<lab-explore>` web component, vendored as-is into
`web/src/vendor/lab-explore/` and `web/src/vendor/chart-kit/` (its
domain-agnostic uPlot-based charting engine) and driven by the
`buildExploreModel` adapter in `exploreModel.ts`, mounted via
`LabExploreView.tsx`; deliberately generic-only (no medication overlays,
reference-band overrides, or data-quality flagging). Its
`placeOnBandScale` puts every reading on the unit its reference band is
expressed in — mass↔molar included, via the factor derived from
`molar-masses.json` — so a history that switched scales mid-decade plots as
one line instead of a cliff; the converted number reaches this chart's
in-memory series and nowhere else, since nothing is stored or exported
(ADR-0003), and a reading that cannot be placed exactly is dropped and named
rather than plotted on the wrong scale. Panel Detail also
carries a "Charts" tab (`PanelChartsView`): the panel's markers as a 3D
stacked-ribbon chart, one marker per depth plane, each normalized to
its own observed min/max so mixed units share one chart; alias LOINCs
merge into one series per test (canonical code = the test's `loinc`),
a checkbox picker selects up to 8 markers with stable per-marker
colors, plus a translucent/opaque toggle, a "Reset view" button, and
From / To year selects listing only the years the data actually has (a
gap year stays absent; picking a From past the To drags the other
along, and the pair drives the engine's `setRange` — out-of-window
points are dropped before per-series normalization, as in the mood
tracker), drag to rotate, wheel/pinch to zoom,
double-click to reset; the time axis stretches to the page width (the
room's x half-extent is fitted per draw so the projected room spans
~90% of the canvas; height fixed at 420px). The engine
(`web/src/components/analytics/chart3d-stacked-core.ts`,
`chart3d-camera.ts`) is ported from project-moodtracker's
`chart3d-stacked.js`/`chart3d-camera.js`, generalized from 8 fixed
slots to N series; it still exposes the ported `setWindowKind` /
`panByWindowWidth` / `panByDay` window controls, which the year selects
replaced and no caller uses. `StackedBiomarkerChart3D.tsx` mounts it and
`StackedBiomarkerSection.tsx` owns selection and the picker. Panel
Detail's "What's in range" and "Charts" tabs are both `React.lazy`
call-site imports behind a `<Suspense>`, so uPlot plus the vendored
lab-explore/chart-kit and the 3D canvas engine each load on first visit
instead of on first paint (All Observations shares the lab-explore
chunk). Both views also carry a "Trends" tab, second in the strip, which is
deliberately empty for now — a placeholder while what belongs in it is
undecided (task-0014). Panel Detail's Results
tab (the default: Observations and Indices tables) and All
Observations both carry a "Scheduled"
column, set apart at the right of each table — a single-click toggle
per row (`role=checkbox`, ✓ in primary blue); scheduling an index also
schedules its input observations, unscheduling it leaves them, and
toggling an observation re-derives every index (scheduled iff all its
inputs are) — the same cascade in both views, since All Observations renders
an Indices table too. The column header is a control rather than a word: a
month pill (this month and the next 23, plus a stored month that has since
fallen outside that window) above a select-all box carrying the "Scheduled"
label, tri-state through native `indeterminate` (`ScheduleHeader.tsx`, which
keeps its own copy of the filter pill's style rather than importing
`AllObservationsView`'s, since that module already imports the tables). The
month is an ISO `YYYY-MM` label *for* the one global schedule, not a partition
of it — switching months leaves every checked row checked — and select-all
scopes to the rows the table is actually rendering, so All Observations' panel
and text filters narrow it. Global state in localStorage
`bloodtests_scheduled_v1`
(`{loincs, indices, month?}` — backward compatible in both directions: an
unset month is `undefined`, so `JSON.stringify` drops the key and an
unscheduled payload keeps the old shape, and a missing or malformed one loads
as undefined with the checked sets intact), logic in `scheduled.ts`, whose
`useScheduled` hook the
shell owns and hands down as `RowScheduling` / `IndexScheduling`, rather than
Panel Detail, which remounts per panel. Selecting an index
row there marks each input observation with a blue • in a fixed 10px
gutter left of its name, and selecting an observation marks each index
that uses it; the gutter is reserved on every row so names never shift
(All Observations indents names by the same 13px, no marks there).
Persistent top nav
across five sections — Get Started (`#profile`: app description,
data-privacy statement and evidence-grading note, "Import JSON"
(replaces all stored sessions, as a share-link import does), a "Go to
Diagnostic Reports" pill for building a first database, and generate
synthetic test data (merges)), Diagnostic Reports (`#reports`: the
data-management hub — a collapsible "Database details" card editing
export-envelope metadata (read-only `generatedAt` stamped on each
export, plus subject / sex / birth year / notes; persisted under
localStorage key `bloodtests_envelope_meta_v1`, written into the export
envelope with empty fields omitted), the reports table with
error/warning dots, an "Add a report" card (1. copy the expandable
chatbot prompt — `data/chatbotPrompt.ts`, user-facing prose that follows the
interchange schema rather than the UI — 2. paste into a chatbot, 3. "Add" the chatbot-built
JSON — merges by session id, with "Adding…" progress and "✓ Added N
reports" feedback), and a "Back up your database" card (Export JSON /
Import JSON (replaces) / Clear behind a divider);
`#reports/<file>` detail allows inline editing of each observation's
LOINC / value / unit, saved to localStorage via `updateGroup`, and
carries a "Cross-check LOINCs" button (`loincCheck.ts`): an offline
resolver derives each row's LOINC from printed name + unit (ADR-0004;
Latin-name pass, then catalog `lang` translations, unit hard-selecting
among unit variants — the unit comparison key borrows
`unitNormalization`'s `foldUnitGlyphs` / `toLatinUnit` rather than
tabulating them twice, so a Cyrillic spelling ("ммоль/л", "тыс/мкл"),
a superscript digit (×10⁹/L) and the micro sign all fold to the
catalog's Latin form; per-code allowed-unit sets (`ALLOWED_UNITS`)
choose between variant codes and set confidence, while a candidate
whose unit dimension contradicts the row's is dropped outright, so
hemoglobin in g/L is never offered HbA1c's %; a Cyrillic name must
also cover a candidate's translation, so a qualifier — "общий",
"ЛПВП", "ЛПНП" — decides between siblings sharing "холестерин", while
a word that names no analyte (acid, total, serum, blood, "общий") may
settle between siblings but never makes a match alone, and a
translation carrying "общий" asks no printout to repeat it; a printed
-ic acid reads as its -ate anion, so "Folic Acid" is folate; and
alias-group members collapse into one suggestion, the kept code picked
by the row's unit) and treats a printed code as evidence only — ✓
derivation agrees (a code already the top match agrees even without
confidence, and gets no chips) / ⚠ confident derivation contradicts it (warning
names both codes; running the check applies every confident fix
straight into the edit draft and reports it as "✓ N codes filled
automatically — review and Save", re-running the check over the
updated rows, and leaves unit-labeled suggestion chips on the rows it
could not settle, each filling that row's LOINC on click — Save/Cancel
still gate persistence) / ✗ unknown with no derivation (without a
confident derivation, "Printed name differs from the LOINC name" shows
only when the printed name is none of the code's display, badge or
ru-RU/uk-UA names, case and punctuation ignored, and shares too few
words with its English or translated ones) — shows the official LOINC name
in grey under the printed name (printed name kept as provenance;
resolved names are session-only, never stored); a second-stage "Check
online (NLM)" button,
offered only for rows the offline pass couldn't resolve, sends test
names — never values — to clinicaltables.nlm.nih.gov, the single
explicit-opt-in exception to the everything-stays-local rule — that
lookup is the app's only network call and lives alone in
`data/loincNlm.ts`, so the privacy exception is a file you can open by
name; the resolver's domain-free edit-distance matching is likewise its
own module, `data/fuzzyMatch.ts`, with no tie to the analyte catalog), All
Observations (every uploaded result in one table, with a "Show
observations from" select narrowing it to one Monitoring Panel and a
"Find a marker" box narrowing it by text — both now sit in
`ControlsBar` beside the unit system and sample limit, one row of four
that wraps rather than a second row of its own; Panel Detail renders the
same four and *disables* the panel select rather than hiding it, since
it is already one panel and a control that vanishes between views makes
the bar jump, while its marker box does filter that panel's own tables.
`ControlsBar` holds no state: each view keeps its filter in `useState`
and passes it down, deliberately not lifting it to the shell, which owns
the *persisted* settings — a filter living there invites persisting it.
The bar sits between the `<h1>` and the `TabBar` in both views, so it
stays put across tabs rather than living inside the Results branch; a
control the active tab does not read renders disabled, never hidden,
which is what keeps the row's height the same on every tab
(`controlsForTab` in `ui.ts` — "What's in range" reads the unit system
and nothing else, Trends and Charts read none of it). Where the tab and
the view both disable the panel picker, the view's reason is the one
shown: it is still true after switching back to Results.
Both are session
state, never stored, so a filter cannot go on hiding rows the way a
stored `showPanels` once did; both the panel's codes and the rows fold
through `ALIAS_TO_PRIMARY` (`panelRowLoincs`, `markers.ts`) so a reading
matches its panel whichever of its codes the lab used, while
`buildConditions` still maps one-to-one; the text pass
(`observationMatchesQuery` / `indexMatchesQuery`, `markers.ts`) matches the
badge label, the displayed and long common names, every LOINC the row
answers for and every `rawName` a lab printed for it, so a Cyrillic printed
name finds its row; below the observations sits the same `IndexTable` Panel
Detail renders, scoped the way Panel Detail scopes it — the selected panel's
indices, or the union over the panels on offer, so a share link's allowlist,
which limits the panel options but never the observation rows, does narrow
the indices), Monitoring Panels
(the default/entry route), Reference Book (Indices and derived
measurements: a page
per computed index with formula, v2's full clinical prose and cited
sources with verbatim quotes; Organism-wide aspects: HP Axis page with v2's
homepage-derived feedback-loop cascades; Formulas and math: a "Mass ↔ molar
conversion" page at `#reference/molar-masses` rendered entirely from
`molarMasses.ts` — why one analyte reports on two scales, the
atomic-weights → formula → g/mol → factor chain worked through
cholesterol, the 17-analyte table with `basis` pills and PubChem/CIAAW
links, and the conventional cases quoting the JSON's own notes; like
`HpAxisPage` it lives inside `ReferenceBookPage.tsx`, and `#reference/<key>`
already routed generically — and beside it a "Units and how they are read"
page at `#reference/units`: why one unit has many spellings, UCUM as the
target vocabulary, the three normalization stages, the families of spellings
that are one unit (computed by asking `sameUnitScale`, not tabulated), a
"When U and IU are one unit" section setting out the deliberate deviation from
UCUM's refusal to make them commensurable and worked through a table of
enzyme / hormone / analyte-unknown answers, the SI/US switch, what is never
converted (ADR-0003), and a Sources block citing the UCUM spec, its licence,
WHO TRS 932 Annex 2, Clinical Chemistry's instructions to authors and the
LOINC Users' Guide, each with what it settles and a retrieval date; Analytes: a
"LOINC database" page at `#reference/loinc-database` listing every analyte the
app knows — code, name, specimen, units and panels, sortable by column) — each
its own URL hash so
browser back/forward works. Validation
(`validateDiagnosticReports.ts`) marks an observation missing its name
or value-or-rawValue, or carrying a non-empty code that isn't
LOINC-shaped (`^\d{1,7}-\d$` — catches lab-internal codes like
"900101"), as an error; an empty LOINC (the observation won't appear in
panels or All Observations), a missing unit, a missing reference
range, a printed unit whose dimension contradicts the code's property
(`checkCodeUnit` decides, so another scale of the same dimension — g/L
on a g/dL hemoglobin code — is no warning; the message names printed
unit, current code and the sibling to move to when `massMolarSiblings.ts`
knows one, the value never converted, ADR-0003, and the code's accepted
units otherwise), and, lower-severity, a unit that resolves
to neither a Latin spelling nor a UCUM code (the rows whose curated
tables need extending) are warnings; while errors exist, Monitoring Panels and All
Observations are disabled in the nav and their routes redirect to
`#reports` (Get Started and Reference Book stay reachable). Upload
accepts the v3 interchange envelope and nothing else
(`{ schema: "3.1", diagnosticReports }` — `SCHEMA_VERSION` in
`data/envelopeSchema.ts`, a `"major.minor"` STRING, since a JSON number
cannot tell `3.10` from `3.1`: the major is the compatibility question and
the minor rises on every envelope change, each a backward-compatible
addition, so any `"3.x"` is read — an older `"3.0"` and a future `"3.2"`
alike — plus the legacy bare number `3`, read as `3.0`, which is what
existing files carry; `3.1` was recorded retroactively for the unit pair the
exporter already wrote (ADR-0012, widening ADR-0009's `3`-only acceptance,
with the minor history in the interchange doc). The earlier `schema: 1`, v2's
canonical-draws and the two legacy shapes were all dropped in
ADR-0009, and old files go through `npm run convert:v3`
(`scripts/convert-to-v3.mjs`), which keeps every legacy branch;
other envelope fields ignored for now, though a report's `identifiers`
(visit/order/accession) feeds the session id so two same-day same-lab
draws don't collide on merge). Each observation's printed test name
lives in `rawName`, never `name` — the canonical name is derived from
the LOINC code at display time and deliberately never stored.
`parseUpload.ts` is also the single place unit normalization runs
(`unitNormalization.ts`, over every observation of every import route):
the printed value and unit are kept exactly as read, and where the unit
places cleanly and the conversion to the code's canonical UCUM unit is
known, the derived pair is attached to the in-memory `Result` as
`canonical` — an optional, clearly derived field that nothing treats as
lab-reported and the exporter's field-by-field mapping never emits.
Import reads `rawUnit` in preference to `unit`, since a file this app
wrote carries the normalized code in `unit` and the printed string in
`rawUnit`, and it is the printed string the app displays and validates.
Export (`exportData.ts`) writes a v3 envelope —
`schema`, `generatedAt`, `contentHash` (sha256 of the diagnosticReports
array only), subject/sex/birthYear/notes when set, and
reduced reports — as `blood-tests-export-<yyyymmdd>.json`. Each
observation's unit leaves as a pair: `unit` is the printed spelling
folded to its UCUM code (`ucumUnitFor`, spelling only — no value is
converted, ADR-0003) and `rawUnit` is the string the lab printed,
written whenever a unit was printed at all. A unit the curated tables
cannot place leaves `unit` absent rather than filled with the printed
string, which would claim a normalization that did not happen — the row
the validator already flags with its lower-severity warning. So an
import-then-export round trip is no longer byte-identical (it gains
`rawUnit`, and folds spellings in `unit`, so `contentHash` changes with
it); what holds instead, and is tested, is that the second round trip is
stable — export → import → export is byte-identical, which is the
property that catches drift. See
`docs/tech/interchange-format.md` for exactly which envelope fields are
implemented, and `web/public/schema/bloodtests-3.schema.json` (served at
`blood.isayenko.net/schema/`, draft 2020-12, objects open, major-3 only —
as is the parser, since ADR-0009; the file name stays major-only and its `$id`
never moves, one document validating every minor, which is what makes a minor
an addition rather than a new format) for the machine-readable form; the envelope's
TypeScript types are generated from that schema by `npm run schema:types`
(`scripts/generate-envelope-types.mjs` → `data/envelopeTypes.ts`), with a
drift test failing CI on an ungenerated schema edit. Unit normalization
(`data/unitNormalization.ts`) runs three pure stages — printed unit (Cyrillic
and Ukrainian unit tables, superscripts, micro-sign and
multiplication-sign folding) to a canonical Latin spelling,
Latin to a UCUM code, then a LOINC-versus-unit dimension check — plus
`convertValue` / `canonicalUnitFor` and a `normalizeObservationUnit`
orchestrator returning all three stages in one reviewable result, plus
`ucumUnitFor` (stages 1–2 in one call), which the exporter writes to `unit`. It
has three callers: `parseUpload.ts` (above), `validateDiagnosticReports.ts` and
`utils/exportData.ts`. The printed
value stays authoritative and is never converted; the derived *value* pair
(`canonical`) is never written back to `value`/`unit` and never exported, and an
unrecognized unit returns
undefined rather than a guess — which is itself the lower-severity warning.
Only the unit's spelling is normalized in a file, and only in `unit`, with the
printed string kept in `rawUnit`.
A molar unit under a mass-concentration code is treated as a *code* error, so
the check suggests the analyte's `[Moles/volume]` sibling from the 21 curated
pairs in `data/massMolarSiblings.ts` (each pair's code declaring only
`{loinc, longCommonName}` and taking its unit from the catalog's
`DEFAULT_UNITS` via `withUnit()`, which throws naming the code if the catalog
has none, and each pair naming its analyte's entry in
`molar-masses.json` rather than stating a factor; the derived factor is data
only) instead of converting the number (ADR-0003; UCUM as the target
vocabulary is ADR-0007). That mismatch is also the one normalization case with
a confirm-and-apply UI: `unitRepairFor` (`reportDetailHelpers.ts`) re-runs
`normalizeObservationUnit` per row and feeds the sibling code into the report
detail view's existing chip row as a third source beside the offline resolver
and the NLM lookup, clicking it changing the `loinc` alone — never the value or
the printed unit — through the same edit draft and Save/Cancel gate. It is
deliberately not auto-applied the way a confident LOINC fix is, since these
warnings render on mount and auto-applying would mutate the draft on page load;
the unmappable-unit warning gets no chip, there being nothing to suggest.
Those molar codes were added to the analyte catalog
(`web/public/data/analyses.json`, 124 → 139 entries then, 164 now — the last
three, `14749-6` glucose, `22664-7` urea and `14798-3` iron, added when the
sibling pairs stopped declaring their own units and the catalog turned out not
to carry them; the same pass corrected eight `mcg/…` unit spellings and one
`µg/mL` to the app's canonical Latin `ug/…`, a spelling
`molarMasses.ts`'s `concentrationScale` cannot parse a prefix out of)
and carry `aliasOf`
against their mass primary, so a molar code folds into the same panel row,
badge and chart series as the mass one with no changes to panels, tables or
charts. Two Ajv-validated offline
Node scripts sit beside the app: `npm run convert:v3`
(`scripts/convert-to-v3.mjs`, above) and `node scripts/recode-molar.mjs <file>`
— no npm alias — which rewrites only the `loinc` of an observation whose mass
code carries a molar unit, leaving value, unit and reference ranges exactly as
printed. The original pre-nav upload/panels/results flow has been
retired to `archive/src/components/` at the repo root (`layout/`,
`panels/`, `results/`, plus `upload/UploadPage.tsx`, `AnalyticsPage.tsx`,
`BiomarkerCharts.tsx` and `BiomarkerChart.tsx`) — outside `web/`, so it
is outside the TS build, Vite's module graph, eslint, Sonar's
`sonar.sources` and coverage by construction rather than by exclusion
list. Its shared chart types (`LoincEntry`, `BiomarkerNames`) live on in
`web/src/components/analytics/types.ts`, and the series palette in
`palette.ts`, so the still-live Charts tab has no dependency on the
archive.

## Known limitations

Round-trip and format gaps are listed in
[`docs/tech/interchange-format.md`](docs/tech/interchange-format.md#known-round-trip-gaps);
build-level ones (entry bundle over Vite's 500 kB advisory) in
[`docs/tech/README.md`](docs/tech/README.md#known-limitations).

## Quality

Vitest suites in `web/test/` (609 tests across 25 files, 1 skipped: index
golden-masters ported from v2, upload parsing — the v3 envelope, and
every non-v3 shape rejected — and import-replace, diagnostic-report validation, LOINC
cross-check, the NLM lookup's unit selection (pure, no request made), the
report-detail row helpers, unit normalization (Latin/UCUM stages, dimension check,
conversion, and the property-gated U/IU fold in both directions and its refusal
without an analyte), export
envelope, published JSON Schema conformance and generated-type drift (ajv and
json-schema-to-typescript, devDependencies only —
nothing schema-related is bundled), reference-data conformance
(analyses / panels / monitoring-panels against
`analytes-1.schema.json`, plus catalog consistency: no duplicate
LOINC, every `aliasOf` resolving, every `short` carrying a unit;
molar-masses against `molar-masses-1.schema.json`, plus every mass
recomputed from its formula, agreeing with a cited source within
0.05%, and every sibling pair naming a tabulated entry),
share-link and shared-meta,
explore-model, markers, routing,
scheduling, ui helpers, build stamp, format utils; the mobile reveal —
`TableScroller`, `usePullReveal`, `useHideOnScroll`, `useIsMobile` — has none
yet). CI
(`.github/workflows/ci.yml`) runs lint → tests+coverage → build in a
`test` job, with the SonarCloud scan (CI-based, `SONAR_TOKEN` secret;
Automatic Analysis is off) split into a parallel `sonar` job that takes the
full-history checkout and re-runs coverage for itself, so the ~6-minute scan
still reports on every push and PR but no longer delays the deploy, which
gates on nothing at all: the `deploy` job carries no `needs:` and starts at
once beside `test` and `sonar`, so a push is live in about a minute and lint
and the tests report *after* the code is already serving — a red suite means
rolling forward rather than a blocked deploy, with `npm run build`'s `tsc -b`
the only check that can still stop it. Coverage metric is scoped to the testable logic —
`sonar.coverage.exclusions` skips the React view layer. Dependabot:
weekly npm (minor+patch grouped) and github-actions bumps.

## Repo

[project-bloodtests-v3](https://github.com/alexisayenko/project-bloodtests-v3)
(public). Remote via SSH (`git@github.com:...`).

## Where to look for more

- [README.md](README.md) — repo entry point + structure
- [docs/README.md](docs/README.md) — docs subtree map
- [docs/product/concepts/](docs/product/concepts/) — observation, monitoring
  panel, lab report, computed index, companion observation (planned),
  unit (printed and canonical are a pair: `rawUnit` and `unit`)
- [docs/tech/decisions/](docs/tech/decisions/README.md) — ADR index
  (thirteen records; ADR-0005–0010 recorded 2026-09-07, ADR-0011 2026-09-08,
  ADR-0012 and ADR-0013 2026-09-09)
- [docs/tech/interchange-format.md](docs/tech/interchange-format.md) —
  envelope spec, and its published JSON Schema
