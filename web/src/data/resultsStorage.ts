import type { DiagnosticReport, Result } from '../types';

export const RESULTS_STORAGE_KEY = 'bloodtests_upload_v1';

export function hasStoredResults(): boolean {
  try {
    const raw = localStorage.getItem(RESULTS_STORAGE_KEY);
    if (!raw) return false;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0;
  } catch {
    return false;
  }
}

type StoredResult = Result & { analysis?: string; symbol?: string };

/**
 * A stored result as the current shape. Sessions saved before the printed name
 * was renamed carry it as `analysis` (beside an always-empty `symbol`); both are
 * read into `rawName` and dropped, so an existing browser's data keeps loading.
 */
function currentResult(stored: StoredResult): Result {
  const result: StoredResult = { ...stored, rawName: stored.rawName ?? stored.analysis ?? '' };
  delete result.analysis;
  delete result.symbol;
  return result;
}

/** The sessions under RESULTS_STORAGE_KEY, old-shape results included; anything unreadable is no sessions. */
export function parseStoredSessions(raw: string | null): DiagnosticReport[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as DiagnosticReport[]).map((session) => ({
      ...session,
      items: session.items ? (session.items as StoredResult[]).map(currentResult) : session.items,
    }));
  } catch {
    return [];
  }
}
