import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import type { Analysis, Result } from '../../types';
import type { IndexDef } from '../../data/computedIndices';
import { INDEX_DEFS } from '../../data/indexDefs';
import {
  ALIAS_TO_PRIMARY,
  ALSO_REFS,
  SHORT_LABELS,
  indexMatchesQuery,
  observationMatchesQuery,
  panelRowLoincs,
  primaryLoinc,
  type Observation,
} from './markers';
import { ControlsBar, type ControlsProps } from './ControlsBar';
import { TabBar } from './TabBar';
import { visibleDatesOf, type SelectedCell } from './ui';
import { IndexTable, ObservationTable } from './ResultTables';
import type { Condition } from './exploreModel';
import type { IndexScheduling, RowScheduling } from './scheduled';
import type { ResultEntry } from './resultsLookup';

// Not the default tab, and it pulls uPlot plus the vendored
// lab-explore/chart-kit -- kept out of the initial bundle, same as in
// PanelDetailView, which shares this chunk.
const LabExploreView = lazy(() => import('./LabExploreView').then((m) => ({ default: m.LabExploreView })));

// Matches the muted empty-state text below; the min-height reserves roughly a
// chart's worth of room so the tab doesn't jump on load.
const chartFallback = <div style={{ color: '#888', fontSize: 14, minHeight: 420 }}>Loading chart…</div>;

type ObservationsTab = 'analysis' | 'in-range';

const OBSERVATIONS_TABS: readonly { id: ObservationsTab; label: string }[] = [
  { id: 'analysis', label: 'Analysis' },
  { id: 'in-range', label: "What's in range" },
];

const ALL_PANELS = '';

// ControlsBar's pill, reused for the two filters so they read as one control row.
const PILL_INSET = 12;
const CHEVRON_WIDTH = 10;

const PILL = {
  border: '1.5px solid #1971c2',
  borderRadius: 9999,
  padding: `4px ${PILL_INSET}px`,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
  lineHeight: '18px',
  color: '#1971c2',
  backgroundColor: 'transparent',
} as const;

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1L5 5L9 1' fill='none' stroke='%231971c2' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`;

// A native select draws its own indicator against the padding box using metrics
// that assume a squared-off control, so under a 9999px radius it landed inside
// the pill's curve. The arrow is drawn here instead: appearance:none drops the
// UA one (all three spellings, so no engine paints both), and the background
// position places it PILL_INSET from the border box -- the same inset the label
// text gets on the left -- and vertically centred whatever the option's length.
const PANEL_SELECT = {
  ...PILL,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  paddingRight: PILL_INSET * 2 + CHEVRON_WIDTH,
  backgroundImage: CHEVRON,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: `right ${PILL_INSET}px center`,
  cursor: 'pointer',
} as const;

const FILTER_INPUT = { ...PILL, width: 220, outline: 'none' } as const;

const FILTER_LABEL = { fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 } as const;

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

/** Every name a lab printed for a row, keyed the way buildRows keys its rows. */
function buildPrintedNames(allResults: ResultEntry[]): Record<string, string[]> {
  const byLoinc: Record<string, string[]> = {};
  for (const { loinc, result } of allResults) {
    const name = result.analysis;
    if (!name) continue;
    const key = primaryLoinc(loinc);
    const names = (byLoinc[key] ??= []);
    if (!names.includes(name)) names.push(name);
  }
  return byLoinc;
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
}>) {
  const [tab, setTab] = useState<ObservationsTab>('analysis');
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
        (!covered || covered.has(row.loinc)) && observationMatchesQuery(row, query, printedNames[row.loinc] ?? [])
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
    analysisTab = <div style={{ color: '#888', fontSize: 14 }}>No results uploaded yet.</div>;
  } else {
    analysisTab = (
      <>
        <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
          {filtered ? `${visibleRows.length} of ${rows.length}` : rows.length} observations across{' '}
          {sortedDates.length} lab reports
        </div>
        <ControlsBar {...controls} />
        <div style={{ display: 'flex', gap: 32, marginBottom: 20 }}>
          {panelOptions.length > 0 && (
            <div>
              <div style={FILTER_LABEL}>Show observations from</div>
              <select
                aria-label="Filter observations by monitoring panel"
                value={activePanel?.name ?? ALL_PANELS}
                onChange={(e) => setPanelFilter(e.currentTarget.value)}
                style={PANEL_SELECT}
              >
                <option value={ALL_PANELS}>All panels</option>
                {panelOptions.map((c) => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <div style={FILTER_LABEL}>Find a marker</div>
            <input
              type="search"
              aria-label="Filter observations by name"
              placeholder="HGB, Гемоглобин, 718-7…"
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              style={FILTER_INPUT}
            />
          </div>
        </div>
        {visibleRows.length === 0 && visibleIndexDefs.length === 0 ? (
          <div style={{ color: '#888', fontSize: 14 }}>{emptyMessage(activePanel?.name, query)}</div>
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
      <TabBar tabs={OBSERVATIONS_TABS} active={tab} onChange={setTab} />

      {tab === 'analysis' ? analysisTab : (
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
