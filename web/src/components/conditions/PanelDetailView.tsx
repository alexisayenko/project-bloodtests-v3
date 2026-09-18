import { useMemo, useState, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { Analysis, Result } from '../../types';
import { INDEX_DEFS } from '../../data/indexDefs';
import {
  ALIAS_TO_PRIMARY,
  ALSO_REFS,
  COMPUTED_LOINCS,
  INDEX_LOINCS,
  SHORT_NAMES,
  buildRawNames,
  indexMatchesQuery,
  observationMatchesQuery,
  panelDates,
  panelRowLoincs,
  rawNamesOf,
  testLoincs,
  type Observation,
} from './markers';
import { pressable } from '../primitives/styles';
import { visibleDatesOf } from './resultCells';
import { ALL_PANELS, ControlsBar, type ControlsProps } from './ControlsBar';
import { TabBar } from './TabBar';
import { TrendsView } from './TrendsView';
import { ResultsTable } from './ResultTables';
import { usePopupContext } from './PopupContext';
import { indexInputLoincs } from '../../data/storage/scheduledVisits';
import type { Condition } from './exploreModel';
import type { ResultEntry } from './resultsLookup';
import type { MedicationRow } from '../../data/storage/medications';
import { EmptyState } from '../primitives';
import { getPanelMeta } from './panelMeta';
import { ALL_OBSERVATIONS_PANEL, type PanelTab } from './routing';
import { COLOR } from '../../styles/tokens';

import { PanelRangePicker } from './PanelRangePicker';

const DETAIL_TABS: readonly { id: PanelTab; label: string }[] = [
  { id: 'analysis', label: 'Results' },
  { id: 'trends', label: 'Trends' },
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

export function PanelDetailView({
  name,
  tests,
  conditions,
  panelOptions,
  analysesCatalog,
  allResults,
  resultsByDate,
  controls,
  tab,
  onTabChange,
  onBack,
  medications,
}: Readonly<{
  name: string;
  tests: Observation[];
  /** Full, unnarrowed cross-panel list — used by the All Observations pseudo-panel's Trends tab. */
  conditions: Condition[];
  /** Share-link-narrowed list — the All Observations pseudo-panel's panel filter and index scope. */
  panelOptions: Condition[];
  analysesCatalog: Record<string, Analysis>;
  allResults: ResultEntry[];
  resultsByDate: Record<string, Record<string, Result>>;
  controls: ControlsProps;
  /** Owned by the route (`#panels/<name>/<tab>`), so a tab is linkable and back/forward returns to it. */
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  onBack: () => void;
  /** Medication history for the Trends tab's lane. */
  medications: MedicationRow[];
}>) {
  const { selectedLoinc } = usePopupContext();
  const isAll = name === ALL_OBSERVATIONS_PANEL;
  const meta = getPanelMeta(name);
  const PanelIcon = meta.icon;
  // Session-only: a stored filter would go on hiding rows with nothing on screen explaining why.
  const [query, setQuery] = useState('');
  // Deliberately not persisted, and only meaningful for the All Observations pseudo-panel.
  const [panelFilter, setPanelFilter] = useState<string>(ALL_PANELS);

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

  // All Observations' timeline spans every result; a single panel's spans only its own tests (plus its indices' inputs).
  const dates = useMemo(
    () =>
      isAll
        ? Array.from(new Set(allResults.map((r) => r.date))).sort((a, b) => b.localeCompare(a))
        : panelDates(name, tests, allResults),
    [isAll, name, tests, allResults]
  );
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

  // All Observations' cross-panel rows, filter and index scope — ported from the retired AllObservationsView.
  const allRows = useMemo(() => buildRows(allResults, analysesCatalog), [allResults, analysesCatalog]);
  const activePanel = panelOptions.find((c) => c.name === panelFilter) ?? null;
  const allVisibleRows = useMemo(() => {
    const covered = activePanel ? panelRowLoincs(activePanel.tests) : null;
    return allRows.filter(
      (row) =>
        (!covered || covered.has(row.loinc)) && observationMatchesQuery(row, query, rawNamesOf(rawNames, row))
    );
  }, [allRows, activePanel, query, rawNames]);
  // The picked panel's indices, else every index the offered (allowlist-narrowed) panels declare.
  const allVisibleIndexDefs = useMemo(() => {
    const names = new Set(activePanel ? [activePanel.name] : panelOptions.map((c) => c.name));
    return INDEX_DEFS.filter((def) => def.panels.some((p) => names.has(p)) && indexMatchesQuery(def, query));
  }, [activePanel, panelOptions, query]);
  const allFiltered = !!activePanel || query.trim() !== '';

  let analysisTab: ReactNode;
  if (isAll) {
    if (allRows.length === 0) {
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
            {allFiltered ? `${allVisibleRows.length} of ${allRows.length}` : allRows.length} observations across{' '}
            {dates.length} lab reports
          </div>
          {allVisibleRows.length === 0 && allVisibleIndexDefs.length === 0 ? (
            <EmptyState>{emptyMessage(activePanel?.name, query)}</EmptyState>
          ) : (
            <ResultsTable
              label="Observations"
              rows={allVisibleRows}
              defs={allVisibleIndexDefs}
              visibleDates={visibleDates}
              allResults={allResults}
              resultsByDate={resultsByDate}
              unitSystem={controls.unitSystem}
              preferRaw
            />
          )}
        </>
      );
    }
  } else {
    analysisTab = (
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
    );
  }

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
        {tab === 'trends' && (
          <div style={{ flexShrink: 0, marginLeft: 16 }}>
            <PanelRangePicker yearCounts={yearCounts} />
          </div>
        )}
      </header>
      <TabBar tabs={DETAIL_TABS} active={tab} onChange={onTabChange} />

      {tab === 'analysis' && analysisTab}
      {tab === 'trends' && (
        <TrendsView
          conditions={isAll ? conditions : [{ name, tests }]}
          currentPanel={isAll ? undefined : name}
          allResults={allResults}
          unitSystem={controls.unitSystem}
          resultsByDate={resultsByDate}
          medications={medications}
        />
      )}
    </>
  );
}
