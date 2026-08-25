import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { Result, ResultGroup } from '../types';
import { parseUploadedResults, UploadParseError } from './parseUpload';

const STORAGE_KEY = 'bloodtests_upload_v1';

interface ResultsContextType {
  sessions: ResultGroup[];
  hasData: boolean;
  loading: boolean;
  error: string | null;
  uploadFile: (file: File) => Promise<void>;
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
      if (raw) setSessions(JSON.parse(raw));
    } catch {
      // corrupt/incompatible local storage — ignore and start fresh
    }
    setLoading(false);
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
      const groups = parseUploadedResults(json);
      setSessions(groups);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
    } catch (e) {
      setError(e instanceof UploadParseError ? e.message : 'Could not read that file.');
    }
  }, []);

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
      value={{ sessions, hasData: sessions.length > 0, loading, error, uploadFile, loadGroupItems, clearData }}
    >
      {children}
    </ResultsContext.Provider>
  );
}

export function useResultsContext() {
  return useContext(ResultsContext);
}
