# Milestones

Dated project events — launches, releases, public posts, evidence
artifacts. Newest first.

Starts as this flat file. Extracts to `milestones/` (with
`history.md` index + dated deep-dive files + evidence) when
events accumulate enough to warrant their own pages — see
[`README.md#section-file-folder`](README.md#section-file-folder).

## Events

- 2026-09-07 — One place to look up a LOINC code. Everything the app
  knew about a code was spread across four tables — the catalog in
  `web/public/data/analyses.json`, `SHORT_LABELS` and `ALSO_REFS` in
  `markers.ts`, and three unit maps in `loincCheck.ts` — and they had
  drifted: two hand-copied LOINC names disagreed with the catalog's
  own, Zinc was in it twice under two display names, and 21 codes the
  product shows a badge for had no entry at all, so the LOINC
  cross-check could never derive them. The facts now live on the
  catalog entry (`short`, `unit`, `allowedUnits`, and `aliasOf` /
  `aliasLabel` on a unit or method variant), the lookup maps are
  derived from it at load in `web/src/data/analyteCatalog.ts`, and
  `PANEL_DEFS` moved out of TypeScript into
  `web/public/data/monitoring-panels.json` — separating the two panel
  layers, the laboratory's groups (`panels.json`) from the product's
  composition over them. A new draft 2020-12 schema
  (`web/public/schema/analytes-1.schema.json`, closed objects, unlike
  the interchange envelope's open ones) and
  `web/test/reference-data.test.ts` hold all three files to shape, so
  a malformed edit fails the suite instead of being ignored at
  runtime
  ([ADR-0010](tech/decisions/adr-0010-analyte-catalog-is-the-source-of-truth.md)).
- 2026-09-07 — Units get a derivation, not a rewrite:
  `web/src/data/unitNormalization.ts` maps a printed unit (Cyrillic
  and Ukrainian tables, superscripts, micro and multiplication signs)
  to a canonical Latin spelling, then to a UCUM code, then checks that
  code's dimension against the observation's LOINC. Every stage is
  pure — the printed value and unit stay authoritative, a canonical
  form is computed on demand and never stored, and an unplaceable unit
  returns nothing rather than a guess. The sharp case is mass versus
  molar: a `mmol/L` cholesterol under `2093-3` is a *code* error, so
  the check names the `[Moles/volume]` sibling (`14647-2`) rather than
  converting the number
  ([ADR-0003](tech/decisions/adr-0003-store-only-what-the-lab-printed.md);
  UCUM as the vocabulary is
  [ADR-0007](tech/decisions/adr-0007-ucum-as-the-unit-vocabulary.md)).
  20 curated pairs in `massMolarSiblings.ts`, their molar codes added
  to the analyte catalog (`analyses.json`, 124 → 139) and aliased to
  the mass primary in `ALSO_REFS` / `ALIAS_TO_PRIMARY`, so panels,
  tables and charts fold both codes into one row without an edit.
  `web/scripts/recode-molar.mjs` applies the same repair to a file
  offline (loinc only, Ajv-checked against the published schema),
  joining `npm run convert:v3` as the second offline envelope tool;
  envelope TypeScript types are now generated from that schema
  (`npm run schema:types`) with a drift test. Nothing is wired into a
  view yet — [task-0011](tasks/task-0011.md) tracks the UI and the
  catalog consolidation that remain.
- 2026-09-07 — Interchange format frozen before real data lands:
  upload now reads the v3 envelope and nothing else (`schema: 3`
  only — the legacy `1`, project-bloodtests-v2's canonical draws and
  the two inherited flat/grouped shapes all dropped, along with
  `drawsSchema.ts`), and an observation's printed test name moved
  from `name` to `rawName`, since the canonical name is derived from
  the LOINC code at display time and deliberately never stored.
  `web/scripts/convert-to-v3.mjs` keeps every legacy branch and
  gains the rename, so old files are converted once with
  `npm run convert:v3` instead of being read in place. Recorded as
  [ADR-0009](tech/decisions/adr-0009-v3-only-and-rawname.md), which
  supersedes [ADR-0006](tech/decisions/adr-0006-envelope-schema-numbered-3.md)'s
  "`1` stays accepted".
- 2026-09-07 — Decisions written down as ADRs, closing questions that
  had been re-argued in chat.
  [ADR-0005](tech/decisions/adr-0005-companion-observations-are-not-panels.md)
  makes companion observations ("draw homocysteine with B12") a third
  relation kind rather than more panels or more index inputs;
  [ADR-0007](tech/decisions/adr-0007-ucum-as-the-unit-vocabulary.md)
  fixes UCUM as the canonical unit vocabulary for the day units are
  normalized; and
  [ADR-0008](tech/decisions/adr-0008-fhir-shaped-envelope-not-fhir.md)
  states why the envelope is FHIR-*shaped* rather than a FHIR Bundle
  ([ADR-0006](tech/decisions/adr-0006-envelope-schema-numbered-3.md)
  landed the same day with the renumber it records — see below).
  The two unbuilt ones each gained a concept page —
  [companion observation](product/concepts/companion-observation.md),
  [unit](product/concepts/unit.md) — and a task:
  [task-0010](tasks/task-0010.md) (companion research),
  [task-0011](tasks/task-0011.md) (UCUM normalization). The ADR folder
  gained an [index](tech/decisions/README.md) at eight records.
- 2026-09-07 — Interchange format gains a formal JSON Schema
  (draft 2020-12), published at
  `blood.isayenko.net/schema/bloodtests-3.schema.json` from
  `web/public/schema/`: the whole envelope, reports and observations
  with per-field descriptions drawn from
  [the prose spec](tech/interchange-format.md), objects left open so a
  future optional field doesn't invalidate old readers, and version-3
  only — the upload parser still accepts `1`, the published schema does
  not, a distinction `web/test/envelope-schema.test.ts` asserts by name
  alongside validating the exporter's own output. The spec also gains an
  optional, unimplemented per-observation
  [`rawUnit`](tech/interchange-format.md#rawunit): the unit exactly as
  printed, reserved for the day a normalization pass rewrites `unit`,
  mirroring how `rawValue` preserves a printed `< 0.01`. Closes
  [task-0003](tasks/task-0003.md).
- 2026-09-07 — Interchange envelope's `schema` renumbered from 1 to 3,
  aligning the number with the project version; the format itself is
  unchanged, so envelopes stamped 1 (earlier exports, share-link
  payloads) still import. Export and the chatbot prompt now write 3;
  the current version and the accepted set (`{1, 3}`) live in
  `web/src/data/envelopeSchema.ts` —
  [ADR-0006](tech/decisions/adr-0006-envelope-schema-numbered-3.md).
- 2026-09-07 — Panel Detail's Analysis tab gains a "Scheduled" column —
  what to order at the next draw — set apart at the right of both the
  Observations and Indices tables behind a spacer column: a
  single-click toggle per row (✓ in primary blue); scheduling an index
  also schedules its input observations, unscheduling it leaves them,
  toggling an observation re-derives every index (scheduled iff all its
  inputs are); global state in localStorage `bloodtests_scheduled_v1`
  (`scheduled.ts`). Relation marks landed alongside: selecting an index
  row marks each input observation with a blue • in a fixed gutter left
  of its name, and selecting an observation marks each index that uses
  it; the gutter is reserved on every row so names never shift. The
  Observations and Indices tables were also switched to one shared
  fixed column grid (`table-layout: fixed` plus a colgroup of identical
  label/date/gap/Scheduled widths), so the two tables line up as a
  single block instead of each sizing its columns to its own content.
  Deployed to `blood.isayenko.net` the same day.
- 2026-09-07 — Panel Detail gains a "Charts" tab: the panel's markers
  as a 3D stacked-ribbon chart (one marker per depth plane, each
  normalized to its own observed min/max so mixed units share one
  chart; alias LOINCs merged into one series per test; checkbox picker
  up to 8 markers with stable colors; drag to rotate, wheel/pinch to
  zoom, double-click to reset). Engine ported from project-moodtracker's
  `chart3d-stacked.js`/`chart3d-camera.js`, generalized from 8 fixed
  slots to N series. The tab then gained a time-window selector (All
  time / 1 week / 1 month / 1 year, anchored to the latest date; ‹›
  pans by a day or by a window width, clamped to the data extent;
  out-of-window points dropped before per-series normalization, as in
  the mood tracker), and its time axis now stretches to the page width
  (room x half-extent fitted per draw so the projected room spans ~90%
  of the canvas; height fixed at 420px). Deployed to
  `blood.isayenko.net` the same day.
- 2026-08-26 — FAI (Free Androgen Index) added to the Hypogonadism panel
  alongside cFT, graded heuristic (Vermeulen's own paper calls FAI
  SHBG-biased and unreliable; cFT is preferred); first nav tab renamed
  Profile → Get Started, gaining an app-description, data-privacy
  statement, and evidence-grading note; "What's in range" chart gains a
  distinct index-value-cell popup (name/short name/date/"Calculated"/
  value/ref-range, plus a same-draw lab-reported comparison when
  available); its computed-indices support, previously Panel Detail
  only, now also works on All Observations; markers/indices shared
  across multiple panels now group under every relevant panel in the
  picker (previously collapsed to one); HDL-C plots against a cited
  NCEP ATP III band (40/60 mg/dL) since its lab-printed range has no
  upper bound; a 1px tab-switching jitter (top nav + Analysis/What's-in-
  range tab bars) fixed.
- 2026-08-26 — Monitoring Panels grid cards and the "What's in range"
  chart (Panel Detail only) now also show each panel's computed
  indices, dot-colored by ok/warn/bad zone, below a divider; Panel
  Detail gained a back chevron (‹) before its title, back to the
  Monitoring Panels grid; not-taken chips show just the marker name
  (no "never taken" caption); the single-panel picker (Panel Detail)
  drops the bordered box/caption that multi-panel pickers (All
  Observations) still show.
- 2026-08-26 — Panel Detail and All Observations' "What's in range" tab
  built: a normalized-overlay time chart (every marker as % of its own
  reference range on one shared axis), v2's `<lab-explore>` component
  vendored as-is (`web/src/vendor/lab-explore/`, `web/src/vendor/chart-kit/`)
  and driven by a new `exploreModel.ts` adapter; generic-only scope (no
  medication overlays, reference-band overrides, or data-quality
  flagging).
- 2026-08-26 — Monitoring Panels grid restyled from pill/badge cards
  to list rows (status as a colored dot); breadcrumb navigation
  removed from Panel Detail and Reference Book; top nav reordered to
  Profile, Monitoring Panels, All Observations, Reference Book;
  Analysis table cells gain two-step click-to-open (arm, then open a
  result popup).
- 2026-08-26 — Deploy domain switched from `blood.isayenko.org` to
  `blood.isayenko.net`.
- 2026-08-25 — Quality baseline: page shell split into view
  components; 91-test vitest suite (v2 golden-masters ported); CI +
  SonarCloud (0 issues, quality gate green, 90.6% coverage of the
  logic layer) + Dependabot; eslint/Sonar/coverage all exclude the
  legacy unwired flow consistently.
- 2026-08-25 — Reference Book gains an HP Axis physiology page: the
  homepage-era HPG/prolactin explainer and HPT/HPG/HPA feedback-loop
  cascades, ported verbatim from v2's lens-common.
- 2026-08-25 — Reference Book built: a page per computed index with
  v2's full clinical prose (meaning + evidence standing) and cited
  sources with verbatim quotes; index popups deep-link into it.
- 2026-08-25 — All Observations section (all results, one table) and
  Profile data actions (Upload JSON / Generate Test Data / Clear,
  merging instead of replacing); short-label cleanup and de-duplicated
  popup headings; leptin LOINC corrected to 21365-2.
- 2026-08-25 — Monitoring Panels app built and deployed to
  `blood.isayenko.org`.
- 2026-08-25 — Computed indices (TC/HDL, HOMA-IR, calculated free
  testosterone, and 17 others) ported from `project-bloodtests-v2`.
- 2026-08-25 — Added a persistent app-wide nav (Reference Book,
  Monitoring Panels, Profile) and breadcrumb navigation.
