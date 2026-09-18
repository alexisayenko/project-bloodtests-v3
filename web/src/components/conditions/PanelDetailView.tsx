import { lazy, Suspense, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { Result } from '../../types';
import { INDEX_DEFS } from '../../data/indexDefs';
import {
  COMPUTED_LOINCS,
  INDEX_LOINCS,
  buildRawNames,
  indexMatchesQuery,
  observationMatchesQuery,
  panelDates,
  rawNamesOf,
  testLoincs,
  type Observation,
} from './markers';
import { pressable } from '../primitives/styles';
import { visibleDatesOf } from './resultCells';
import { ControlsBar, type ControlsProps } from './ControlsBar';
import { TabBar } from './TabBar';
import { TrendsView } from './TrendsView';
import { ResultsTable } from './ResultTables';
import { usePopupContext } from './PopupContext';
import { indexInputLoincs } from '../../data/storage/scheduledVisits';
import type { ResultEntry } from './resultsLookup';
import type { MedicationRow } from '../../data/storage/medications';
import { EmptyState } from '../primitives';
import { getPanelMeta } from './panelMeta';

import { PanelRangePicker } from './PanelRangePicker';

// Lazy: "What's in range" pulls uPlot plus the vendored lab-explore/chart-kit, "Charts" the 3D canvas engine.
const LabExploreView = lazy(() => import('./LabExploreView').then((m) => ({ default: m.LabExploreView })));
const PanelChartsView = lazy(() => import('../analytics/PanelChartsView').then((m) => ({ default: m.PanelChartsView })));

type DetailTab = 'analysis' | 'trends' | 'in-range' | 'charts';

const DETAIL_TABS: readonly { id: DetailTab; label: string }[] = [
  { id: 'analysis', label: 'Results' },
  { id: 'trends', label: 'Trends' },
  { id: 'in-range', label: "What's in range" },
  { id: 'charts', label: 'Charts' },
];

// The min-height reserves roughly a chart's worth of room so the tab doesn't jump on load.
const chartFallback = <EmptyState style={{ minHeight: 420 }}>Loading chart…</EmptyState>;

export function PanelDetailView({
  name,
  tests,
  allResults,
  resultsByDate,
  controls,
  onBack,
  medications,
}: Readonly<{
  name: string;
  tests: Observation[];
  allResults: ResultEntry[];
  resultsByDate: Record<string, Record<string, Result>>;
  controls: ControlsProps;
  onBack: () => void;
  /** Medication history for the "What's in range" tab's lane. */
  medications: MedicationRow[];
}>) {
  const { selectedLoinc } = usePopupContext();
  const [detailTab, setDetailTab] = useState<DetailTab>('analysis');
  const meta = getPanelMeta(name);
  const PanelIcon = meta.icon;
  // Session-only: a stored filter would go on hiding rows with nothing on screen explaining why.
  const [query, setQuery] = useState('');

  const observations = tests.filter((t) => !INDEX_LOINCS.has(t.loinc));
  const indices = tests.filter((t) => INDEX_LOINCS.has(t.loinc) && !COMPUTED_LOINCS.has(t.loinc));
  const computedForPanel = INDEX_DEFS.filter((d) => d.panels.includes(name));

  const rawNames = useMemo(() => buildRawNames(allResults), [allResults]);
  const matchesQuery = (t: Observation) => observationMatchesQuery(t, query, rawNamesOf(rawNames, t));
  const visibleObservations = observations.filter(matchesQuery);
  const visibleIndices = indices.filter(matchesQuery);
  const visibleComputed = computedForPanel.filter((d) => indexMatchesQuery(d, query));
  const nothingMatches =
    visibleObservations.length === 0 && visibleIndices.length === 0 && visibleComputed.length === 0;
  const selectedIndex = computedForPanel.find((d) => d.key === selectedLoinc);
  const inputsOf = selectedIndex && { name: selectedIndex.friendlyName, loincs: indexInputLoincs(selectedIndex.key) };
  const selectedObservation = observations.find((t) => t.loinc === selectedLoinc);
  const usedBy = selectedObservation && { name: selectedObservation.shortName, loincs: testLoincs(selectedObservation) };

  const dates = useMemo(() => panelDates(name, tests, allResults), [name, tests, allResults]);

  const visibleDates = visibleDatesOf(dates, controls.sampleLimit);

  // Approximate report counts per calendar year for the header date picker
  const yearCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const d of dates) {
      const y = Number(d.slice(0, 4));
      if (!Number.isNaN(y)) {
        counts[y] = (counts[y] ?? 0) + 1;
      }
    }
    return counts;
  }, [dates]);

  return (
    <>
      <header className="mc-detail-head" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <span {...pressable(onBack)} className="mc-detail-back" aria-label="Back to Monitoring Panels" title="Back to Monitoring Panels">
            <ChevronLeft size={20} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="mc-detail-icon" style={{ background: meta.iconBg, color: meta.color }}>
            <PanelIcon size={26} color="currentColor" strokeWidth={2} aria-hidden="true" />
          </span>
          <div style={{ minWidth: 0 }}>
            <h1 className="mc-detail-title">{name}</h1>
            {meta.description && <p className="mc-detail-desc">{meta.description}</p>}
          </div>
        </div>
        {detailTab === 'trends' && (
          <div style={{ flexShrink: 0, marginLeft: 16 }}>
            <PanelRangePicker yearCounts={yearCounts} />
          </div>
        )}
      </header>
      <TabBar tabs={DETAIL_TABS} active={detailTab} onChange={setDetailTab} />

      {detailTab === 'analysis' && (
        <div>
          {/* No panelFilter: the picker renders disabled, since this view is already one panel. */}
          <ControlsBar
            {...controls}
            markerQuery={{ value: query, onChange: setQuery }}
          />
          {dates.length === 0 ? (
            <EmptyState>No results recorded for this panel yet.</EmptyState>
          ) : (
            <>
              {nothingMatches && (
                <EmptyState>Nothing in {name} matches “{query.trim()}”.</EmptyState>
              )}
              {(visibleObservations.length > 0 || visibleIndices.length > 0 || visibleComputed.length > 0) && (
                <ResultsTable
                  label="Observations"
                  rows={visibleObservations}
                  indices={visibleIndices}
                  defs={visibleComputed}
                  visibleDates={visibleDates}
                  allResults={allResults}
                  resultsByDate={resultsByDate}
                  unitSystem={controls.unitSystem}
                  inputsOf={inputsOf}
                  usedBy={usedBy}
                />
              )}
            </>
          )}
        </div>
      )}
      {detailTab === 'trends' && (
        <TrendsView
          name={name}
          tests={tests}
          allResults={allResults}
          unitSystem={controls.unitSystem}
          resultsByDate={resultsByDate}
        />
      )}
      {detailTab === 'in-range' && (
        <Suspense fallback={chartFallback}>
          <LabExploreView
            conditions={[{ name, tests }]}
            allResults={allResults}
            unitSystem={controls.unitSystem}
            currentPanel={name}
            resultsByDate={resultsByDate}
            medications={medications}
          />
        </Suspense>
      )}
      {detailTab === 'charts' && (
        <Suspense fallback={chartFallback}>
          <PanelChartsView tests={tests} allResults={allResults} />
        </Suspense>
      )}
    </>
  );
}
