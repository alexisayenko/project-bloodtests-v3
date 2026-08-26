import type { ExploreMarker, ExploreNotTaken, LabExploreModel } from '../../vendor/lab-explore/explore-types';
import { INDEX_DEFS, SI_US_UNIT, computeIndex, toUnit, type IndexDef } from '../../data/computedIndices';
import { LOINC_TO_MARKER, testLoincs, type Observation } from './markers';
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
 * Builds the <lab-explore> view-model ("What's in range, what isn't" tab)
 * from v3's own data shapes -- a fresh, generic port of v2's
 * exploreFromLabs() eligibility logic (ui/src/explore-model.ts) against
 * Condition[]/ResultEntry[] instead of a LabMatrixModel.
 *
 * Deliberately NOT ported: event overlays, extraMarkers, band overrides, or
 * warn/data-quality flagging -- every marker built here is warn: false.
 *
 * `resultsByDate` is optional and, when present together with `currentPanel`,
 * additionally builds one ExploreMarker per computed index belonging to that
 * panel (INDEX_DEFS filtered by panels.includes(currentPanel)) -- their full
 * historical value series, not just the latest draw. This is deliberately
 * scoped to the single-panel Panel Detail context: the cross-panel All
 * Observations view calls this without `resultsByDate`, so it never gets
 * index markers.
 */
export function buildExploreModel(
  conditions: Condition[],
  allResults: ResultEntry[],
  unitSystem: 'si' | 'us',
  currentPanel?: string,
  resultsByDate?: Record<string, Record<string, Result>>
): LabExploreModel {
  // One entry per distinct test (own LOINC + also-refs folded together via
  // testLoincs), keyed by whichever condition lists it FIRST -- so a test
  // shared by two panels (e.g. Albumin, under both Hypogonadism and Kidney
  // Function) still gets exactly one picker badge instead of colliding keys.
  const seen = new Map<string, { test: Observation; panel: string }>();
  for (const condition of conditions) {
    for (const test of condition.tests) {
      if (!seen.has(test.loinc)) seen.set(test.loinc, { test, panel: condition.name });
    }
  }

  const markers: Record<string, ExploreMarker> = {};
  const notTaken: ExploreNotTaken[] = [];
  const defaultSelection: string[] = [];

  for (const [loinc, { test, panel }] of seen) {
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
    // Lower-bound-only (or no reference at all) reads inverted once
    // normalized -- excluded entirely, per v2's documented behavior.
    if (withRefMax.length === 0) continue;

    const refSource = withRefMax[0]!;
    const refMaxRaw = refSource.result.refMax!;
    const refMinRaw = refSource.result.refMin;
    if (refMinRaw != null && refMinRaw === refMaxRaw) continue; // degenerate range

    const marker = LOINC_TO_MARKER[loinc];
    const siUsUnit = marker ? SI_US_UNIT[marker] : undefined;
    const unit = siUsUnit ? siUsUnit[unitSystem] : refSource.result.unit || test.unit || '';
    const convert = (value: number, from: string | null | undefined): number =>
      siUsUnit && marker ? toUnit(value, marker, from, unit) : value;

    const data: [string, number][] = Array.from(byDate.entries())
      .map(([date, e]): [string, number] => [date, convert(e.result.value!, e.result.unit)])
      .sort((a, b) => a[0].localeCompare(b[0]));

    markers[loinc] = {
      label: test.short,
      unit,
      refMin: refMinRaw != null ? convert(refMinRaw, refSource.result.unit) : 0,
      refMax: convert(refMaxRaw, refSource.result.unit),
      panel,
      data,
      warn: false,
    };

    // Default selection: the current panel's own two-sided-range markers
    // with more than one reading -- mirrors v2's defaultPanel option. When
    // currentPanel is omitted (no single-panel context, e.g. the cross-panel
    // All Observations view) this never matches, so defaultSelection stays
    // empty and the reader picks markers herself -- matches v2's own
    // exploreFromLabs() behavior when defaultPanel isn't set.
    if (panel === currentPanel && data.length > 1 && refMinRaw != null) defaultSelection.push(loinc);
  }

  // Computed indices -- Panel Detail context only (see the doc comment above).
  if (currentPanel && resultsByDate) {
    const dates = Object.keys(resultsByDate).sort();
    for (const def of INDEX_DEFS.filter((d) => d.panels.includes(currentPanel))) {
      const data: [string, number][] = [];
      for (const date of dates) {
        const value = computeIndex(def, resultsByDate[date]!);
        if (value != null) data.push([date, value]);
      }
      const key = INDEX_MARKER_KEY_PREFIX + def.key;
      if (data.length === 0) {
        // Never computable from anything on file (e.g. one of its input markers was
        // never drawn) -- same "not taken" treatment as an observation that was
        // never drawn: named, disabled, not plotted (0 % would misread as a real
        // reading sitting right at the bad boundary).
        notTaken.push({ key, label: def.nameCompact, panel: currentPanel });
        continue;
      }
      markers[key] = {
        label: def.nameCompact,
        unit: def.unit,
        ...refBandFor(def),
        panel: currentPanel,
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
