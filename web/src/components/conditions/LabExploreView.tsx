import { useEffect, useMemo, useRef } from 'react';
import { LabExplore } from '../../vendor/lab-explore/lab-explore';
import type { LabExploreModel } from '../../vendor/lab-explore/explore-types';
import { buildExploreModel, type Condition } from './exploreModel';
import type { ResultEntry } from './resultsLookup';

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
}: Readonly<{
  conditions: Condition[];
  allResults: ResultEntry[];
  unitSystem: 'si' | 'us';
  /** Panel to pre-select markers from; omit for no default-panel bias (e.g. the cross-panel All Observations view). */
  currentPanel?: string;
}>) {
  const ref = useRef<HTMLElement | null>(null);
  const model = useMemo(
    () => buildExploreModel(conditions, allResults, unitSystem, currentPanel),
    [conditions, allResults, unitSystem, currentPanel]
  );

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
