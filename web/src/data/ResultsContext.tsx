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
import { RESULTS_STORAGE_KEY as STORAGE_KEY, parseStoredSessions } from './storage/resultsStorage';
import { importResults } from './importResults';
import { applySharedMeta, clearSharedMeta, loadStoredSharedMeta, type SharedMeta } from './sharedMeta';

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
      return parseStoredSessions(localStorage.getItem(STORAGE_KEY));
    } catch {
      return [];
    }
  });
  const loading = false;
  const [error, setError] = useState<string | null>(null);
  const [sharedLinkError, setSharedLinkError] = useState<string | null>(null);
  const [sharedMeta, setSharedMeta] = useState<SharedMeta | null>(loadStoredSharedMeta);

  // An incoming session replaces an existing one with the same `file` id.
  const mergeSessions = useCallback((incoming: DiagnosticReport[]) => {
    setSessions((prev) => {
      const byFile = new Map(prev.map((g) => [g.file, g]));
      for (const g of incoming) byFile.set(g.file, g);
      const merged = Array.from(byFile.values()).sort((a, b) => b.date.localeCompare(a.date));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  // Share link: imported through the same replace path as an upload.
  useEffect(() => {
    const guid = readSharedDataGuid(window.location.search);
    if (!guid) return;
    if (isAlreadyImported(guid)) {
      stripDataParam();
      return;
    }

    // `cancelled` only suppresses the error state; the import itself always
    // completes, so StrictMode's remount can't drop a fetched result.
    let cancelled = false;
    fetchSharedDataOnce(guid)
      .then(({ data, meta }) => {
        if (!isAlreadyImported(guid)) {
          setSessions(importResults(data));
          markImported(guid);
        }
        applySharedMeta(meta);
        setSharedMeta(meta);
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
      // A replacing import leaves a share link's meta nothing to belong to.
      clearSharedMeta();
      setSharedMeta(null);
    } catch (e) {
      setError(e instanceof UploadParseError ? e.message : 'Could not read that file.');
    }
  }, []);

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
    clearSharedMeta();
    setSharedMeta(null);
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
