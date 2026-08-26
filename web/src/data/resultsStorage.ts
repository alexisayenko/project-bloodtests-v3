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
