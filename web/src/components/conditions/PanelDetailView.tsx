import { lazy, Suspense, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { Result } from '../../types';
import { MARKER_LOINC, type IndexDef } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import {
  COMPUTED_LOINCS,
  INDEX_LOINCS,
  buildRawNames,
  indexMatchesQuery,
  observationMatchesQuery,
  rawNamesOf,
  testLoincs,
  type Observation,
} from './markers';
import { controlsForTab, pressable, visibleDatesOf, type SelectedCell } from './ui';
import { ControlsBar, type ControlsProps } from './ControlsBar';
import { TabBar } from './TabBar';
import { TrendsView } from './TrendsView';
import { ResultsTable } from './ResultTables';
import { indexInputLoincs, type IndexScheduling, type RowScheduling } from './scheduled';
import { LangProvider } from '../../i18n/LangContext';
import type { ResultEntry } from './resultsLookup';
import { EmptyState } from '../primitives';
import { getPanelMeta } from './panelMeta';

// Neither chart tab is the default one, so both are split out of the initial
// bundle: "What's in range" pulls uPlot plus the vendored lab-explore/chart-kit,
// "Charts" pulls the 3D canvas engine. Each loads on its first visit.
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
  selectedLoinc,
  onSelect,
  onOpenPopup,
  onOpenIndexPopup,
  selectedCell,
  onSelectCell,
  onOpenResultPopup,
  onOpenIndexResultPopup,
  scheduling,
  indexScheduling,
  onBack,
}: Readonly<{
  name: string;
  tests: Observation[];
  allResults: ResultEntry[];
  resultsByDate: Record<string, Record<string, Result>>;
  controls: ControlsProps;
  selectedLoinc: string | null;
  onSelect: (loinc: string) => void;
  onOpenPopup: (test: Observation, e: { currentTarget: HTMLElement }) => void;
  onOpenIndexPopup: (def: IndexDef, e: { currentTarget: HTMLElement }) => void;
  selectedCell: SelectedCell;
  onSelectCell: (loinc: string, date: string) => void;
  onOpenResultPopup: (test: Observation, entry: ResultEntry, e: { currentTarget: HTMLElement }) => void;
  onOpenIndexResultPopup: (def: IndexDef, date: string, value: number, e: { currentTarget: HTMLElement }) => void;
  scheduling: RowScheduling;
  indexScheduling: IndexScheduling;
  onBack: () => void;
}>) {
  const [detailTab, setDetailTab] = useState<DetailTab>('analysis');
  const meta = getPanelMeta(name);
  const PanelIcon = meta.icon;
  // Session-only, like All Observations' copy: a stored filter would go on
  // hiding rows in a later session with nothing on screen to explain the gap.
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

  const dates = useMemo(() => {
    const computedInputLoincs = new Set(
      computedForPanel.flatMap((d) => d.inputKeys.flatMap((inputKey) => MARKER_LOINC[inputKey] ?? []))
    );
    return Array.from(
      new Set(
        allResults
          .filter((r) => tests.some((t) => testLoincs(t).includes(r.loinc)) || computedInputLoincs.has(r.loinc))
          .map((r) => r.date)
      )
    ).sort((a, b) => b.localeCompare(a));
    // computedForPanel derives from `name`, already a dependency via tests
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allResults, tests]);

  const visibleDates = visibleDatesOf(dates, controls.sampleLimit);

  const tableProps = {
    visibleDates,
    allResults,
    unitSystem: controls.unitSystem,
    selectedLoinc,
    onSelect,
    onOpenPopup,
    selectedCell,
    onSelectCell,
    onOpenResultPopup,
    scheduling,
  };

  return (
    <>
      <header className="mc-detail-head">
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
      </header>
      <TabBar tabs={DETAIL_TABS} active={detailTab} onChange={setDetailTab} />

      {detailTab === 'analysis' && (
        <div>
          {/* No panelFilter: the picker renders disabled, since this view is already one panel. */}
          <ControlsBar
            {...controls}
            markerQuery={{ value: query, onChange: setQuery }}
            enabled={controlsForTab('analysis')}
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
                  {...tableProps}
                  resultsByDate={resultsByDate}
                  onOpenIndexPopup={onOpenIndexPopup}
                  onOpenIndexResultPopup={onOpenIndexResultPopup}
                  indexScheduling={indexScheduling}
                  inputsOf={inputsOf}
                  usedBy={usedBy}
                />
              )}
            </>
          )}
        </div>
      )}
      {detailTab === 'trends' && <TrendsView />}
      {detailTab === 'in-range' && (
        <Suspense fallback={chartFallback}>
          <LabExploreView
            conditions={[{ name, tests }]}
            allResults={allResults}
            unitSystem={controls.unitSystem}
            currentPanel={name}
            resultsByDate={resultsByDate}
          />
        </Suspense>
      )}
      {detailTab === 'charts' && (
        <LangProvider>
          <Suspense fallback={chartFallback}>
            <PanelChartsView tests={tests} allResults={allResults} />
          </Suspense>
        </LangProvider>
      )}
    </>
  );
}
