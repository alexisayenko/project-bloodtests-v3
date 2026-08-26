import type { ExploreMarker, ExploreNotTaken, LabExploreModel } from '../../vendor/lab-explore/explore-types';
import { SI_US_UNIT, toUnit } from '../../data/computedIndices';
import { LOINC_TO_MARKER, testLoincs, type Observation } from './markers';
import type { ResultEntry } from './resultsLookup';

/** The Monitoring Panels grid model's own shape -- see markers.ts's buildConditions(). */
export type Condition = { name: string; tests: Observation[] };

/**
 * Builds the <lab-explore> view-model ("What's in range, what isn't" tab)
 * from v3's own data shapes -- a fresh, generic port of v2's
 * exploreFromLabs() eligibility logic (ui/src/explore-model.ts) against
 * Condition[]/ResultEntry[] instead of a LabMatrixModel.
 *
 * Deliberately NOT ported: event overlays, extraMarkers, band overrides, or
 * warn/data-quality flagging -- every marker built here is warn: false.
 */
export function buildExploreModel(
  conditions: Condition[],
  allResults: ResultEntry[],
  unitSystem: 'si' | 'us',
  currentPanel?: string
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

  return {
    markers,
    notTaken,
    defaultSelection,
    // The view's own name -- see explore-types.ts's LabExploreModel.title doc
    // comment for why this specific phrasing is a deliberate product choice.
    title: "What's in range, what isn't",
  };
}
