import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import type { Analysis, Result } from '../../types';
import { INDEX_DEFS } from '../../data/indexDefs';
import {
  ALIAS_TO_PRIMARY,
  ALSO_REFS,
  SHORT_NAMES,
  buildRawNames,
  indexMatchesQuery,
  observationMatchesQuery,
  panelRowLoincs,
  rawNamesOf,
  type Observation,
} from './markers';
import { ALL_PANELS, ControlsBar, type ControlsProps } from './ControlsBar';
import { TabBar } from './TabBar';
import { TrendsView } from './TrendsView';
import { visibleDatesOf } from './resultCells';
import { ResultsTable } from './ResultTables';
import type { Condition } from './exploreModel';
import type { ResultEntry } from './resultsLookup';
import type { ObservationsTab } from './routing';
import type { MedicationRow } from '../../data/storage/medications';
import { List, Search, Layers } from 'lucide-react';
import { PageHeader } from './PageHeader';
import { EmptyState } from '../primitives';
import { COLOR } from '../../styles/tokens';

// Lazy: pulls uPlot plus the vendored lab-explore/chart-kit, a chunk shared with PanelDetailView.
const LabExploreView = lazy(() => import('./LabExploreView').then((m) => ({ default: m.LabExploreView })));

// The min-height reserves roughly a chart's worth of room so the tab doesn't jump on load.
const chartFallback = <EmptyState style={{ minHeight: 420 }}>Loading chart…</EmptyState>;

const OBSERVATIONS_TABS: readonly { id: ObservationsTab; label: string }[] = [
  { id: 'analysis', label: 'Results' },
  { id: 'trends', label: 'Trends' },
  { id: 'in-range', label: "What's in range" },
];

// An alias-coded result folds into its primary's row instead of appearing as a bare-LOINC duplicate.
function buildRows(allResults: ResultEntry[], analysesCatalog: Record<string, Analysis>): Observation[] {
  const seen = new Map<string, Observation>();
  for (const { loinc: rawLoinc } of allResults) {
    const loinc = ALIAS_TO_PRIMARY[rawLoinc] ?? rawLoinc;
    if (seen.has(loinc)) continue;
    const analysis = analysesCatalog[loinc];
    const labelInfo = SHORT_NAMES[loinc];
    seen.set(loinc, {
      shortName: labelInfo?.shortName ?? analysis?.friendlyName ?? loinc,
      friendlyName: analysis?.friendlyName ?? loinc,
      longCommonName: analysis?.longCommonName ?? '',
      loinc,
      unit: labelInfo?.unit,
      also: ALSO_REFS[loinc],
    });
  }
  return Array.from(seen.values()).sort((a, b) => a.shortName.localeCompare(b.shortName));
}

function emptyMessage(panelName: string | undefined, query: string): string {
  const q = query.trim();
  if (q && panelName) return `Nothing in ${panelName} matches “${q}”.`;
  if (q) return `Nothing matches “${q}”.`;
  if (panelName) return `No uploaded observations belong to ${panelName}.`;
  return 'Nothing to show.';
}

export function AllObservationsView({
  allResults,
  /** Every panel's tests, for the "What's in range" tab's own cross-panel marker picker. */
  conditions,
  panelOptions,
  analysesCatalog,
  controls,
  resultsByDate,
  tab,
  onTabChange,
  medications,
}: Readonly<{
  allResults: ResultEntry[];
  conditions: Condition[];
  /** Narrowed by a share link's showPanels; the table itself still defaults to every observation. */
  panelOptions: Condition[];
  analysesCatalog: Record<string, Analysis>;
  controls: ControlsProps;
  /** Passed to LabExploreView without a currentPanel, which fans each index out across all its panels. */
  resultsByDate: Record<string, Record<string, Result>>;
  /** Owned by the route (`#all/<tab>`), so a tab is linkable and back/forward returns to it. */
  tab: ObservationsTab;
  onTabChange: (tab: ObservationsTab) => void;
  /** Medication history for the "What's in range" tab's lane. */
  medications: MedicationRow[];
}>) {
  // Deliberately not persisted: a stored filter would go on hiding rows with nothing on screen explaining why.
  const [panelFilter, setPanelFilter] = useState<string>(ALL_PANELS);
  // Same reasoning as the panel filter: never persisted.
  const [query, setQuery] = useState('');

  const rows = useMemo(() => buildRows(allResults, analysesCatalog), [allResults, analysesCatalog]);
  const rawNames = useMemo(() => buildRawNames(allResults), [allResults]);
  const activePanel = panelOptions.find((c) => c.name === panelFilter) ?? null;
  const visibleRows = useMemo(() => {
    const covered = activePanel ? panelRowLoincs(activePanel.tests) : null;
    return rows.filter(
      (row) =>
        (!covered || covered.has(row.loinc)) && observationMatchesQuery(row, query, rawNamesOf(rawNames, row))
    );
  }, [rows, activePanel, query, rawNames]);
  // The picked panel's indices, else every index the offered (allowlist-narrowed) panels declare.
  const visibleIndexDefs = useMemo(() => {
    const names = new Set(activePanel ? [activePanel.name] : panelOptions.map((c) => c.name));
    return INDEX_DEFS.filter((def) => def.panels.some((p) => names.has(p)) && indexMatchesQuery(def, query));
  }, [activePanel, panelOptions, query]);
  const filtered = !!activePanel || query.trim() !== '';
  const sortedDates = useMemo(
    () => Array.from(new Set(allResults.map((r) => r.date))).sort((a, b) => b.localeCompare(a)),
    [allResults]
  );
  const allDates = visibleDatesOf(sortedDates, controls.sampleLimit);

  let analysisTab: ReactNode;
  if (rows.length === 0) {
    analysisTab = <EmptyState>No results uploaded yet.</EmptyState>;
  } else {
    analysisTab = (
      <>
        <ControlsBar
          {...controls}
          panelFilter={{ options: panelOptions, value: activePanel?.name ?? ALL_PANELS, onChange: setPanelFilter }}
          markerQuery={{ value: query, onChange: setQuery }}
        />
        <div style={{ color: COLOR.textMuted, fontSize: 13, marginBottom: 16 }}>
          {filtered ? `${visibleRows.length} of ${rows.length}` : rows.length} observations across{' '}
          {sortedDates.length} lab reports
        </div>
        {visibleRows.length === 0 && visibleIndexDefs.length === 0 ? (
          <EmptyState>{emptyMessage(activePanel?.name, query)}</EmptyState>
        ) : (
          <>
            {(visibleRows.length > 0 || visibleIndexDefs.length > 0) && (
              <ResultsTable
                label="Observations"
                rows={visibleRows}
                defs={visibleIndexDefs}
                visibleDates={allDates}
                allResults={allResults}
                resultsByDate={resultsByDate}
                unitSystem={controls.unitSystem}
                preferRaw
              />
            )}
          </>
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader
        overline="Comprehensive Biomarker Timeline"
        titlePrimary="All"
        titleAccent="Observations"
        description={[
          'Chronological timeline of every test result and computed index across your health history.',
          'Filter by panel or search across aliases and LOINC codes with automatic unit conversion.',
        ]}
        pillars={[
          { icon: List, line1: 'Unified history', line2: 'across all draws' },
          { icon: Search, line1: 'Fast multi-code', line2: 'marker search' },
          { icon: Layers, line1: 'Normalized SI & US', line2: 'unit systems' },
        ]}
      />
      <TabBar tabs={OBSERVATIONS_TABS} active={tab} onChange={onTabChange} />

      {tab === 'analysis' && analysisTab}
      {tab === 'trends' && (
        <TrendsView
          tests={conditions.flatMap((c) => c.tests)}
          allResults={allResults}
          unitSystem={controls.unitSystem}
          resultsByDate={resultsByDate}
        />
      )}
      {tab === 'in-range' && (
        <Suspense fallback={chartFallback}>
          <LabExploreView
            conditions={conditions}
            allResults={allResults}
            unitSystem={controls.unitSystem}
            resultsByDate={resultsByDate}
            medications={medications}
          />
        </Suspense>
      )}
    </>
  );
}
