import type { ResultGroup } from '../types';
import { parseUploadedResults } from './parseUpload';
import { RESULTS_STORAGE_KEY } from './resultsStorage';

export function replaceStoredSessions(incoming: ResultGroup[]): ResultGroup[] {
  const sessions = [...incoming].sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(sessions));
  return sessions;
}

// Imported JSON replaces everything stored: a throwing parse leaves the
// previous sessions untouched, a successful one wipes them.
export function importResults(json: unknown): ResultGroup[] {
  return replaceStoredSessions(parseUploadedResults(json));
}
