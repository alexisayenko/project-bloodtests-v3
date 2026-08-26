import { useEffect, useMemo, useRef } from 'react';
import { LabExplore } from '../../vendor/lab-explore/lab-explore';
import type { LabExploreModel } from '../../vendor/lab-explore/explore-types';
import { buildExploreModel, type Condition } from './exploreModel';
import type { ResultEntry } from './resultsLookup';
import type { Result } from '../../types';

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
}>) {
  const ref = useRef<HTMLElement | null>(null);
  const model = useMemo(() => {
    const built = buildExploreModel(conditions, allResults, unitSystem, currentPanel, resultsByDate);
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
      persist: {
        sel: `exploreSel:${viewId}`,
        view: `hpgChartView:${viewId}`,
        autoscale: `hpgAutoscale:${viewId}`,
        evPrefix: `exploreEv:${viewId}:`,
      },
    };
  }, [conditions, allResults, unitSystem, currentPanel, resultsByDate]);

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

  return <lab-explore ref={ref} />;
}
