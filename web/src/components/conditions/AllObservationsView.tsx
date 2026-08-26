import { useMemo } from 'react';
import type { Analysis } from '../../types';
import { ALIAS_TO_PRIMARY, ALSO_REFS, SHORT_LABELS, type Observation } from './markers';
import { ControlsBar, type ControlsProps } from './ControlsBar';
import { visibleDatesOf, type SelectedCell } from './ui';
import { ObservationTable } from './ResultTables';
import type { ResultEntry } from './resultsLookup';

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
  analysesCatalog,
  controls,
  selectedLoinc,
  onSelect,
  onOpenPopup,
  selectedCell,
  onSelectCell,
  onOpenResultPopup,
}: Readonly<{
  allResults: ResultEntry[];
  analysesCatalog: Record<string, Analysis>;
  controls: ControlsProps;
  selectedLoinc: string | null;
  onSelect: (loinc: string) => void;
  onOpenPopup: (test: Observation, e: { currentTarget: HTMLElement }) => void;
  selectedCell: SelectedCell;
  onSelectCell: (loinc: string, date: string) => void;
  onOpenResultPopup: (test: Observation, entry: ResultEntry, e: { currentTarget: HTMLElement }) => void;
}>) {
  const rows = useMemo(() => buildRows(allResults, analysesCatalog), [allResults, analysesCatalog]);
  const sortedDates = useMemo(
    () => Array.from(new Set(allResults.map((r) => r.date))).sort((a, b) => b.localeCompare(a)),
    [allResults]
  );
  const allDates = visibleDatesOf(sortedDates, controls.sampleLimit, controls.dateOrder);

  return (
    <>
      <h1 style={{ fontSize: 28, fontWeight: 600, marginBottom: 24 }}>All Observations</h1>
      {rows.length === 0 ? (
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
      )}
    </>
  );
}
