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

// The vendored class does not register itself; guard against double-registration on hot reload.
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
  /** Enables computed-index markers; omit to keep the view to raw observations. */
  resultsByDate?: Record<string, Record<string, Result>>;
  /** Omit or empty for no medication lane. */
  medications?: MedicationRow[];
}>) {
  const ref = useRef<HTMLElement | null>(null);
  const sex = loadEnvelopeMeta().sex;
  // Session-only, like the chart's own zoom state.
  const [normalized, setNormalized] = useState(true);
  const model = useMemo(() => {
    const built = buildExploreModel(conditions, allResults, unitSystem, currentPanel, resultsByDate, { sex });
    // Persisted keys are scoped per view: unscoped, one panel's selection would win over another's defaults.
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
