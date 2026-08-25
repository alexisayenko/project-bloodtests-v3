import { useMemo, useState } from 'react';
import type { Result } from '../../types';
import { INDEX_DEFS, MARKER_LOINC, type IndexDef } from '../../data/computedIndices';
import { COMPUTED_LOINCS, INDEX_LOINCS, testLoincs, type Observation } from './markers';
import type { Route } from './routing';
import { pressable, visibleDatesOf } from './ui';
import { ControlsBar, type ControlsProps } from './ControlsBar';
import { ObservationTable, IndexTable } from './ResultTables';
import type { ResultEntry } from './resultsLookup';

type DetailTab = 'analysis' | 'in-range';

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
  navigate,
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
  navigate: (r: Route) => void;
}>) {
  const [detailTab, setDetailTab] = useState<DetailTab>('analysis');

  const observations = tests.filter((t) => !INDEX_LOINCS.has(t.loinc));
  const indices = tests.filter((t) => INDEX_LOINCS.has(t.loinc) && !COMPUTED_LOINCS.has(t.loinc));
  const computedForPanel = INDEX_DEFS.filter((d) => d.panels.includes(name));

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
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#999', marginBottom: 20 }}>
        <span {...pressable(() => navigate({ view: 'panels' }))} style={{ color: '#1971c2', cursor: 'pointer' }}>
          Monitoring Panels
        </span>
        <span>›</span>
        <span {...pressable(() => setDetailTab('analysis'))} style={{ color: '#1971c2', cursor: 'pointer' }}>
          {name}
        </span>
        <span>›</span>
        <span>{detailTab === 'analysis' ? 'Analysis' : "What's in range"}</span>
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 24 }}>{name}</h1>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1.5px solid #eee', marginBottom: 24 }}>
        {(['analysis', 'in-range'] as const).map((tab) => (
          <div
            key={tab}
            {...pressable(() => setDetailTab(tab))}
            style={{
              padding: '10px 4px',
              marginBottom: -2,
              borderBottom: detailTab === tab ? '2px solid #1971c2' : '2px solid transparent',
              fontWeight: detailTab === tab ? 600 : 400,
              color: detailTab === tab ? '#1971c2' : '#555',
              cursor: 'pointer',
            }}
          >
            {tab === 'analysis' ? 'Analysis' : "What's in range"}
          </div>
        ))}
      </div>

      {detailTab === 'analysis' ? (
        <div>
          <ControlsBar {...controls} />
          {dates.length === 0 ? (
            <div style={{ color: '#888', fontSize: 14 }}>No results recorded for this panel yet.</div>
          ) : (
            <>
              <ObservationTable label="Observations" rows={observations} {...tableProps} />
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
                    />
                  )}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div style={{ color: '#888', fontSize: 14 }}>Coming soon.</div>
      )}
    </>
  );
}
