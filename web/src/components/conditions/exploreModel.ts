import type { ExploreMarker, ExploreNotTaken, LabExploreModel } from '../../vendor/lab-explore/explore-types';
import { LOINC_TO_MARKER, computeIndex, convertUnit, indexBands, type IndexDef, type IndexReference, type SubjectProfile } from '../../data/computedIndices';
import { convertValue, toLatinUnit, toUcum } from '../../data/unitNormalization';
import { displayedResult, namedLab } from './resultCells';
import { INDEX_DEFS } from '../../data/indexDefs';
import { INDEX_LOINCS, testLoincs, type Observation } from './markers';
import type { ResultEntry } from './resultsLookup';
import type { Result, UnitSystem } from '../../types';

/** The Monitoring Panels grid model's own shape -- see markers.ts's buildConditions(). */
export type Condition = { name: string; tests: Observation[] };

/** Lets lab-explore's picker split indices from observations without an isIndex field on the vendored types. */
export const INDEX_MARKER_KEY_PREFIX = 'idx:';

/**
 * An index's 'ok' zone is half-open, so the bounded band is [0, good] for
 * lower-is-better (non-negative ratios) and [warn, good] for higher-is-better,
 * keeping "shaded band = the good zone" true on the shared 0-100% axis.
 */
export function refBandFor(def: IndexDef, profile: SubjectProfile = {}): { refMin: number; refMax: number } | null {
  const bands = indexBands(def, profile);
  if (!bands) return null;
  const [good, warn] = bands.cut;
  return bands.hi ? { refMin: warn, refMax: good } : { refMin: 0, refMax: good };
}

/**
 * Curated guideline bands for markers whose lab-printed ranges never carry an
 * upper bound (HDL-C only prints "> 40"): a deliberately tiny table, each entry
 * cited. Such a band is not lab data, so it is surfaced through
 * goodAbove/goodNote rather than `warn`, which means "band not trustworthy".
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

function singleOrArray(values: string[]): string | string[] {
  return values.length === 1 ? values[0]! : values;
}

/** One entry per distinct test, grouped under every panel that lists it. */
function collectSeenTests(conditions: Condition[]): Map<string, { test: Observation; panels: string[] }> {
  const seen = new Map<string, { test: Observation; panels: string[] }>();
  for (const condition of conditions) {
    for (const test of condition.tests) {
      // A lab-reported twin of a computed index stays superseded by the index, as in the grid.
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
 * The most recently printed upper bound wins (labs revise ranges); a
 * lower-bound-only marker is reported, not dropped, so it is not mistaken
 * for one never drawn.
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
 * Places a reading on the unit its band is expressed in, so a history that
 * switched mass/molar scales plots as one line. Converted for display only,
 * never stored (ADR-0003); undefined when the unit cannot be placed exactly,
 * so the caller drops the point rather than plotting it on the wrong scale.
 */
function placeOnBandScale(
  value: number,
  from: string | null | undefined,
  to: string,
  loinc: string,
  unitMarker: string | undefined
): number | undefined {
  const printed = (from ?? '').trim();
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

/** `omitted` names the printed unit of every reading that could not be placed on the band's scale. */
function buildTestMarker(
  loinc: string,
  test: Observation,
  panel: string | string[],
  byDate: Map<string, ResultEntry>,
  band: Extract<RefBand, { kind: 'band' }>,
  unitSystem: UnitSystem,
  override: RefBandOverride | undefined
): { marker: ExploreMarker; data: [string, number, string?][]; omitted: string[] } {
  const { refMinRaw, refMaxRaw, refFromUnit } = band;
  const unitMarker = LOINC_TO_MARKER[loinc];
  // The band is what every reading is normalized against, so its displayed unit is the series' unit.
  const bandUnit = displayedResult(unitMarker, { loinc, value: refMaxRaw, rawValue: '', unit: refFromUnit ?? '' }, unitSystem);
  const unit = bandUnit.unit || test.unit || '';
  // The bounds are already in `unit`, so an unplaceable one keeps its number rather than losing the band.
  const convert = (value: number, from: string | null | undefined): number =>
    placeOnBandScale(value, from, unit, loinc, unitMarker) ?? value;

  const data: [string, number, string?][] = [];
  const omitted: string[] = [];
  for (const [date, e] of byDate) {
    const placed = placeOnBandScale(e.result.value!, e.result.unit, unit, e.loinc, unitMarker);
    if (placed === undefined) omitted.push((e.result.unit ?? '').trim());
    else {
      const lab = namedLab(e.place);
      data.push(lab ? [date, placed, lab] : [date, placed]);
    }
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

/** With `currentPanel` set, only that panel's indices; otherwise every index, grouped under all its panels. */
function buildIndexMarkers(
  resultsByDate: Record<string, Record<string, Result>>,
  currentPanel: string | undefined,
  profile: SubjectProfile
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
      notTaken.push({ key, label: def.shortName, panel });
      continue;
    }
    const band = refBandFor(def, profile);
    if (!band) {
      notTaken.push({ key, label: def.shortName, panel, reason: profile.sex ? 'no range' : 'sex not set' });
      continue;
    }
    markers[key] = {
      label: def.shortName,
      unit: def.unit,
      ...band,
      panel,
      data,
      warn: false,
    };
  }

  return { markers, notTaken };
}

/**
 * Builds the <lab-explore> view-model. Deliberately generic: no event
 * overlays, extra markers or data-quality flagging (every marker is warn: false).
 */
export function buildExploreModel(
  conditions: Condition[],
  allResults: ResultEntry[],
  unitSystem: UnitSystem,
  currentPanel?: string,
  resultsByDate?: Record<string, Record<string, Result>>,
  profile: SubjectProfile = {}
): LabExploreModel {
  const seen = collectSeenTests(conditions);
  const markers: Record<string, ExploreMarker> = {};
  const notTaken: ExploreNotTaken[] = [];
  const defaultSelection: string[] = [];

  for (const [loinc, { test, panels }] of seen) {
    const panel = singleOrArray(panels);
    const byDate = collectByDate(testLoincs(test), allResults);

    if (byDate.size === 0) {
      notTaken.push({ key: loinc, label: test.shortName, panel });
      continue;
    }

    const override = REF_BAND_OVERRIDES[loinc];
    const refBand = resolveRefBand(byDate, override);
    if (refBand.kind === 'degenerate') continue;
    if (refBand.kind === 'no-upper-bound') {
      notTaken.push({ key: loinc, label: test.shortName, panel, reason: 'no upper bound' });
      continue;
    }

    const { marker, data, omitted } = buildTestMarker(loinc, test, panel, byDate, refBand, unitSystem, override);
    if (data.length === 0) {
      notTaken.push({ key: loinc, label: test.shortName, panel, reason: omittedReason(omitted) });
      continue;
    }
    markers[loinc] = marker;
    // Partly plottable: the gap is named rather than left to look like a missing draw.
    if (omitted.length > 0)
      notTaken.push({ key: `${loinc}:omitted`, label: test.shortName, panel, reason: omittedReason(omitted) });

    // Default selection: the current panel's own two-sided-range markers with more than one reading.
    if (currentPanel != null && panels.includes(currentPanel) && data.length > 1 && refBand.refMinRaw != null)
      defaultSelection.push(loinc);
  }

  if (resultsByDate) {
    const indexMarkers = buildIndexMarkers(resultsByDate, currentPanel, profile);
    Object.assign(markers, indexMarkers.markers);
    notTaken.push(...indexMarkers.notTaken);
  }

  return {
    markers,
    notTaken,
    defaultSelection,
    title: "What's in range, what isn't",
  };
}
