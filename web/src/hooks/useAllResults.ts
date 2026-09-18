import { useEffect, useMemo, useState } from 'react';
import type { DiagnosticReport, Result } from '../types';
import { latestEntryByLoinc, type ResultEntry } from '../components/conditions/resultsLookup';

export type AllResultsState = {
  allResults: ResultEntry[];
  /** Newest numeric reading per LOINC, unaliased. */
  latestByLoinc: Record<string, ResultEntry>;
  resultsByDate: Record<string, Record<string, Result>>;
};

/** Every session's results flattened into one list, loading the items a session does not carry in memory. */
export function useAllResults(
  sessions: DiagnosticReport[],
  loadGroupItems: (sessionId: string) => Promise<Result[]>
): AllResultsState {
  const [allResults, setAllResults] = useState<ResultEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function buildAllResults() {
      const all: ResultEntry[] = [];
      for (const session of sessions) {
        const items = session.items ?? (await loadGroupItems(session.file));
        for (const item of items) {
          all.push({ loinc: item.loinc, date: session.date, place: session.place, result: item });
        }
      }
      if (!cancelled) setAllResults(all);
    }

    buildAllResults();
    return () => {
      cancelled = true;
    };
  }, [sessions, loadGroupItems]);

  const latestByLoinc = useMemo(() => latestEntryByLoinc(allResults, { numericOnly: true }), [allResults]);

  const resultsByDate = useMemo(() => {
    const map: Record<string, Record<string, Result>> = {};
    for (const { loinc, date, result } of allResults) {
      map[date] ??= {};
      map[date]![loinc] = result;
    }
    return map;
  }, [allResults]);

  return { allResults, latestByLoinc, resultsByDate };
}
