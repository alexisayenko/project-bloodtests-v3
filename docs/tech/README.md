# Tech

Stack, infrastructure, and architectural decisions. The "how it
runs" layer — what's used to build and operate the product.
Product / business / UX live in their own sections. The fast path for an
agent is [`CLAUDE.md`](../../CLAUDE.md); the pages here carry the detail.

## Pages

Data and formats:

- [`reference-data.md`](reference-data.md) — every JSON under
  `web/public/data/`: the analyte catalog, laboratory groups and Monitoring
  Panels, molar masses, the laboratory registry, the Martin-Hopkins table and
  the pathway data, each with its closed schema, loader and tests
  ([ADR-0010](decisions/adr-0010-analyte-catalog-is-the-source-of-truth.md),
  [ADR-0011](decisions/adr-0011-molar-masses-are-data-factors-are-derived.md)).
- [`molar-masses.md`](molar-masses.md) — the molar-mass table with its
  citations, the conventional entries, and why issam.ch's ~280 g/mol
  testosterone is a documented deviation
  ([ADR-0020](decisions/adr-0020-constants-from-cited-data-calculators-are-cross-checks.md)).
- [`units.md`](units.md) — the three normalization stages, when two
  spellings are one unit, the U/IU fold by LOINC property, display-time
  conversion, and mass-versus-molar as a code error
  ([ADR-0003](decisions/adr-0003-store-only-what-the-lab-printed.md),
  [ADR-0007](decisions/adr-0007-ucum-as-the-unit-vocabulary.md),
  [ADR-0013](decisions/adr-0013-u-and-iu-fold-by-loinc-property.md)).
- [`computed-indices.md`](computed-indices.md) — `INDEX_DEFS` and the
  engine: inputs through aliases, bands and sex, LDL-C estimates, the
  testosterone family.
- [`interchange-format.md`](interchange-format.md) — the lab-data envelope
  (spec; partially implemented — see its status note). Its machine-readable
  form is published at
  [`blood.isayenko.net/schema/bloodtests-3.schema.json`](https://blood.isayenko.net/schema/bloodtests-3.schema.json)
  (JSON Schema draft 2020-12, source `web/public/schema/`, major version 3
  only), held to the exporter's output by `web/test/envelope-schema.test.ts`.
- [`lab-data-import.md`](lab-data-import.md) — research note, not an ADR:
  the legal basis (HIPAA, Cures Act, GDPR, EHDS, Ukraine's ЕСОЗ) and the
  technology (SMART on FHIR public client, FHIR R4 lab queries, Apple Health /
  Health Connect) for importing lab results directly instead of through the
  chatbot prompt, with a FHIR → envelope mapping and a suggested spike.

Sections and views:

- [`diagnostic-reports.md`](diagnostic-reports.md) — the upload and edit
  workflow: chatbot prompt, parser, validation tiers, LOINC cross-check and
  the NLM lookup, export.
- [`navigation-and-shell.md`](navigation-and-shell.md) — routes and
  blocking, the app shell, sidebar and phone nav, shared components and
  design tokens, the archive.
- [`monitoring-panels.md`](monitoring-panels.md) — the grid and Panel Detail.
- [`results-tables.md`](results-tables.md) — the one `ResultsTable`: cells
  and units, controls bar, frozen column and mobile reveal, scheduled
  columns.
- [`scheduling-and-visits.md`](scheduling-and-visits.md) — visits storage
  and cascade, the Scheduled Visits page, lab pricing
  ([ADR-0016](decisions/adr-0016-scheduling-is-a-collection-of-independent-visits.md)).
- [`charts.md`](charts.md) — "What's in range" and the 3D Charts tab.
- [`pathway-pages.md`](pathway-pages.md) — Hormonal Pathways and Lipid
  Transport
  ([ADR-0021](decisions/adr-0021-pathway-pages-share-one-overlay-engine.md),
  [ADR-0022](decisions/adr-0022-illustrative-artwork-and-data-drawn-glyphs-coexist.md)).
- [`medications.md`](medications.md) — the Medications table and its
  storage.
- [`reference-book.md`](reference-book.md) — the Reference Book's pages.
- [`account-and-sync.md`](account-and-sync.md) — auth, Supabase sync,
  Database details, backup and restore, Clear all data
  ([ADR-0018](decisions/adr-0018-firebase-storage-provisional.md),
  [ADR-0019](decisions/adr-0019-self-hosted-supabase-replaces-firebase.md)).

Infrastructure:

- [`share-links-and-deploy.md`](share-links-and-deploy.md) — the Cloudflare
  Worker, the CI deploy and Lighthouse jobs, share links and their meta, and
  why a CI deploy publishes no share links.
- [`testing.md`](testing.md) — the Vitest suites, what is untested, and the
  CI jobs.
- [`sync-architecture-options.md`](sync-architecture-options.md) — a
  reference doc, not an ADR: the cross-device sync / multi-user design-space
  survey behind ADR-0015 → ADR-0019, including options never written up as an
  ADR.
- [`decisions/README.md`](decisions/README.md) — the ADR index
  (`adr-NNNN-<slug>.md`, numbered independently of v2), with a per-ADR row
  and a note on which doc each decision governs. The index is the single
  list — don't duplicate it here.

## Data privacy, in one paragraph

Everything stays client-side by default. The requests the app makes are to
its own origin (`panels.json`, `monitoring-panels.json`, a share link's
payload and meta) and, on explicit opt-in, two others: the "Check online
(NLM)" LOINC lookup, which sends test names — never values — to
clinicaltables.nlm.nih.gov and is the whole of `web/src/data/loincNlm.ts`,
and Supabase auth and sync once the user signs in. The format itself carries
no identity — see [`interchange-format.md#subject`](interchange-format.md#subject).

## Known limitations

Format and round-trip gaps are listed under
[the interchange format](interchange-format.md#known-round-trip-gaps). Every
nav route is code-split, so the entry chunk carries the shell and the
statically imported catalog (`analyses.json`, `laboratories.json`,
`molar-masses.json`) — bundled deliberately, so the catalog cannot arrive
late. A CI deploy publishes no share links
([`share-links-and-deploy.md`](share-links-and-deploy.md#an-automated-deploy-publishes-no-share-links)).

## Common slots

Don't pre-create — extract on first real entry. See
[Section, file, folder](../README.md#section-file-folder).

- **`stack.md`** — the v1 stack: framework, hosting, storage,
  payments, language, etc., with rationale per pick.
- **`architecture.md`** — system overview, data flow, key
  components.

## Open questions

- [TODO: architectural decisions still open.]
