import type { ExploreMarker, ExploreNotTaken, LabExploreModel } from '../../vendor/lab-explore/explore-types';
import { computeIndex, convertUnit, type IndexDef, type IndexReference } from '../../data/computedIndices';
import { convertValue, toLatinUnit, toUcum } from '../../data/unitNormalization';
import { displayedResult } from './ui';
import { INDEX_DEFS } from '../../data/indexDefs';
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
 * already key that way (`seen`, `markers`, `notTaken`, SHORT_NAMES,
 * ALSO_REFS, INDEX_LOINCS), not by short name.
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
 * ExploreMarker/ExploreNotTaken.panel (see explore-types.ts) stays a plain
 * string for the common single-membership case -- only a genuinely shared
 * key takes the array form <lab-explore>'s #buildPicker() fans out across
 * multiple picker groups.
 */
function singleOrArray(values: string[]): string | string[] {
  return values.length === 1 ? values[0]! : values;
}

/**
 * One entry per distinct test (own LOINC + also-refs folded together via
 * testLoincs), keyed by EVERY condition that lists it -- so a test shared by
 * multiple panels (e.g. Albumin, under Hypogonadism, Fatty Liver, Kidney
 * Function AND Bone and Mineral Metabolism) still gets exactly one picker
 * badge/series (no colliding keys), but that one badge groups under all of
 * its panels -- matching PanelsGridView.tsx, which lists the same marker on
 * every one of its panel cards with no dedup at all.
 */
function collectSeenTests(conditions: Condition[]): Map<string, { test: Observation; panels: string[] }> {
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
  return seen;
}

function collectByDate(loincs: string[], allResults: ResultEntry[]): Map<string, ResultEntry> {
  const byDate = new Map<string, ResultEntry>();
  for (const r of allResults) {
    if (r.result.value == null || !loincs.includes(r.loinc)) continue;
    if (!byDate.has(r.date)) byDate.set(r.date, r);
  }
  return byDate;
}

type RefBandOverride = (typeof REF_BAND_OVERRIDES)[string];

type RefBand =
  | { kind: 'band'; refMinRaw: number | null | undefined; refMaxRaw: number; refFromUnit: string | null | undefined }
  | { kind: 'degenerate' }
  | { kind: 'no-upper-bound' };

/**
 * Needs an upper reference bound; use whichever dated reading most recently
 * reported one (labs occasionally revise a printed range). Falls back to a
 * REF_BAND_OVERRIDES entry (see its doc comment) when no dated reading ever
 * printed an upper bound at all; with neither, the marker HAS real dated
 * readings but can never be plotted (lower-bound-only reads inverted once
 * normalized) -- reported as 'no-upper-bound' rather than dropped, so the
 * caller can distinguish it from a genuinely-never-drawn marker.
 */
function resolveRefBand(byDate: Map<string, ResultEntry>, override: RefBandOverride | undefined): RefBand {
  const withRefMax = Array.from(byDate.values())
    .filter((e) => e.result.refMax != null)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (withRefMax.length > 0) {
    const refSource = withRefMax[0]!;
    const refMaxRaw = refSource.result.refMax!;
    const refMinRaw = refSource.result.refMin;
    const refFromUnit = refSource.result.unit;
    if (refMinRaw != null && refMinRaw === refMaxRaw) return { kind: 'degenerate' };
    return { kind: 'band', refMinRaw, refMaxRaw, refFromUnit };
  }
  if (override) {
    return { kind: 'band', refMinRaw: override.refMin, refMaxRaw: override.refMax, refFromUnit: override.rawUnit };
  }
  return { kind: 'no-upper-bound' };
}

/**
 * One reading placed on the series' own scale -- the unit its reference band
 * is expressed in, since the band is what normalization divides by. A test
 * whose history crosses the mass/molar divide (magnesium printed 0.74 mmol/L
 * in one draw and 2.12 mg/dL in the next, urate and total bilirubin likewise)
 * otherwise plots both numbers raw against one mg/dL band, reading as a cliff
 * where the value barely moved.
 *
 * CONVERTED FOR DISPLAY ONLY, NEVER STORED: the number goes into this chart's
 * in-memory series and nowhere else -- the observation, localStorage and every
 * export keep exactly what the lab printed, and a molar unit under a mass code
 * remains a code error to be fixed at the code (ADR-0003), not here. The
 * mass<->molar factor is derived from `molar-masses.json` via the sibling
 * pair, inside convertValue (ADR-0011); nothing here states one.
 *
 * Returns undefined when the reading's unit cannot be placed exactly -- an
 * analyte with no sibling pair, or a unit outside it -- so the caller can drop
 * the point instead of plotting it on the wrong scale.
 */
function placeOnBandScale(
  value: number,
  from: string | null | undefined,
  to: string,
  loinc: string,
  unitMarker: string | undefined
): number | undefined {
  const printed = (from ?? '').trim();
  // Nothing printed makes no competing claim about scale -- same reading
  // ownUnitOf() labels with its own code's expected unit (see ui.ts).
  if (!printed || !to) return value;
  if ((toLatinUnit(printed) ?? printed) === (toLatinUnit(to) ?? to)) return value;
  if (unitMarker) {
    const converted = convertUnit(value, unitMarker, printed, to);
    if (converted !== undefined) return converted;
  }
  const fromUcum = toUcum(printed);
  const toUcumUnit = toUcum(to);
  if (!fromUcum || !toUcumUnit) return undefined;
  return convertValue(value, fromUcum, toUcumUnit, loinc)?.value;
}

/**
 * Builds the ExploreMarker for one test once its reference band is resolved
 * -- unit selection (SI/US override table, else the band's own printed
 * unit, else the catalog default), value conversion, the sorted date
 * series, and (see REF_BAND_OVERRIDES's doc comment) the goodAbove/goodNote
 * pair a curated override band cites in the tooltip.
 *
 * `omitted` names the printed unit of every reading that could not be placed
 * on the band's scale (see placeOnBandScale) -- one entry per dropped reading,
 * so the caller can say so in the picker rather than thin the line in silence.
 */
function buildTestMarker(
  loinc: string,
  test: Observation,
  panel: string | string[],
  byDate: Map<string, ResultEntry>,
  band: Extract<RefBand, { kind: 'band' }>,
  unitSystem: 'si' | 'us',
  override: RefBandOverride | undefined
): { marker: ExploreMarker; data: [string, number][]; omitted: string[] } {
  const { refMinRaw, refMaxRaw, refFromUnit } = band;
  const unitMarker = LOINC_TO_MARKER[loinc];
  // The band is what every reading is normalized against, so its own displayed
  // unit is the series' unit -- never the row primary's, and never an SI/US
  // target the conversion could not actually reach (see displayedResult).
  const bandUnit = displayedResult(unitMarker, { loinc, value: refMaxRaw, rawValue: '', unit: refFromUnit ?? '' }, unitSystem);
  const unit = bandUnit.unit || test.unit || '';
  // The bounds are the scale itself, not points on it: they are already in
  // `unit` by construction, so an unplaceable one keeps its number rather than
  // leaving the marker with no band at all.
  const convert = (value: number, from: string | null | undefined): number =>
    placeOnBandScale(value, from, unit, loinc, unitMarker) ?? value;

  const data: [string, number][] = [];
  const omitted: string[] = [];
  for (const [date, e] of byDate) {
    const placed = placeOnBandScale(e.result.value!, e.result.unit, unit, e.loinc, unitMarker);
    if (placed === undefined) omitted.push((e.result.unit ?? '').trim());
    else data.push([date, placed]);
  }
  data.sort((a, b) => a[0].localeCompare(b[0]));

  const marker: ExploreMarker = {
    label: test.shortName,
    unit,
    refMin: refMinRaw != null ? convert(refMinRaw, refFromUnit) : 0,
    refMax: convert(refMaxRaw, refFromUnit),
    panel,
    data,
    warn: false,
    ...(override
      ? {
          goodAbove: convert(override.refMax, refFromUnit),
          goodNote: `${override.reference.organization} ${override.reference.document}: protective threshold (curated band, not lab-printed)`,
        }
      : {}),
  };

  return { marker, data, omitted };
}

/** "2 readings omitted (mmol/L)" -- the picker chip's suffix for dropped readings. */
function omittedReason(omitted: string[]): string {
  const units = [...new Set(omitted)].filter(Boolean);
  const what = `${omitted.length} reading${omitted.length === 1 ? '' : 's'} omitted`;
  return units.length > 0 ? `${what} (${units.join(', ')})` : what;
}

/**
 * Computed-index markers -- one ExploreMarker per INDEX_DEFS entry, plotting
 * its full historical value series (not just the latest draw). Two shapes,
 * matching the two callers:
 *  - `currentPanel` set (Panel Detail): only that panel's own indices
 *    (INDEX_DEFS filtered by panels.includes(currentPanel)), and `panel` on
 *    the resulting marker stays a plain string (currentPanel).
 *  - `currentPanel` omitted (All Observations): every INDEX_DEFS entry,
 *    each grouped under ALL of its own declared panels (`IndexDef.panels`)
 *    -- same `string | string[]` multi-panel-membership convention the
 *    raw-observation markers use for a test shared by more than one panel
 *    (e.g. `aip` belongs to both 'Insulin Resistance' and 'Cardiovascular
 *    Risk').
 */
function buildIndexMarkers(
  resultsByDate: Record<string, Record<string, Result>>,
  currentPanel: string | undefined
): { markers: Record<string, ExploreMarker>; notTaken: ExploreNotTaken[] } {
  const dates = Object.keys(resultsByDate).sort((a, b) => a.localeCompare(b));
  const defs = currentPanel ? INDEX_DEFS.filter((d) => d.panels.includes(currentPanel)) : INDEX_DEFS;
  const markers: Record<string, ExploreMarker> = {};
  const notTaken: ExploreNotTaken[] = [];

  for (const def of defs) {
    const data: [string, number][] = [];
    for (const date of dates) {
      const value = computeIndex(def, resultsByDate[date]!);
      if (value != null) data.push([date, value]);
    }
    const key = INDEX_MARKER_KEY_PREFIX + def.key;
    const panel: string | string[] = currentPanel ?? singleOrArray(def.panels);
    if (data.length === 0) {
      // Never computable from anything on file (e.g. one of its input markers was
      // never drawn) -- same "not taken" treatment as an observation that was
      // never drawn: named, disabled, not plotted (0 % would misread as a real
      // reading sitting right at the bad boundary).
      notTaken.push({ key, label: def.shortName, panel });
      continue;
    }
    markers[key] = {
      label: def.shortName,
      unit: def.unit,
      ...refBandFor(def),
      panel,
      data,
      warn: false,
    };
  }

  return { markers, notTaken };
}

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
 * ExploreMarker per computed index -- see buildIndexMarkers() for the two
 * shapes, matching the two callers.
 */
export function buildExploreModel(
  conditions: Condition[],
  allResults: ResultEntry[],
  unitSystem: 'si' | 'us',
  currentPanel?: string,
  resultsByDate?: Record<string, Record<string, Result>>
): LabExploreModel {
  const seen = collectSeenTests(conditions);
  const markers: Record<string, ExploreMarker> = {};
  const notTaken: ExploreNotTaken[] = [];
  const defaultSelection: string[] = [];

  for (const [loinc, { test, panels }] of seen) {
    const panel = singleOrArray(panels);
    const byDate = collectByDate(testLoincs(test), allResults);

    // NEVER TAKEN -- no reading at all, so nothing to plot or normalize.
    if (byDate.size === 0) {
      notTaken.push({ key: loinc, label: test.shortName, panel });
      continue;
    }

    const override = REF_BAND_OVERRIDES[loinc];
    const refBand = resolveRefBand(byDate, override);
    if (refBand.kind === 'degenerate') continue;
    if (refBand.kind === 'no-upper-bound') {
      // See resolveRefBand's doc comment -- has real dated readings, but a
      // lower-bound-only range can't be plotted, so it's surfaced as a
      // notTaken chip with a reason (ExploreNotTaken.reason in
      // explore-types.ts) rather than silently dropped.
      notTaken.push({ key: loinc, label: test.shortName, panel, reason: 'no upper bound' });
      continue;
    }

    const { marker, data, omitted } = buildTestMarker(loinc, test, panel, byDate, refBand, unitSystem, override);
    if (data.length === 0) {
      // Every reading was on a scale this series' band cannot be compared
      // against -- real data on file, none of it plottable here, which is the
      // second ExploreNotTaken.reason case, not a never-drawn marker.
      notTaken.push({ key: loinc, label: test.shortName, panel, reason: omittedReason(omitted) });
      continue;
    }
    markers[loinc] = marker;
    // Partly plottable: the line is real but shorter than the history, so the
    // gap is named next to it rather than left to look like a missing draw.
    if (omitted.length > 0)
      notTaken.push({ key: `${loinc}:omitted`, label: test.shortName, panel, reason: omittedReason(omitted) });

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
    if (currentPanel != null && panels.includes(currentPanel) && data.length > 1 && refBand.refMinRaw != null)
      defaultSelection.push(loinc);
  }

  if (resultsByDate) {
    const indexMarkers = buildIndexMarkers(resultsByDate, currentPanel);
    Object.assign(markers, indexMarkers.markers);
    notTaken.push(...indexMarkers.notTaken);
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
