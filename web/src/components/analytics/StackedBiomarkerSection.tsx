import { useMemo, useState } from 'react';
import { useLang } from '../../i18n/LangContext';
import { useData } from '../../data/DataContext';
import { getAnalysisName } from '../../utils/analysis';
import { StackedBiomarkerChart3D, type StackedEntry } from './StackedBiomarkerChart3D';
import { MAX_SERIES } from './palette';
import type { BiomarkerNames, LoincEntry } from './types';

// How many biomarkers the 3D view starts with before the user has touched
// the picker -- entries are expected sorted by point count descending, so
// this is "the N biomarkers with the most history", a reasonable default
// rather than an empty chart on first visit.
const DEFAULT_SELECTION_COUNT = 4;

// Selection is an ordered map loinc -> palette slot: a biomarker keeps its
// slot until unchecked, and a newly checked one takes the lowest free slot,
// so toggling one series never recolors the others.
type Selection = Map<string, number>;

const lowestFreeColorIndex = (selection: Selection) => {
  const used = new Set(selection.values());
  let index = 0;
  while (used.has(index)) index += 1;
  return index;
};

interface Props {
  entries: LoincEntry[];
  defaultSelectionCount?: number;
  names?: BiomarkerNames;
}

export function StackedBiomarkerSection({ entries, defaultSelectionCount = DEFAULT_SELECTION_COUNT, names }: Readonly<Props>) {
  const { lang } = useLang();
  const { analysesCatalog } = useData();
  const [selection, setSelection] = useState<Selection | null>(null);

  const defaultSelection = useMemo<Selection>(
    () => new Map(entries.slice(0, defaultSelectionCount).map((e, i) => [e.loinc, i])),
    [entries, defaultSelectionCount],
  );
  const activeSelection = selection ?? defaultSelection;
  const atCap = activeSelection.size >= MAX_SERIES;

  const selectedEntries = useMemo<StackedEntry[]>(
    () => entries
      .filter(e => activeSelection.has(e.loinc))
      .map(e => ({ ...e, colorIndex: activeSelection.get(e.loinc)! })),
    [entries, activeSelection],
  );

  const toggleLoinc = (loinc: string) => {
    setSelection(prev => {
      const base = prev ?? defaultSelection;
      const next = new Map(base);
      if (next.has(loinc)) {
        next.delete(loinc);
      } else {
        if (next.size >= MAX_SERIES) return base;
        next.set(loinc, lowestFreeColorIndex(next));
      }
      return next;
    });
  };

  return (
    <div>
      <StackedBiomarkerChart3D entries={selectedEntries} nameFor={names?.short} />
      <div className="biomarker-picker">
        {entries.map(e => {
          const checked = activeSelection.has(e.loinc);
          return (
            <label key={e.loinc} className="biomarker-picker-item">
              <input
                type="checkbox"
                checked={checked}
                disabled={atCap && !checked}
                onChange={() => toggleLoinc(e.loinc)}
              />
              {names?.full(e.loinc) ?? getAnalysisName(e.loinc, analysesCatalog, lang)}
            </label>
          );
        })}
        {atCap && (
          <span className="biomarker-picker-hint">Up to {MAX_SERIES} biomarkers at a time</span>
        )}
      </div>
    </div>
  );
}
