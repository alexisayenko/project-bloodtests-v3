import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import type { Analysis, Result } from '../../types';
import type { IndexDef } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import {
  ALIAS_TO_PRIMARY,
  ALSO_REFS,
  SHORT_LABELS,
  buildPrintedNames,
  indexMatchesQuery,
  observationMatchesQuery,
  panelRowLoincs,
  printedNamesOf,
  type Observation,
} from './markers';
import { ALL_PANELS, ControlsBar, type ControlsProps } from './ControlsBar';
import { TabBar } from './TabBar';
import { TrendsView } from './TrendsView';
import { controlsForTab, visibleDatesOf, type SelectedCell } from './ui';
import { IndexTable, ObservationTable } from './ResultTables';
import type { Condition } from './exploreModel';
import type { IndexScheduling, RowScheduling } from './scheduled';
import type { ResultEntry } from './resultsLookup';
import type { ObservationsTab } from './routing';
import { COLOR } from '../../styles/tokens';

// Not the default tab, and it pulls uPlot plus the vendored
// lab-explore/chart-kit -- kept out of the initial bundle, same as in
// PanelDetailView, which shares this chunk.
const LabExploreView = lazy(() => import('./LabExploreView').then((m) => ({ default: m.LabExploreView })));

// Matches the muted empty-state text below; the min-height reserves roughly a
// chart's worth of room so the tab doesn't jump on load.
const chartFallback = <div style={{ color: COLOR.textMuted, fontSize: 14, minHeight: 420 }}>Loading chart…</div>;

const OBSERVATIONS_TABS: readonly { id: ObservationsTab; label: string }[] = [
  { id: 'analysis', label: 'Results' },
  { id: 'trends', label: 'Trends' },
  { id: 'in-range', label: "What's in range" },
];

// Every distinct observation ever uploaded, regardless of panel membership.
// A result recorded under an also-ref alias (unit-variant LOINC) folds into
// its primary marker's row instead of appearing as a bare-LOINC duplicate.
function buildRows(allResults: ResultEntry[], analysesCatalog: Record<string, Analysis>): Observation[] {
  const seen = new Map<string, Observation>();
  for (const { loinc: rawLoinc } of allResults) {
    const loinc = ALIAS_TO_PRIMARY[rawLoinc] ?? rawLoinc;
    if (seen.has(loinc)) continue;
    const analysis = analysesCatalog[loinc];
    const labelInfo = SHORT_LABELS[loinc];
    seen.set(loinc, {
      short: labelInfo?.short ?? analysis?.displayName ?? loinc,
      full: analysis?.displayName ?? loinc,
      longCommonName: analysis?.longCommonName ?? '',
      loinc,
      unit: labelInfo?.unit,
      also: ALSO_REFS[loinc],
    });
  }
  return Array.from(seen.values()).sort((a, b) => a.short.localeCompare(b.short));
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
  selectedLoinc,
  onSelect,
  onOpenPopup,
  onOpenIndexPopup,
  selectedCell,
  onSelectCell,
  onOpenResultPopup,
  onOpenIndexResultPopup,
  resultsByDate,
  scheduling,
  indexScheduling,
  tab,
  onTabChange,
}: Readonly<{
  allResults: ResultEntry[];
  conditions: Condition[];
  /**
   * Panels offered in the table's panel filter. A share link's showPanels
   * allowlist narrows this, so the picker never names a panel the link hid;
   * the table itself still defaults to every observation.
   */
  panelOptions: Condition[];
  analysesCatalog: Record<string, Analysis>;
  controls: ControlsProps;
  selectedLoinc: string | null;
  onSelect: (loinc: string) => void;
  onOpenPopup: (test: Observation, e: { currentTarget: HTMLElement }) => void;
  onOpenIndexPopup: (def: IndexDef, e: { currentTarget: HTMLElement }) => void;
  selectedCell: SelectedCell;
  onSelectCell: (loinc: string, date: string) => void;
  onOpenResultPopup: (test: Observation, entry: ResultEntry, e: { currentTarget: HTMLElement }) => void;
  onOpenIndexResultPopup: (def: IndexDef, date: string, value: number, e: { currentTarget: HTMLElement }) => void;
  /**
   * Per-date observation lookup, so the "What's in range" tab's picker can
   * also build computed-index markers -- passed through to LabExploreView
   * WITHOUT a currentPanel, which is what fans each index out across all of
   * its own declared panels instead of scoping to just one (see
   * buildExploreModel's doc comment).
   */
  resultsByDate: Record<string, Record<string, Result>>;
  /** Shared with Panel Detail, so a row toggled in either view is the same row. */
  scheduling: RowScheduling;
  indexScheduling: IndexScheduling;
  /** Owned by the route (`#all/<tab>`), so a tab is linkable and back/forward returns to it. */
  tab: ObservationsTab;
  onTabChange: (tab: ObservationsTab) => void;
}>) {
  // Deliberately not persisted: a stored filter that hides observations would
  // outlive the session that chose it, with nothing on screen explaining the
  // gap -- the failure mode the shared-meta showPanels allowlist already had.
  const [panelFilter, setPanelFilter] = useState<string>(ALL_PANELS);
  // Same reasoning as the panel filter: never persisted.
  const [query, setQuery] = useState('');

  const rows = useMemo(() => buildRows(allResults, analysesCatalog), [allResults, analysesCatalog]);
  const printedNames = useMemo(() => buildPrintedNames(allResults), [allResults]);
  const activePanel = panelOptions.find((c) => c.name === panelFilter) ?? null;
  const visibleRows = useMemo(() => {
    const covered = activePanel ? panelRowLoincs(activePanel.tests) : null;
    return rows.filter(
      (row) =>
        (!covered || covered.has(row.loinc)) && observationMatchesQuery(row, query, printedNamesOf(printedNames, row))
    );
  }, [rows, activePanel, query, printedNames]);
  // The panel's own indices when one is picked, exactly as Panel Detail scopes
  // them; otherwise every index the panels on offer declare, which the share
  // link's allowlist has already narrowed.
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
    analysisTab = <div style={{ color: COLOR.textMuted, fontSize: 14 }}>No results uploaded yet.</div>;
  } else {
    analysisTab = (
      <>
        <div style={{ color: COLOR.textMuted, fontSize: 13, marginBottom: 16 }}>
          {filtered ? `${visibleRows.length} of ${rows.length}` : rows.length} observations across{' '}
          {sortedDates.length} lab reports
        </div>
        {visibleRows.length === 0 && visibleIndexDefs.length === 0 ? (
          <div style={{ color: COLOR.textMuted, fontSize: 14 }}>{emptyMessage(activePanel?.name, query)}</div>
        ) : (
          <>
            {visibleRows.length > 0 && (
              <ObservationTable
                label="Observations"
                rows={visibleRows}
                visibleDates={allDates}
                allResults={allResults}
                unitSystem={controls.unitSystem}
                selectedLoinc={selectedLoinc}
                onSelect={onSelect}
                onOpenPopup={onOpenPopup}
                selectedCell={selectedCell}
                onSelectCell={onSelectCell}
                onOpenResultPopup={onOpenResultPopup}
                scheduling={scheduling}
                preferRaw
              />
            )}
            {visibleIndexDefs.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <IndexTable
                  defs={visibleIndexDefs}
                  visibleDates={allDates}
                  allResults={allResults}
                  resultsByDate={resultsByDate}
                  selectedLoinc={selectedLoinc}
                  onSelect={onSelect}
                  onOpenPopup={onOpenIndexPopup}
                  selectedCell={selectedCell}
                  onSelectCell={onSelectCell}
                  onOpenIndexResultPopup={onOpenIndexResultPopup}
                  scheduling={indexScheduling}
                />
              </div>
            )}
          </>
        )}
      </>
    );
  }

  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 24 }}>All Observations</h1>
      <ControlsBar
        {...controls}
        panelFilter={{ options: panelOptions, value: activePanel?.name ?? ALL_PANELS, onChange: setPanelFilter }}
        markerQuery={{ value: query, onChange: setQuery }}
        enabled={controlsForTab(tab)}
      />
      <TabBar tabs={OBSERVATIONS_TABS} active={tab} onChange={onTabChange} />

      {tab === 'analysis' && analysisTab}
      {tab === 'trends' && <TrendsView />}
      {tab === 'in-range' && (
        <Suspense fallback={chartFallback}>
          <LabExploreView
            conditions={conditions}
            allResults={allResults}
            unitSystem={controls.unitSystem}
            resultsByDate={resultsByDate}
          />
        </Suspense>
      )}
    </>
  );
}
