import { useMemo, useState } from 'react';
import type { Analysis, Result } from '../../types';
import { ALIAS_TO_PRIMARY, ALSO_REFS, SHORT_LABELS, type Observation } from './markers';
import { ControlsBar, type ControlsProps } from './ControlsBar';
import { pressable, visibleDatesOf, type SelectedCell } from './ui';
import { ObservationTable } from './ResultTables';
import { LabExploreView } from './LabExploreView';
import type { Condition } from './exploreModel';
import type { ResultEntry } from './resultsLookup';

type ObservationsTab = 'analysis' | 'in-range';

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

export function AllObservationsView({
  allResults,
  /** Every panel's tests, for the "What's in range" tab's own cross-panel marker picker. */
  conditions,
  analysesCatalog,
  controls,
  selectedLoinc,
  onSelect,
  onOpenPopup,
  selectedCell,
  onSelectCell,
  onOpenResultPopup,
  resultsByDate,
}: Readonly<{
  allResults: ResultEntry[];
  conditions: Condition[];
  analysesCatalog: Record<string, Analysis>;
  controls: ControlsProps;
  selectedLoinc: string | null;
  onSelect: (loinc: string) => void;
  onOpenPopup: (test: Observation, e: { currentTarget: HTMLElement }) => void;
  selectedCell: SelectedCell;
  onSelectCell: (loinc: string, date: string) => void;
  onOpenResultPopup: (test: Observation, entry: ResultEntry, e: { currentTarget: HTMLElement }) => void;
  /**
   * Per-date observation lookup, so the "What's in range" tab's picker can
   * also build computed-index markers -- passed through to LabExploreView
   * WITHOUT a currentPanel, which is what fans each index out across all of
   * its own declared panels instead of scoping to just one (see
   * buildExploreModel's doc comment).
   */
  resultsByDate: Record<string, Record<string, Result>>;
}>) {
  const [tab, setTab] = useState<ObservationsTab>('analysis');

  const rows = useMemo(() => buildRows(allResults, analysesCatalog), [allResults, analysesCatalog]);
  const sortedDates = useMemo(
    () => Array.from(new Set(allResults.map((r) => r.date))).sort((a, b) => b.localeCompare(a)),
    [allResults]
  );
  const allDates = visibleDatesOf(sortedDates, controls.sampleLimit, controls.dateOrder);

  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 24 }}>All Observations</h1>
      <div style={{ display: 'flex', gap: 8, borderBottom: '1.5px solid #eee', marginBottom: 24 }}>
        {(['analysis', 'in-range'] as const).map((t) => (
          <div
            key={t}
            {...pressable(() => setTab(t))}
            style={{
              padding: '10px 4px',
              marginBottom: -2,
              borderBottom: tab === t ? '2px solid #1971c2' : '2px solid transparent',
              // Faux-bold via text-shadow, not fontWeight -- see NavBar.tsx's comment:
              // a real weight change reflows neighboring tabs by a px on switch.
              textShadow: tab === t ? '0.3px 0 currentColor, -0.3px 0 currentColor' : 'none',
              color: tab === t ? '#1971c2' : '#555',
              cursor: 'pointer',
            }}
          >
            {t === 'analysis' ? 'Analysis' : "What's in range"}
          </div>
        ))}
      </div>

      {tab === 'analysis' ? (
        rows.length === 0 ? (
          <div style={{ color: '#888', fontSize: 14 }}>No results uploaded yet.</div>
        ) : (
          <>
            <div style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
              {rows.length} observations across {sortedDates.length} lab reports
            </div>
            <ControlsBar {...controls} />
            <ObservationTable
              label="Observations"
              rows={rows}
              visibleDates={allDates}
              allResults={allResults}
              unitSystem={controls.unitSystem}
              selectedLoinc={selectedLoinc}
              onSelect={onSelect}
              onOpenPopup={onOpenPopup}
              selectedCell={selectedCell}
              onSelectCell={onSelectCell}
              onOpenResultPopup={onOpenResultPopup}
              preferRaw
            />
          </>
        )
      ) : (
        <LabExploreView
          conditions={conditions}
          allResults={allResults}
          unitSystem={controls.unitSystem}
          resultsByDate={resultsByDate}
        />
      )}
    </>
  );
}
