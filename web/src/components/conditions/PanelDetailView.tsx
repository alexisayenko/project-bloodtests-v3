import { useMemo, useState } from 'react';
import type { Result } from '../../types';
import { INDEX_DEFS, MARKER_LOINC, type IndexDef } from '../../data/computedIndices';
import { COMPUTED_LOINCS, INDEX_LOINCS, testLoincs, type Observation } from './markers';
import { pressable, visibleDatesOf, type SelectedCell } from './ui';
import { ControlsBar, type ControlsProps } from './ControlsBar';
import { ObservationTable, IndexTable } from './ResultTables';
import { indexInputLoincs, useScheduled } from './scheduled';
import { LabExploreView } from './LabExploreView';
import { PanelChartsView } from '../analytics/PanelChartsView';
import { LangProvider } from '../../i18n/LangContext';
import type { ResultEntry } from './resultsLookup';

type DetailTab = 'analysis' | 'in-range' | 'charts';

const TAB_LABELS: Record<DetailTab, string> = {
  analysis: 'Analysis',
  'in-range': "What's in range",
  charts: 'Charts',
};

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
  onBack: () => void;
}>) {
  const [detailTab, setDetailTab] = useState<DetailTab>('analysis');
  const { scheduled, onToggleRow, onToggleIndex } = useScheduled();

  const observations = tests.filter((t) => !INDEX_LOINCS.has(t.loinc));
  const indices = tests.filter((t) => INDEX_LOINCS.has(t.loinc) && !COMPUTED_LOINCS.has(t.loinc));
  const computedForPanel = INDEX_DEFS.filter((d) => d.panels.includes(name));
  const selectedIndex = computedForPanel.find((d) => d.key === selectedLoinc);
  const inputsOf = selectedIndex && { name: selectedIndex.name, loincs: indexInputLoincs(selectedIndex.key) };
  const selectedObservation = observations.find((t) => t.loinc === selectedLoinc);
  const usedBy = selectedObservation && { name: selectedObservation.short, loincs: testLoincs(selectedObservation) };

  const dates = useMemo(() => {
    const computedInputLoincs = new Set(
      computedForPanel.flatMap((d) => d.needs.flatMap((short) => MARKER_LOINC[short] ?? []))
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

  const visibleDates = visibleDatesOf(dates, controls.sampleLimit, controls.dateOrder);

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
    scheduling: { scheduled, onToggle: onToggleRow },
  };

  return (
    <>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 28, fontWeight: 600, marginBottom: 24 }}>
        <span {...pressable(onBack)} style={{ color: '#1971c2', cursor: 'pointer' }}>
          ‹
        </span>
        {name}
      </h1>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1.5px solid #eee', marginBottom: 24 }}>
        {(['analysis', 'in-range', 'charts'] as const).map((tab) => (
          <div
            key={tab}
            {...pressable(() => setDetailTab(tab))}
            style={{
              padding: '10px 4px',
              marginBottom: -2,
              borderBottom: detailTab === tab ? '2px solid #1971c2' : '2px solid transparent',
              // Faux-bold via text-shadow, not fontWeight -- see NavBar.tsx's comment:
              // a real weight change reflows neighboring tabs by a px on switch.
              textShadow: detailTab === tab ? '0.3px 0 currentColor, -0.3px 0 currentColor' : 'none',
              color: detailTab === tab ? '#1971c2' : '#555',
              cursor: 'pointer',
            }}
          >
            {TAB_LABELS[tab]}
          </div>
        ))}
      </div>

      {detailTab === 'analysis' && (
        <div>
          <ControlsBar {...controls} />
          {dates.length === 0 ? (
            <div style={{ color: '#888', fontSize: 14 }}>No results recorded for this panel yet.</div>
          ) : (
            <>
              <ObservationTable label="Observations" rows={observations} {...tableProps} inputsOf={inputsOf} />
              {(indices.length > 0 || computedForPanel.length > 0) && (
                <div style={{ marginTop: 16 }}>
                  {indices.length > 0 && <ObservationTable label="Indices" rows={indices} {...tableProps} />}
                  {computedForPanel.length > 0 && (
                    <IndexTable
                      defs={computedForPanel}
                      visibleDates={visibleDates}
                      resultsByDate={resultsByDate}
                      selectedLoinc={selectedLoinc}
                      onSelect={onSelect}
                      onOpenPopup={onOpenIndexPopup}
                      selectedCell={selectedCell}
                      onSelectCell={onSelectCell}
                      onOpenIndexResultPopup={onOpenIndexResultPopup}
                      scheduling={{ scheduled, onToggle: onToggleIndex }}
                      usedBy={usedBy}
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {detailTab === 'in-range' && (
        <LabExploreView
          conditions={[{ name, tests }]}
          allResults={allResults}
          unitSystem={controls.unitSystem}
          currentPanel={name}
          resultsByDate={resultsByDate}
        />
      )}
      {detailTab === 'charts' && (
        <LangProvider>
          <PanelChartsView tests={tests} allResults={allResults} />
        </LangProvider>
      )}
    </>
  );
}
