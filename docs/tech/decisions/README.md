# Decisions (ADRs)

Architecture decision records — one file per decision, in
[Michael Nygard's shape](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)
(context → decision → consequences → what would force revisiting it).

File name: `adr-NNNN-<slug>.md`, zero-padded sequential, numbered
independently of project-bloodtests-v2. Numbers are never recycled; a
decision that gets reversed keeps its file and gains a
`Status: superseded by ADR-NNNN` line rather than being deleted.

Each record opens with `# ADR-NNNN: <title>` and a
`Status: <state> · <date>` line.

## Index

| ADR | Decision | Status |
| --- | --- | --- |
| [ADR-0001](adr-0001-content-hash-plain-stringify.md) | `contentHash` over plain `JSON.stringify`, not a canonical serialization | accepted · 2026-08-27 |
| [ADR-0002](adr-0002-borrow-fhir-shapes-not-fhir.md) | Borrow FHIR's shapes, without adopting FHIR | accepted · 2026-08-27 |
| [ADR-0003](adr-0003-store-only-what-the-lab-printed.md) | Store only what the lab printed, no `us` / `si` blocks | accepted · 2026-08-27 |
| [ADR-0004](adr-0004-derive-loinc-from-name-and-unit.md) | Derive LOINC from printed name + unit, demote printed codes to evidence | accepted · 2026-08-28 |
| [ADR-0005](adr-0005-companion-observations-are-not-panels.md) | Companion observations are a third relation kind, not panels | accepted · 2026-09-07 |
| [ADR-0006](adr-0006-envelope-schema-numbered-3.md) | Envelope `schema` numbered 3 to match the project | accepted · 2026-09-07 · partially superseded by 0009, 0012 |
| [ADR-0007](adr-0007-ucum-as-the-unit-vocabulary.md) | UCUM as the canonical unit vocabulary | accepted · 2026-09-07 |
| [ADR-0008](adr-0008-fhir-shaped-envelope-not-fhir.md) | A FHIR-shaped envelope, not a FHIR document | accepted · 2026-09-07 |
| [ADR-0009](adr-0009-v3-only-and-rawname.md) | v3-only upload, and observation `name` renamed to `rawName` | accepted · 2026-09-07 · widened by 0012 |
| [ADR-0010](adr-0010-analyte-catalog-is-the-source-of-truth.md) | The analyte catalog is the source of truth, and panels have two layers | accepted · 2026-09-07 |
| [ADR-0011](adr-0011-molar-masses-are-data-factors-are-derived.md) | Molar masses are cited reference data; conversion factors are derived | accepted · 2026-09-08 |
| [ADR-0012](adr-0012-envelope-version-is-a-major-minor-string.md) | The envelope version is a `"major.minor"` string | accepted · 2026-09-09 |
| [ADR-0013](adr-0013-u-and-iu-fold-by-loinc-property.md) | `U` and `IU` are one unit only where the analyte's LOINC property says so | accepted · 2026-09-09 |
| [ADR-0014](adr-0014-pathway-wiring-is-mermaid-generated-to-json.md) | Pathway wiring is written in Mermaid and generated to JSON | accepted · 2026-09-11 |
| [ADR-0015](adr-0015-dedicated-server-storage-via-bearer-token.md) | Opt-in "dedicated server" storage, authenticated by a bearer token, not OAuth | accepted · 2026-09-12 · superseded by 0017 |
| [ADR-0016](adr-0016-scheduling-is-a-collection-of-independent-visits.md) | Scheduling is a collection of independent visits, not one global schedule | accepted · 2026-09-13 |
| [ADR-0017](adr-0017-supabase-storage-self-hosted-then-cloud.md) | Supabase (self-hosted, then managed cloud) replaces the bearer-token server; real accounts/OAuth return | accepted · 2026-09-13 · supersedes 0015 · superseded by 0018 |
| [ADR-0018](adr-0018-firebase-storage-provisional.md) | Firebase (Auth + Firestore) replaces the Supabase plan, provisionally | accepted · 2026-09-13 · supersedes 0017 · superseded by 0019 |
| [ADR-0019](adr-0019-self-hosted-supabase-replaces-firebase.md) | Self-hosted Supabase replaces Firebase for cloud sync | accepted · 2026-09-14 · supersedes 0018 · data store superseded by 0026, auth by 0027 |
| [ADR-0020](adr-0020-constants-from-cited-data-calculators-are-cross-checks.md) | Physical constants come from cited reference data; external calculators are cross-checks, not gold standards | accepted · 2026-09-16 |
| [ADR-0021](adr-0021-pathway-pages-share-one-overlay-engine.md) | Pathway pages share one overlay and association engine | accepted · 2026-09-16 |
| [ADR-0022](adr-0022-illustrative-artwork-and-data-drawn-glyphs-coexist.md) | Illustrative artwork and data-drawn glyphs coexist | accepted · 2026-09-16 |
| [ADR-0023](adr-0023-product-purpose-and-clinical-boundary.md) | Product purpose, audience, and clinical boundary | accepted · 2026-09-18 |
| [ADR-0024](adr-0024-panel-date-range-is-header-scoped-and-explicitly-applied.md) | The panel date-range control is header-scoped and changes data only through an explicit binding | accepted · 2026-09-18 |
| [ADR-0025](adr-0025-mchc-percent-is-not-an-accepted-unit.md) | MCHC printed in `%` is flagged, not accepted; the fix is the owner's data edit | accepted · 2026-09-19 |
| [ADR-0026](adr-0026-github-backed-cloud-storage.md) | Cloud data lives in a private GitHub repo behind a Worker | accepted · 2026-09-19 · supersedes 0019 (data store only) · identity amended by 0027 |
| [ADR-0027](adr-0027-worker-owned-oauth.md) | The Worker owns Google / Apple sign-in; Supabase Auth is retired | accepted · 2026-09-19 · supersedes 0019 (auth) · amends 0026 |

## Where each one bites

- **The interchange file** — 0001 (`contentHash`), 0002 and 0008
  (FHIR-shaped field design), 0003 (no converted sibling values),
  0006 (`schema` version number), 0007 (`unit` / `rawUnit`), 0009
  (v3-only upload, `rawName`), 0012 (the version is a
  `"major.minor"` string, and a minor is a backward-compatible
  addition). All of these are cross-linked from
  [`../interchange-format.md`](../interchange-format.md).
- **LOINC resolution** — 0004, implemented in
  `web/src/data/loincCheck.ts`.
- **Reference data** — 0010, implemented in
  `web/public/data/analyses.json` (the analyte catalog) and
  `web/public/data/monitoring-panels.json`, derived in
  `web/src/data/analyteCatalog.ts`; see the
  [observation](../../product/concepts/observation.md) and
  [monitoring panel](../../product/concepts/monitoring-panel.md)
  concepts. 0011 applies the same rule to mass↔molar arithmetic —
  `web/public/data/molar-masses.json`, derived in
  `web/src/data/molarMasses.ts`; see
  [`../molar-masses.md`](../molar-masses.md). 0020 holds that line
  against outside tools: issam.ch's free-testosterone calculator converts
  T at ~280 g/mol, and the app keeps 288.431, anchors its tests on
  ISSAM's published worked example exactly and on the live calculator at
  a 1% tolerance whose cause is written down, and allows the other mass
  only as the Hormonal Pathways page's labelled, unpersisted cross-check
  select; see the [computed index](../../product/concepts/computed-index.md)
  concept and [task-0047](../../tasks/task-0047.md).
- **Relations between markers** — 0005, still unbuilt; see the
  [companion observation](../../product/concepts/companion-observation.md)
  concept and [task-0010](../../tasks/task-0010.md).
- **Units** — 0007, derived in `web/src/data/unitNormalization.ts` and
  written out as a pair: the folded spelling in `unit`, the printed
  string in `rawUnit`. No value is converted (0003). See the
  [unit](../../product/concepts/unit.md) concept and
  [task-0011](../../tasks/task-0011.md), done; the UCUM parser it
  handed on is [task-0008](../../tasks/task-0008.md). 0013 qualifies
  0007 in one place — `U` and `IU` are one unit for an analyte whose
  LOINC property names one of them, the two sets derived from the
  catalog's long common names (0010) in
  `web/src/data/analyteCatalog.ts`, and a label is all it decides
  (0003).
- **Pathways** — 0014, still unbuilt: per-axis Mermaid wiring generated
  to `web/public/data/pathways.json`, the same single-source rule as
  0010 — Hormonal Pathways and Lipid Transport each hard-code their wiring
  meanwhile. 0021: both pages draw on one shared layer,
  `web/src/components/conditions/pathwayShared.ts` and `PathwayParts.tsx` —
  reference and source blocks, the date stepper, dismissal, and the
  DOM-measured overlay with association lines hidden at rest — and own only
  their layout and wiring. 0022: generated artwork may ship as illustration
  — the brain and Lipid Transport's liver image — but never stands in for a
  shape that encodes a quantity; Lipid Transport's particle icons, redrawn in
  task-0062 first as hand-drawn `customIcons.tsx` glyphs and later (TRIG and
  the fatty-acid markers) as ChatGPT-generated raster artwork, no longer
  carry computed-from-data areas the way the retired Data mode did — a
  stack's own circle count, not its icon's shape or size, still encodes
  quantity either way — and the sourced
  `lipoprotein-particles.json` composition (IDL and Lp(a) "not sourced") now
  surfaces only in the page's own size-and-composition table. See the
  [pathway](../../product/concepts/pathway.md) concept,
  [task-0024](../../tasks/task-0024.md), [task-0060](../../tasks/task-0060.md)
  and [task-0062](../../tasks/task-0062.md).
- **Sync / storage backend** — 0015: an opt-in dedicated server storage
  mode beside the unchanged local-only default, syncing the existing
  backup-bundle shape; its bearer-token auth model
  superseded the auth model in
  [task-0025](../../tasks/task-0025.md), and is itself superseded by
  0017, which replaces the bespoke server with Supabase (self-hosted on
  Alex's own machine for the proof-of-concept, then managed Supabase
  Cloud once there are real users) and brings real accounts back via
  Supabase Auth, likely Google OAuth — 0017 in turn is superseded by
  0018, which drops Supabase entirely, before either phase was built,
  for Firebase (Firebase Auth for Google Sign-In, Firestore for the
  synced data), an explicitly provisional choice made for
  speed-to-working-setup and zero ops rather than a settled long-term
  pick. 0018 is itself superseded by 0019, which does the "check what
  fits me better" comparison 0018 anticipated and lands on self-hosted
  Supabase — a second, independent instance kept apart from any other
  project's Supabase — with Supabase Auth (Google/Apple, PKCE flow) and
  a `public.user_backups` table under RLS standing in for Firestore's
  per-person document; implemented, Firebase's own code since removed
  (2026-09-18). The storage-mode shape and the
  one-time-cutover migration model carry over from 0015 unchanged, and
  0018's own two-tier sign-in policy (cloud wins; sign-out pushes then
  wipes local, unless local is empty and cloud isn't) carries over from
  0018 into 0019 unchanged too — only the backend and the sign-in
  plumbing around it changed. 0026 then replaces 0019's data store, not
  its auth: the `user_backups` row goes, and the
  synced data becomes per-report JSON files in a private GitHub repo
  (`alexisayenko/data-storage`) written by the app's own Worker at
  `/api/data` with a repo-scoped token the browser never sees — git
  history as version history, files the owner can edit. This amends the
  "no server the app owns" principle: the Worker is a stateless
  auth-checking proxy. 0027 then retires Supabase Auth too: the Worker
  performs Google and Apple OAuth itself and issues a signed session cookie,
  with no database and no auth service to run. See
  [`../account-and-sync.md`](../account-and-sync.md).
- **Scheduling** — 0016: a list of independent `ScheduledVisit` entries
  rather than one global schedule object, implemented in
  `web/src/components/conditions/scheduled.ts` and rendered as one
  Scheduled column per visit in the results tables and one stacked section
  per visit on `#plan` (`PlanVisitView.tsx`).
- **MCHC in `%`** — 0025: a lab's `%` on `786-4` is a legacy label for g/dL,
  and the app still flags it instead of adding `%` to `allowedUnits`; the
  same goes for absolute differential counts printed without a range. See
  [`../units.md`](../units.md#mchc-printed-in-).
- **Product purpose and clinical boundary** — 0023: the three pillars
  (reduce complexity, show the whole picture, build understanding), the
  audience definition, the learning approach, and the clinical boundary
  ("understanding, not diagnosis") that shapes feature scope and wording
  throughout. Documented in
  [`../../product/README.md`](../../product/README.md) (core idea +
  constraints) and [`../../business/README.md`](../../business/README.md)
  (audience, scope, non-goals).
- **Panel date range picker** — 0024: the header-scoped date-range control
  on Panel Detail (`start year — end year`), visible while the Trends tab is
  active; opens as an overlay popup without layout shift, featuring a
  horizontally scrollable timeline with dual handles and report counts per
  calendar year. Presentational/locally interactive first, prior to explicit
  atomic data binding. Cross-linked from [task-0027](../../tasks/task-0027.md).

## Adding one

1. A decision is made that would otherwise be re-argued later.
2. Create `adr-<next-number>-<slug>.md` with the sections above.
3. Add the row to the index, and cross-link it from the doc the
   decision governs (usually
   [`../interchange-format.md`](../interchange-format.md) or a
   [concept](../../product/concepts/README.md) page).
