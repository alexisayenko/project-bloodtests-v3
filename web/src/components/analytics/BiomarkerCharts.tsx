import { useState } from 'react';
import { BiomarkerChart } from './BiomarkerChart';
import { StackedBiomarkerSection } from './StackedBiomarkerSection';
import type { Result } from '../../types';

export interface LoincEntry {
  loinc: string;
  results: { date: string; result: Result }[];
}

export interface BiomarkerNames {
  full: (loinc: string) => string | undefined;
  short: (loinc: string) => string | undefined;
}

type ChartsView = 'list' | '3d';

interface Props {
  entries: LoincEntry[];
  defaultSelectionCount?: number;
  names?: BiomarkerNames;
}

export function BiomarkerCharts({ entries, defaultSelectionCount, names }: Readonly<Props>) {
  const [view, setView] = useState<ChartsView>('list');

  return (
    <div>
      <div className="analytics-view-toggle">
        <button
          type="button"
          className={view === 'list' ? 'analytics-view-tab active' : 'analytics-view-tab'}
          onClick={() => setView('list')}
        >
          List
        </button>
        <button
          type="button"
          className={view === '3d' ? 'analytics-view-tab active' : 'analytics-view-tab'}
          onClick={() => setView('3d')}
        >
          Compare in 3D
        </button>
      </div>
      {view === 'list' ? (
        <div className="card-list">
          {entries.map(e => (
            <BiomarkerChart key={e.loinc} loinc={e.loinc} results={e.results} title={names?.full(e.loinc)} />
          ))}
        </div>
      ) : (
        <StackedBiomarkerSection entries={entries} defaultSelectionCount={defaultSelectionCount} names={names} />
      )}
    </div>
  );
}
