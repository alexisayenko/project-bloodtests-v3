import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import type { Result, DiagnosticReport } from '../types';
import { UploadParseError } from './parseUpload';
import {
  fetchSharedDataOnce,
  isAlreadyImported,
  markImported,
  readSharedDataGuid,
  stripDataParam,
} from './sharedLink';
import { RESULTS_STORAGE_KEY as STORAGE_KEY } from './resultsStorage';
import { importResults } from './importResults';
import { loadStoredSharedMeta, storeSharedMeta, type SharedMeta } from './sharedMeta';

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

function adaptDevData(sessions: DevRawSession[]): DiagnosticReport[] {
  return sessions
    .map((s): DiagnosticReport => {
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
  sessions: DiagnosticReport[];
  hasData: boolean;
  loading: boolean;
  error: string | null;
  sharedLinkError: string | null;
  sharedMeta: SharedMeta | null;
  uploadFile: (file: File) => Promise<void>;
  loadGenerated: (groups: DiagnosticReport[]) => void;
  loadGroupItems: (sessionId: string) => Promise<Result[]>;
  updateGroup: (file: string, updatedGroup: DiagnosticReport) => void;
  clearData: () => void;
}

const ResultsContext = createContext<ResultsContextType>(null!);

export function ResultsProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [sessions, setSessions] = useState<DiagnosticReport[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // corrupt/incompatible local storage — ignore and start fresh
    }
    return [];
  });
  // Loading is only ever true while the dev-only seed fetch is in flight —
  // localStorage loads synchronously in the useState initializer above.
  const [loading, setLoading] = useState(() => import.meta.env.DEV && sessions.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [sharedLinkError, setSharedLinkError] = useState<string | null>(null);
  const [sharedMeta, setSharedMeta] = useState<SharedMeta | null>(loadStoredSharedMeta);

  useEffect(() => {
    if (!loading) return;

    fetch('/dev-data/bloodtests.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: DevRawSession[] | null) => {
        if (data) setSessions(adaptDevData(data));
      })
      .catch(() => {
        // no dev-data file present — fine, just nothing to seed
      })
      .finally(() => setLoading(false));
  }, [loading]);

  // Merge incoming sessions into what's already loaded (an incoming session
  // replaces an existing one with the same `file` id) — generated test data
  // adds to whatever is there rather than clobbering it.
  const mergeSessions = useCallback((incoming: DiagnosticReport[]) => {
    setSessions((prev) => {
      const byFile = new Map(prev.map((g) => [g.file, g]));
      for (const g of incoming) byFile.set(g.file, g);
      const merged = Array.from(byFile.values()).sort((a, b) => b.date.localeCompare(a.date));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  // Read-only share link: ?data=<guid> pulls /d/<guid>.data.json through the
  // same parse+replace path as an upload, so it persists and works offline
  // afterwards, plus an optional /d/<guid>.meta.json presentation config.
  useEffect(() => {
    const guid = readSharedDataGuid(window.location.search);
    if (!guid) return;
    if (isAlreadyImported(guid)) {
      stripDataParam();
      return;
    }

    // `cancelled` only suppresses state updates after unmount — the import
    // itself (parse, persist, mark) always completes, so StrictMode's
    // mount/unmount/mount cycle can't drop an already-fetched result.
    let cancelled = false;
    fetchSharedDataOnce(guid)
      .then(({ data, meta }) => {
        if (!isAlreadyImported(guid)) {
          setSessions(importResults(data));
          markImported(guid);
        }
        if (meta) {
          storeSharedMeta(meta);
          setSharedMeta(meta);
        }
        stripDataParam();
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setSharedLinkError(
            e instanceof UploadParseError ? e.message : 'Could not load the shared data link.'
          );
        }
      });

    return () => {
      cancelled = true;
    };
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
      setSessions(importResults(json));
    } catch (e) {
      setError(e instanceof UploadParseError ? e.message : 'Could not read that file.');
    }
  }, []);

  // Synthetic data (e.g. Profile's "Generate Test Data") — persisted exactly
  // like a real upload, so the rest of the app can't tell the difference.
  const loadGenerated = useCallback((groups: DiagnosticReport[]) => {
    setError(null);
    mergeSessions(groups);
  }, [mergeSessions]);

  const loadGroupItems = useCallback(async (sessionId: string): Promise<Result[]> => {
    return sessions.find(s => s.file === sessionId)?.items || [];
  }, [sessions]);

  const updateGroup = useCallback((file: string, updatedGroup: DiagnosticReport) => {
    setSessions((prev) => {
      const updated = prev.map((g) => (g.file === file ? updatedGroup : g));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearData = useCallback(() => {
    setSessions([]);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(
    () => ({ sessions, hasData: sessions.length > 0, loading, error, sharedLinkError, sharedMeta, uploadFile, loadGenerated, loadGroupItems, updateGroup, clearData }),
    [sessions, loading, error, sharedLinkError, sharedMeta, uploadFile, loadGenerated, loadGroupItems, updateGroup, clearData]
  );

  return (
    <ResultsContext.Provider value={value}>
      {children}
    </ResultsContext.Provider>
  );
}

export function useResultsContext() {
  return useContext(ResultsContext);
}
