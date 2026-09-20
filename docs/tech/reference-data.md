# Reference data

Every fact the app knows about analytes, panels, molar masses, laboratories
and pathways is data under `web/public/data/`, described by a closed-object
JSON Schema under `web/public/schema/` and validated with ajv in
`web/test/reference-data.test.ts`. None of it is mirrored in TypeScript
([ADR-0010](decisions/adr-0010-analyte-catalog-is-the-source-of-truth.md),
[ADR-0011](decisions/adr-0011-molar-masses-are-data-factors-are-derived.md)):
a module imports the file and derives its lookups at load, so nothing can
drift. Because the schemas are closed, a mistyped key fails the suite.

## The files

| File | Schema | Loader |
| --- | --- | --- |
| `analyses.json` — the analyte catalog | `analytes-1.schema.json` | `web/src/data/analyteCatalog.ts` |
| `panels.json` — laboratory groups | `analytes-1.schema.json` | `web/src/data/DataContext.tsx` (fetched at load) |
| `monitoring-panels.json` — Monitoring Panels | `analytes-1.schema.json` | `DataContext.tsx` (fetched at load); resolved by `markers.ts`'s `buildConditions` |
| `molar-masses.json` | `molar-masses-1.schema.json` | `web/src/data/molarMasses.ts` |
| `laboratories.json` — the laboratory registry | `laboratories-1.schema.json` | `web/src/data/labPricing.ts` |
| `martin-hopkins-ldl-table.json` | `martin-hopkins-ldl-table-1.schema.json` | `web/src/data/martinHopkinsLdl.ts` |
| `pathway-reference-ranges.json` | `pathway-reference-ranges-1.schema.json` | `web/src/data/pathwayReferenceRanges.ts` |
| `pathway-receptor-effects.json` | `pathway-receptor-effects-1.schema.json` | `web/src/data/pathwayReceptorEffects.ts` |
| `lipoprotein-particles.json` | `lipoprotein-particles-1.schema.json` | `web/src/data/lipoproteinParticles.ts` |

`analyses.json`, `laboratories.json` and `molar-masses.json` are imported
statically and ship in the entry bundle; `panels.json` and
`monitoring-panels.json` are fetched from the app's own origin at load, so a
panel edit needs no rebuild. The interchange envelope's own schema,
`bloodtests-3.schema.json`, is a separate concern — see
[`interchange-format.md`](interchange-format.md) — and
`medications-1.schema.json` is documentation-only, see
[`medications.md`](medications.md).

## Analyte catalog (`analyses.json`)

One entry per LOINC code, carrying its names — `friendlyName`, the clinical
name the UI shows, and `longCommonName`, the "LOINC name" — translations
(`lang`) and popup prose, plus `shortName` (our badge abbreviation, not
LOINC's SHORTNAME), `unit` (the expected unit), `allowedUnits`, and
`aliasOf` / `aliasLabel` on a unit or method variant of another code. Unit
spellings use the app's canonical Latin form (`ug/…`, never `mcg/…` or `µg`),
which is what `molarMasses.ts`'s `concentrationScale` can parse a prefix out
of.
`allowedUnits` holds same-dimension variants only. A legacy printed label that
means the code's own unit goes in the optional `printedUnitAliases` map
(`{"%": "g/dL"}` on MCHC `786-4`): normalization resolves that printed unit to
the map's value for this code alone, `rawUnit` keeps the print, and no
warning is raised
([ADR-0028](decisions/adr-0028-mchc-printed-percent-alias.md)).

`analyteCatalog.ts` derives every lookup from it at load: `SHORT_NAMES`,
`DEFAULT_UNITS`, `ALLOWED_UNITS`, the reverse alias maps `ALSO_REFS` /
`ALIAS_TO_PRIMARY`, and the LOINC-property sets `propertyOf` /
`U_IU_FOLD_REASON` that decide when `U` and `IU` are one unit
([`units.md`](units.md)). Molar variants of mass-concentration codes are
catalog entries with `aliasOf` pointing at the mass primary, so a molar code
folds into the same panel row, short name and chart series with no change to
panels, tables or charts. The catalog consistency checks in
`reference-data.test.ts`: no duplicate LOINC, every `aliasOf` resolving, every
`shortName` carrying a unit.

Product-level definitions: the [observation](../product/concepts/observation.md)
concept, whose "Names" glossary defines every name the app uses.

## Panels (`panels.json`, `monitoring-panels.json`)

Two layers. `panels.json` holds the laboratory groups — how a lab orders and
prints a set. `monitoring-panels.json` holds the product's Monitoring Panels
composed over them: `panelId` / `panelIds` / `loincs`, then `excludeLoincs` /
`extraLoincs`, with array order as render order. `buildConditions`
(`web/src/components/conditions/markers.ts`) is the resolver; it maps LOINCs
one-to-one and does not fold aliases, so Insulin Resistance still excludes
HbA1c's IFCC code `59261-8` despite its `aliasOf`. Per-panel icon and tint
come from `panelMeta.ts`. See the
[monitoring panel](../product/concepts/monitoring-panel.md) concept and
[`monitoring-panels.md`](monitoring-panels.md) for the views.

## Molar masses (`molar-masses.json`)

The single source of truth for mass↔molar arithmetic. It stores molar masses,
never conversion factors: per analyte the molecular formula the
`molarMassGPerMol` is computed from, a `basis` of `compound` / `element` /
`conventional`, and retrieved citations (PubChem CID, or CIAAW for an element)
carrying the source's own mass as a cross-check, alongside the CIAAW 2021
standard atomic weights the file also tabulates. `molarMasses.ts` scales one
mass into the factor a given unit pair needs (`massPerMolarUnit` /
`molarPerMassUnit`), so `massMolarSiblings.ts` and `computedIndices.ts` derive
every factor they use instead of typing one. The pairs themselves are declared
once, in `computedIndices.ts`'s exported `INDEX_UNIT_PAIRS`, which the
Reference Book reads rather than restating. The test recomputes each mass from
its formula and holds it to its sources within 0.05%, and checks every sibling
pair names a tabulated entry. Detail: [`molar-masses.md`](molar-masses.md).

## Laboratories (`laboratories.json`)

The laboratory registry: per laboratory a locale, currency, `pricesAsOf` and
price lines. Each line `covers` one or more LOINCs (so a bundle prices
several), carries `label` (the lab's own product name, as given) and may
carry `innerId` (the lab's internal SKU) and `url` (the analysis on the lab's
own site). `labPricing.ts`'s `quoteSchedule` folds a schedule to primary
codes, picks each code's cheapest covering line, charges a line once however
many codes it covers, and names what no line covers. The mapping reasoning is
in [`../content/laboratory-prices.md`](../content/laboratory-prices.md); the
consumers are in [`scheduling-and-visits.md`](scheduling-and-visits.md).

## Martin-Hopkins table

`martin-hopkins-ldl-table.json` is the adjustable-divisor table (triglyceride
strata × non-HDL-C strata) the `ldlmh` index looks up instead of Friedewald's
fixed TG÷5; the test checks its internal consistency. See
[`computed-indices.md`](computed-indices.md).

## Pathway data

- `pathway-reference-ranges.json` — curated ranges shown on the pathway
  pages when a reading has no lab-printed range, every figure as its source
  printed it and converted for display only (`rangesInUnit` / `rangeStatus`
  / `convertConcentration`). Tested: every source cited and every citation
  resolving, codes catalogued, molar masses tabulated, each population placing
  on a catalog unit.
- `pathway-receptor-effects.json` — what each receptor's activation does in
  adult men, each effect citing at least one retrieved source with short
  verbatim `quotes` (`receptorById` / `numberedEffects`). Tested: both
  receptor nodes covered, every effect cites, every citation resolves, every
  source cited, every quote under 25 words.
- `lipoprotein-particles.json` — each particle's diameter, density,
  structural apoproteins and mass-share composition as its source printed
  it. Tested: transport order, every figure citing a known source and every
  source cited, quotes under 25 words, intervals ordered, shares never over
  100%, every structural apoprotein one its source lists. The page draws
  cargo as circle counts, not from these shares — see
  [`pathway-pages.md`](pathway-pages.md) and
  [ADR-0022](decisions/adr-0022-illustrative-artwork-and-data-drawn-glyphs-coexist.md).
