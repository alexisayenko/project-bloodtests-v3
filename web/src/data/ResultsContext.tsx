import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Result, ResultGroup } from '../types';
import { parseUploadedResults, UploadParseError } from './parseUpload';

const STORAGE_KEY = 'bloodtests_upload_v1';

// Dev-only seed: web/dev-data/*.json is served exclusively by vite.config.ts's
// dev-only plugin (never present in a production build). It's a personal
// export in a different shape than what uploadFile()/parseUpload.ts accept
// (each item's value/unit live under `original`, not flat), so it's adapted
// here rather than widening the real upload parser to a one-off shape. It's
// only ever held in memory (never localStorage) — a real upload always wins.
type DevRawItem = {
  loinc?: string;
  analysis?: string;
  symbol?: string;
  method?: string | null;
  original?: { value: number | null; rawValue: string; unit: string; refMin?: number | null; refMax?: number | null; refText?: string };
};
type DevRawSession = { date: string; labName?: string; sourceFile?: string; items: DevRawItem[] };

function adaptDevData(sessions: DevRawSession[]): ResultGroup[] {
  return sessions
    .map((s): ResultGroup => {
      const items: Result[] = (s.items || [])
        .filter((raw) => raw.loinc && raw.original)
        .map((raw) => ({
          loinc: raw.loinc!,
          analysis: raw.analysis || '',
          symbol: raw.symbol || '',
          section: '',
          value: raw.original!.value,
          rawValue: raw.original!.rawValue || '',
          valueQualifier: '',
          unit: raw.original!.unit || '',
          refText: raw.original!.refText || '',
          refMin: raw.original!.refMin ?? null,
          refMax: raw.original!.refMax ?? null,
          method: raw.method || '',
        }));
      return { date: s.date, place: s.labName || '', file: `dev__${s.date}`, items, itemCount: items.length };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

interface ResultsContextType {
  sessions: ResultGroup[];
  hasData: boolean;
  loading: boolean;
  error: string | null;
  uploadFile: (file: File) => Promise<void>;
  loadGenerated: (groups: ResultGroup[]) => void;
  loadGroupItems: (sessionId: string) => Promise<Result[]>;
  clearData: () => void;
}

const ResultsContext = createContext<ResultsContextType>(null!);

export function ResultsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<ResultGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSessions(JSON.parse(raw));
        setLoading(false);
        return;
      }
    } catch {
      // corrupt/incompatible local storage — ignore and start fresh
    }

    if (import.meta.env.DEV) {
      fetch('/dev-data/bloodtests.json')
        .then((r) => (r.ok ? r.json() : null))
        .then((data: DevRawSession[] | null) => {
          if (data) setSessions(adaptDevData(data));
        })
        .catch(() => {
          // no dev-data file present — fine, just nothing to seed
        })
        .finally(() => setLoading(false));
      return;
    }

    setLoading(false);
  }, []);

  // Merge incoming sessions into what's already loaded (an incoming session
  // replaces an existing one with the same `file` id), so uploaded JSON and
  // generated test data can coexist instead of clobbering each other.
  const mergeSessions = useCallback((incoming: ResultGroup[]) => {
    setSessions((prev) => {
      const byFile = new Map(prev.map((g) => [g.file, g]));
      for (const g of incoming) byFile.set(g.file, g);
      const merged = Array.from(byFile.values()).sort((a, b) => b.date.localeCompare(a.date));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  const uploadFile = useCallback(async (file: File) => {
    setError(null);

    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setError('That file is not valid JSON.');
      return;
    }

    try {
      mergeSessions(parseUploadedResults(json));
    } catch (e) {
      setError(e instanceof UploadParseError ? e.message : 'Could not read that file.');
    }
  }, [mergeSessions]);

  // Synthetic data (e.g. Profile's "Generate Test Data") — persisted exactly
  // like a real upload, so the rest of the app can't tell the difference.
  const loadGenerated = useCallback((groups: ResultGroup[]) => {
    setError(null);
    mergeSessions(groups);
  }, [mergeSessions]);

  const loadGroupItems = useCallback(async (sessionId: string): Promise<Result[]> => {
    return sessions.find(s => s.file === sessionId)?.items || [];
  }, [sessions]);

  const clearData = useCallback(() => {
    setSessions([]);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <ResultsContext.Provider
      value={{ sessions, hasData: sessions.length > 0, loading, error, uploadFile, loadGenerated, loadGroupItems, clearData }}
    >
      {children}
    </ResultsContext.Provider>
  );
}

export function useResultsContext() {
  return useContext(ResultsContext);
}
