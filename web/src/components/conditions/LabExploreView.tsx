import { useEffect, useMemo, useRef, useState } from 'react';
import { LabExplore } from '../../vendor/lab-explore/lab-explore';
import type { LabExploreModel } from '../../vendor/lab-explore/explore-types';
import { buildExploreModel, type Condition } from './exploreModel';
import type { ResultEntry } from './resultsLookup';
import type { Result } from '../../types';
import type { MedicationRow } from '../../data/medications';
import { loadEnvelopeMeta } from '../../data/envelopeMeta';
import { SegmentedControl } from '../primitives';
import { MedicationLane } from './MedicationLane';
import { buildMedicationBars } from './medicationBars';
import { PALETTE } from '../analytics/palette';

function paletteColor(index: number): string {
  const [r, g, b] = PALETTE[index % PALETTE.length]!;
  return `rgb(${r}, ${g}, ${b})`;
}

// lab-explore.ts (vendored from project-bloodtests-v2) exports the class but
// doesn't register it itself -- guard against double-registration on hot
// reload, matching the homepage's own defineLabExplore() pattern.
if (typeof customElements !== 'undefined' && !customElements.get('lab-explore')) {
  customElements.define('lab-explore', LabExplore);
}

type LabExploreElement = HTMLElement & { model: LabExploreModel | null };

/** Wires the vendored <lab-explore> custom element into a panel's "What's in range" tab. */
export function LabExploreView({
  conditions,
  allResults,
  unitSystem,
  currentPanel,
  resultsByDate,
  medications,
}: Readonly<{
  conditions: Condition[];
  allResults: ResultEntry[];
  unitSystem: 'si' | 'us';
  /** Panel to pre-select markers from; omit for no default-panel bias (e.g. the cross-panel All Observations view). */
  currentPanel?: string;
  /**
   * Per-date observation lookup, needed to compute any computed index's full
   * historical series. With `currentPanel` (Panel Detail): only that panel's
   * indices. Without it (All Observations): every index, grouped under all of
   * its own declared panels -- see buildExploreModel's doc comment. Omit
   * entirely to keep a view scoped to raw observations only.
   */
  resultsByDate?: Record<string, Record<string, Result>>;
  /** Medication history for the lane under the chart (task-0053); omit or empty for no lane at all. */
  medications?: MedicationRow[];
}>) {
  const ref = useRef<HTMLElement | null>(null);
  const sex = loadEnvelopeMeta().sex;
  // Session-only, like the chart's own zoom/panel-picker state -- not a stored
  // view setting (task-0052's first pass).
  const [normalized, setNormalized] = useState(true);
  const model = useMemo(() => {
    const built = buildExploreModel(conditions, allResults, unitSystem, currentPanel, resultsByDate, { sex });
    // v3 DEVIATION from the v2 source: v2 mounted exactly one <lab-explore>
    // instance (the homepage's Explore section), so the component's default
    // localStorage keys ("exploreSel" etc.) were safe to share -- there was
    // only ever one view to persist. v3 mounts one instance per panel's
    // "What's in range" tab plus a separate All Observations instance, all
    // still pointed at those same unscoped defaults unless told otherwise.
    // Left unscoped, selecting markers on one panel's chart persists under
    // the SAME key every other panel's chart reads on load; the persisted
    // (now-irrelevant) selection wins over that panel's own defaultSelection
    // even after it's filtered down to nothing (see the persisted -> default
    // fallback in lab-explore.ts's #render()), so a fresh panel can render
    // with an empty chart and no badges selected. Scoping every persisted key
    // to this view keeps panels -- and the All Observations view -- independent.
    const viewId = currentPanel ?? "all";
    return {
      ...built,
      normalized,
      persist: {
        sel: `exploreSel:${viewId}`,
        view: `hpgChartView:${viewId}`,
        autoscale: `hpgAutoscale:${viewId}`,
        evPrefix: `exploreEv:${viewId}:`,
      },
    };
  }, [conditions, allResults, unitSystem, currentPanel, resultsByDate, sex, normalized]);

  useEffect(() => {
    let cancelled = false;
    customElements.whenDefined('lab-explore').then(() => {
      if (cancelled) return;
      const el = ref.current as LabExploreElement | null;
      if (el) el.model = model;
    });
    return () => {
      cancelled = true;
    };
  }, [model]);

  const medicationBars = useMemo(
    () => (medications?.length ? buildMedicationBars(medications, paletteColor) : []),
    [medications]
  );

  return (
    <>
      <div className="mc-controls">
        <div className="mc-control-group">
          <div className="mc-control-label">Values</div>
          <SegmentedControl
            label="Values"
            options={['normalized', 'absolute'] as const}
            value={normalized ? 'normalized' : 'absolute'}
            onChange={(v) => setNormalized(v === 'normalized')}
            format={(v) => (v === 'normalized' ? 'Normalized values' : 'Absolute numbers')}
          />
        </div>
      </div>
      <lab-explore ref={ref} />
      {medicationBars.length > 0 && <MedicationLane bars={medicationBars} hostRef={ref} />}
    </>
  );
}
