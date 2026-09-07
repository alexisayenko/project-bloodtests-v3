import { useMemo } from 'react';
import { testLoincs, type Observation } from '../conditions/markers';
import type { ResultEntry } from '../conditions/resultsLookup';
import type { BiomarkerNames, LoincEntry } from './BiomarkerCharts';
import { StackedBiomarkerSection } from './StackedBiomarkerSection';
import { MAX_SERIES } from './StackedBiomarkerChart3D';

interface Props {
  tests: Observation[];
  allResults: ResultEntry[];
}

type NameKey = 'full' | 'short';

const named = (test: Observation, primary: NameKey, fallback: NameKey) =>
  [test[primary], test[fallback]].find(v => v && v !== test.loinc);

export function PanelChartsView({ tests, allResults }: Readonly<Props>) {
  const names = useMemo<BiomarkerNames>(() => {
    const testByLoinc = new Map(tests.flatMap(t => testLoincs(t).map(l => [l, t] as const)));
    return {
      full: l => { const t = testByLoinc.get(l); return t && named(t, 'full', 'short'); },
      short: l => { const t = testByLoinc.get(l); return t && named(t, 'short', 'full'); },
    };
  }, [tests]);

  const byLoinc = useMemo(() => {
    return tests
      .map((test): LoincEntry => {
        const codes = new Set(testLoincs(test));
        const byDate = new Map<string, ResultEntry>();
        for (const entry of allResults) {
          if (!codes.has(entry.loinc)) continue;
          const prev = byDate.get(entry.date);
          if (!prev || (prev.loinc !== test.loinc && entry.loinc === test.loinc)) byDate.set(entry.date, entry);
        }
        return {
          loinc: test.loinc,
          results: Array.from(byDate.values())
            .map(({ date, result }) => ({ date, result }))
            .sort((a, b) => a.date.localeCompare(b.date)),
        };
      })
      .filter(e => e.results.length > 1)
      .sort((a, b) => b.results.length - a.results.length);
  }, [tests, allResults]);

  if (byLoinc.length === 0) {
    return <div className="empty-state">No charts yet — this panel needs at least two samplings of a marker.</div>;
  }

  return <StackedBiomarkerSection entries={byLoinc} defaultSelectionCount={MAX_SERIES} names={names} />;
}
