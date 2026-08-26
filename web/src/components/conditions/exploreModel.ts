import type { ExploreMarker, ExploreNotTaken, LabExploreModel } from '../../vendor/lab-explore/explore-types';
import { INDEX_DEFS, SI_US_UNIT, computeIndex, toUnit, type IndexDef, type IndexReference } from '../../data/computedIndices';
import { INDEX_LOINCS, LOINC_TO_MARKER, testLoincs, type Observation } from './markers';
import type { ResultEntry } from './resultsLookup';
import type { Result } from '../../types';

/** The Monitoring Panels grid model's own shape -- see markers.ts's buildConditions(). */
export type Condition = { name: string; tests: Observation[] };

/**
 * Every computed-index marker's key carries this prefix, purely so
 * lab-explore.ts's #buildPicker() can split the single-panel (Panel Detail)
 * picker into an observations row and an indices row without adding an
 * isIndex field to the vendored ExploreMarker/ExploreNotTaken types -- see
 * the matching comment on #buildPicker()'s isIndexKey().
 */
export const INDEX_MARKER_KEY_PREFIX = 'idx:';

/**
 * Maps an index's [good, warn] cut-points (IndexDef.cut) onto the
 * [refMin, refMax] band <lab-explore> shades as "0-100% = in range" -- the
 * SAME visual promise every raw observation marker already makes on this
 * chart. An index's 'ok' zone (per zone() in computedIndices.ts) is
 * HALF-OPEN -- unbounded on one side -- so it can't be used directly as a
 * bounded band; this picks the bound that keeps "shaded band = the good
 * zone" true, not just plausible.
 *
 *  - hi=false (lower is better, e.g. TC/HDL, HOMA-IR, AIP): 'ok' is
 *    value < good, unbounded below. These are all non-negative ratios/
 *    scores, so 0 is a real floor -- [0, good] puts exactly the 'ok' zone
 *    inside 0-100%, and warn/bad values read at/above 100%, same as an
 *    out-of-range raw observation.
 *  - hi=true (higher is better, e.g. T/LH, HOMA-%B): 'ok' is value >= good,
 *    unbounded above. [warn, good] puts 0% at the bad/warn boundary and
 *    100% AT the good threshold, so a value that has just reached 'ok'
 *    reads at (not still climbing toward) the edge of the shaded band.
 *    Readings further into the ok zone climb past 100% -- expected and
 *    fine: that direction is this index doing even better, not a second
 *    kind of out-of-range to guard against.
 */
export function refBandFor(def: IndexDef): { refMin: number; refMax: number } {
  const [good, warn] = def.cut;
  return def.hi ? { refMin: warn, refMax: good } : { refMin: 0, refMax: good };
}

/**
 * Curated reference bands for a marker whose real dated readings never
 * print an upper bound at all (see the `withRefMax.length === 0` branch a
 * few lines into the loop below), but a real clinical guideline supplies
 * one anyway. Deliberately a TINY, hand-curated table -- NOT a general
 * analyte-catalog port (v2's full catalog was explicitly scoped out of this
 * change) -- add another entry here only if a genuinely similar real-data
 * case shows up, each with its own real citation in the SAME
 * `IndexReference` shape/style computedIndices.ts's INDEX_DEFS already uses
 * (see e.g. its `nonhdl` entry, which cites the same NCEP document for a
 * different index).
 *
 * Keyed by LOINC -- matching every other lookup this file and markers.ts
 * already key that way (`seen`, `markers`, `notTaken`, SHORT_LABELS,
 * ALSO_REFS, INDEX_LOINCS), not by short display name.
 *
 * HDL-C (LOINC 2085-9): every dated reading on file only ever prints
 * "> 35"/"> 40 mg/dL" -- a lower bound only, since higher HDL is protective
 * and labs commonly omit an upper limit entirely, which is exactly what
 * routes it into the "no upper bound" branch below. NCEP ATP III's Third
 * Report (JAMA 2001;285(19):2486-2497, PMID 11368702 -- the SAME document
 * `nonhdl` above already cites) sets HDL-C <40 mg/dL as a major CHD risk
 * factor and HDL-C >=60 mg/dL as a "negative" risk factor whose presence
 * removes one risk factor from the total count -- its own Table 2, "Major
 * Risk Factors That Modify LDL Goals". [40, 60] mg/dL is used here as a
 * normal band to plot HDL-C against. VERIFIED against a direct quote of
 * that table (JAMA's own full text is paywalled, so this was cross-checked
 * against a secondary review that quotes Table 2 verbatim): Am Fam
 * Physician. 2002;65(5):871-880, https://www.aafp.org/pubs/afp/issues/2002/0301/p871.html
 * -- "Low HDL cholesterol (<40 mg per dL [1.05 mmol per L])" (listed as a
 * positive risk factor) / "High HDL cholesterol (> 60 mg per dL
 * [1.55 mmol per L]); presence of this risk factor removes one risk factor
 * from the total count" (both from ATP III's own Table 2).
 *
 * HONESTY: unlike every other marker's band, THIS ONE WAS NEVER PRINTED BY
 * A LAB for this patient -- it is a substituted guideline threshold, not
 * lab data. Deliberately NOT surfaced via ExploreMarker.warn: that flag
 * means "the band itself is not trustworthy" (unsourced, or written for the
 * other sex, or a bad assay) -- the opposite of the case here, where the
 * band is well-sourced, just not what this specific lab printed. The label
 * stays the plain marker name (no visible caveat -- per product decision);
 * `goodAbove`/`goodNote` (see ExploreMarker, already designed for exactly
 * this "HDL-C >= 60" case) still cite the NCEP threshold and note the band
 * is curated, surfaced in the tooltip once a reading reaches it.
 */
const REF_BAND_OVERRIDES: Record<
  string,
  { refMin: number; refMax: number; rawUnit: string; reference: IndexReference }
> = {
  '2085-9': {
    refMin: 40,
    refMax: 60,
    rawUnit: 'mg/dL',
    reference: {
      organization: 'National Cholesterol Education Program (NCEP) Expert Panel',
      document: 'Third Report (ATP III), JAMA -- Table 2, "Major Risk Factors That Modify LDL Goals"',
      year: 2001,
      url: 'https://pubmed.ncbi.nlm.nih.gov/11368702/',
      doi: '10.1001/jama.285.19.2486',
      quote:
        'HDL-C <40 mg/dL is a major CHD risk factor; HDL-C >=60 mg/dL is a "negative" risk factor whose presence removes one risk factor from the total count. Verified via Am Fam Physician. 2002;65(5):871-880 (https://www.aafp.org/pubs/afp/issues/2002/0301/p871.html), which quotes ATP III\'s own Table 2 verbatim: "Low HDL cholesterol (<40 mg per dL [1.05 mmol per L])" / "High HDL cholesterol (> 60 mg per dL [1.55 mmol per L]); presence of this risk factor removes one risk factor from the total count."',
    },
  },
};

/**
 * Builds the <lab-explore> view-model ("What's in range, what isn't" tab)
 * from v3's own data shapes -- a fresh, generic port of v2's
 * exploreFromLabs() eligibility logic (ui/src/explore-model.ts) against
 * Condition[]/ResultEntry[] instead of a LabMatrixModel.
 *
 * Deliberately NOT ported: event overlays, extraMarkers, band overrides, or
 * warn/data-quality flagging -- every marker built here is warn: false.
 *
 * `resultsByDate` is optional and, when present, additionally builds one
 * ExploreMarker per computed index -- their full historical value series, not
 * just the latest draw. Two shapes, matching the two callers:
 *  - `resultsByDate` + `currentPanel` (Panel Detail): only that panel's own
 *    indices (INDEX_DEFS filtered by panels.includes(currentPanel)), and
 *    `panel` on the resulting marker stays a plain string (currentPanel) --
 *    unchanged from before this got a second caller.
 *  - `resultsByDate` alone, no `currentPanel` (All Observations): every
 *    INDEX_DEFS entry, each grouped under ALL of its own declared panels
 *    (`IndexDef.panels`) -- same `string | string[]` multi-panel-membership
 *    convention the raw-observation markers above already use for a test
 *    shared by more than one panel (e.g. `aip` belongs to both 'Insulin
 *    Resistance' and 'Cardiovascular Risk').
 */
export function buildExploreModel(
  conditions: Condition[],
  allResults: ResultEntry[],
  unitSystem: 'si' | 'us',
  currentPanel?: string,
  resultsByDate?: Record<string, Record<string, Result>>
): LabExploreModel {
  // One entry per distinct test (own LOINC + also-refs folded together via
  // testLoincs), keyed by EVERY condition that lists it -- so a test shared
  // by multiple panels (e.g. Albumin, under Hypogonadism, Fatty Liver,
  // Kidney Function AND Bone and Mineral Metabolism) still gets exactly one
  // picker badge/series (no colliding keys), but that one badge groups under
  // all of its panels -- matching PanelsGridView.tsx, which lists the same
  // marker on every one of its panel cards with no dedup at all.
  const seen = new Map<string, { test: Observation; panels: string[] }>();
  for (const condition of conditions) {
    for (const test of condition.tests) {
      // A LOINC a computed index can independently duplicate from a lab
      // report (see markers.ts's INDEX_LOINCS, e.g. TC/HDL's own 9830-1)
      // stays superseded by its computed twin here too -- same exclusion
      // PanelsGridView.tsx/PanelDetailView.tsx already apply to the raw
      // observation grid, so the picker doesn't grow a duplicate "TC/HDL"
      // badge alongside the real (idx:tchdl) one.
      if (INDEX_LOINCS.has(test.loinc)) continue;
      const existing = seen.get(test.loinc);
      if (existing) {
        if (!existing.panels.includes(condition.name)) existing.panels.push(condition.name);
      } else {
        seen.set(test.loinc, { test, panels: [condition.name] });
      }
    }
  }

  const markers: Record<string, ExploreMarker> = {};
  const notTaken: ExploreNotTaken[] = [];
  const defaultSelection: string[] = [];

  for (const [loinc, { test, panels }] of seen) {
    // ExploreMarker/ExploreNotTaken.panel (see explore-types.ts) stays a
    // plain string for the common single-panel case -- only a genuinely
    // shared LOINC takes the array form <lab-explore>'s #buildPicker() fans
    // out across multiple picker groups.
    const panel: string | string[] = panels.length === 1 ? panels[0]! : panels;
    const loincs = testLoincs(test);
    const byDate = new Map<string, ResultEntry>();
    for (const r of allResults) {
      if (r.result.value == null || !loincs.includes(r.loinc)) continue;
      if (!byDate.has(r.date)) byDate.set(r.date, r);
    }

    // NEVER TAKEN -- no reading at all, so nothing to plot or normalize.
    if (byDate.size === 0) {
      notTaken.push({ key: loinc, label: test.short, panel });
      continue;
    }

    // Needs an upper reference bound; use whichever dated reading most
    // recently reported one (labs occasionally revise a printed range).
    const withRefMax = Array.from(byDate.values())
      .filter((e) => e.result.refMax != null)
      .sort((a, b) => b.date.localeCompare(a.date));

    let refMinRaw: number | null | undefined;
    let refMaxRaw: number | undefined;
    let refFromUnit: string | null | undefined;
    const override = REF_BAND_OVERRIDES[loinc];

    if (withRefMax.length > 0) {
      const refSource = withRefMax[0]!;
      refMaxRaw = refSource.result.refMax!;
      refMinRaw = refSource.result.refMin;
      refFromUnit = refSource.result.unit;
      if (refMinRaw != null && refMinRaw === refMaxRaw) continue; // degenerate range
    } else if (override) {
      // See REF_BAND_OVERRIDES's doc comment: a real, cited guideline band
      // stands in for the upper bound this marker's own lab readings never
      // print, instead of the notTaken/'no upper bound' fallback below.
      refMinRaw = override.refMin;
      refMaxRaw = override.refMax;
      refFromUnit = override.rawUnit;
    } else {
      // Lower-bound-only (or no reference at all) reads inverted once
      // normalized, so it can never be PLOTTED -- excluded from the series,
      // per v2's documented behavior (e.g. HDL-C, which real labs commonly
      // print as "> 40 mg/dL" with no upper limit at all, since higher HDL is
      // protective). But this marker HAS real dated readings on file -- it is
      // not the "never taken" case above -- so dropping it outright would
      // silently say "this marker does not exist", which is false. Surfaced
      // instead as a notTaken chip with a reason (see ExploreNotTaken.reason
      // in explore-types.ts), distinguishable from a genuinely-never-drawn one.
      notTaken.push({ key: loinc, label: test.short, panel, reason: 'no upper bound' });
      continue;
    }

    const marker = LOINC_TO_MARKER[loinc];
    const siUsUnit = marker ? SI_US_UNIT[marker] : undefined;
    const unit = siUsUnit ? siUsUnit[unitSystem] : refFromUnit || test.unit || '';
    const convert = (value: number, from: string | null | undefined): number =>
      siUsUnit && marker ? toUnit(value, marker, from, unit) : value;

    const data: [string, number][] = Array.from(byDate.entries())
      .map(([date, e]): [string, number] => [date, convert(e.result.value!, e.result.unit)])
      .sort((a, b) => a[0].localeCompare(b[0]));

    markers[loinc] = {
      label: test.short,
      unit,
      refMin: refMinRaw != null ? convert(refMinRaw, refFromUnit) : 0,
      refMax: convert(refMaxRaw, refFromUnit),
      panel,
      data,
      warn: false,
      // goodAbove/goodNote (ExploreMarker) were already designed for exactly
      // this case -- see explore-types.ts's "e.g. HDL-C >= 60" doc comment --
      // so a reading at/above the override's own top-of-band cites the NCEP
      // threshold directly in the tooltip.
      ...(override
        ? {
            goodAbove: convert(override.refMax, refFromUnit),
            goodNote: `${override.reference.organization} ${override.reference.document}: protective threshold (curated band, not lab-printed)`,
          }
        : {}),
    };

    // Default selection: the current panel's own two-sided-range markers
    // with more than one reading -- mirrors v2's defaultPanel option. When
    // currentPanel is omitted (no single-panel context, e.g. the cross-panel
    // All Observations view) this never matches, so defaultSelection stays
    // empty and the reader picks markers herself -- matches v2's own
    // exploreFromLabs() behavior when defaultPanel isn't set. Checks
    // membership (not equality) against `panels` so a marker shared with the
    // current panel still defaults on even when it also belongs elsewhere --
    // in practice Panel Detail only ever passes one Condition, so `panels`
    // here is always exactly [currentPanel] or doesn't include it at all.
    if (currentPanel != null && panels.includes(currentPanel) && data.length > 1 && refMinRaw != null)
      defaultSelection.push(loinc);
  }

  // Computed indices -- see the doc comment above for the two shapes.
  if (resultsByDate) {
    const dates = Object.keys(resultsByDate).sort();
    const defs = currentPanel ? INDEX_DEFS.filter((d) => d.panels.includes(currentPanel)) : INDEX_DEFS;
    for (const def of defs) {
      const data: [string, number][] = [];
      for (const date of dates) {
        const value = computeIndex(def, resultsByDate[date]!);
        if (value != null) data.push([date, value]);
      }
      const key = INDEX_MARKER_KEY_PREFIX + def.key;
      // Single-panel context keeps the plain-string `panel` it always had;
      // the multi-panel (All Observations) context fans an index out across
      // ALL of its declared panels, same convention as `panel` above.
      const panel: string | string[] = currentPanel ?? (def.panels.length === 1 ? def.panels[0]! : def.panels);
      if (data.length === 0) {
        // Never computable from anything on file (e.g. one of its input markers was
        // never drawn) -- same "not taken" treatment as an observation that was
        // never drawn: named, disabled, not plotted (0 % would misread as a real
        // reading sitting right at the bad boundary).
        notTaken.push({ key, label: def.nameCompact, panel });
        continue;
      }
      markers[key] = {
        label: def.nameCompact,
        unit: def.unit,
        ...refBandFor(def),
        panel,
        data,
        warn: false,
      };
    }
  }

  return {
    markers,
    notTaken,
    defaultSelection,
    // The view's own name -- see explore-types.ts's LabExploreModel.title doc
    // comment for why this specific phrasing is a deliberate product choice.
    title: "What's in range, what isn't",
  };
}
