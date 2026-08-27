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
  // localStorage loads synchronously in the useState initializer above,
  // so there is nothing to wait for.
  const loading = false;
  const [error, setError] = useState<string | null>(null);
  const [sharedLinkError, setSharedLinkError] = useState<string | null>(null);
  const [sharedMeta, setSharedMeta] = useState<SharedMeta | null>(loadStoredSharedMeta);

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
