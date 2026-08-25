import { useMemo } from 'react';
import { useLang } from '../../i18n/LangContext';
import { useResultsContext } from '../../data/ResultsContext';
import { BiomarkerChart } from './BiomarkerChart';
import type { Result } from '../../types';

interface LoincEntry {
  loinc: string;
  results: { date: string; result: Result }[];
}

export function AnalyticsPage() {
  const { t } = useLang();
  const { sessions, loading } = useResultsContext();

  const byLoinc = useMemo(() => {
    const map = new Map<string, { date: string; result: Result }[]>();
    for (const session of sessions) {
      for (const result of session.items || []) {
        if (!result.loinc) continue;
        if (!map.has(result.loinc)) map.set(result.loinc, []);
        map.get(result.loinc)!.push({ date: session.date, result });
      }
    }
    return Array.from(map.entries())
      .map(([loinc, results]): LoincEntry => ({ loinc, results }))
      .filter(e => e.results.length > 1)
      .sort((a, b) => b.results.length - a.results.length);
  }, [sessions]);

  if (loading) return <div className="loading">Loading...</div>;
  if (byLoinc.length === 0) return <div className="empty-state">{t('noResults')}</div>;

  return (
    <div>
      <h2 className="section-title">{t('navAnalytics')}</h2>
      <div className="card-list">
        {byLoinc.map(e => (
          <BiomarkerChart key={e.loinc} loinc={e.loinc} results={e.results} />
        ))}
      </div>
    </div>
  );
}
