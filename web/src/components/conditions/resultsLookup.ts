import type { Result } from '../../types';
import { isOutOfRange } from '../../utils/format';

/** One uploaded result together with the session date and lab it came from. */
export type ResultEntry = { loinc: string; date: string; place: string; result: Result };

/** Latest result per LOINC: { loinc: { result, date } }. */
export type LatestByLoinc = Record<string, { result: Result; date: string }>;

export type Status = 'never' | 'in-range' | 'out-of-range' | 'unknown';

export function hasReference(r: Result): boolean {
  return r.value != null && (r.refMin != null || r.refMax != null);
}

/** The newest result across any of the given LOINCs (a badge plus its also-refs). */
export function getLatest(latestByLoinc: LatestByLoinc, loincs: string[]): { result: Result; date: string } | null {
  let current: { result: Result; date: string } | null = null;
  for (const loinc of loincs) {
    const candidate = latestByLoinc[loinc];
    if (candidate && (!current || candidate.date > current.date)) current = candidate;
  }
  return current;
}

export type LatestEntryOptions = {
  /**
   * Only a numeric `value` counts as a reading. Off, a text-only result
   * ("negative", printed in `rawValue`) also counts.
   */
  numericOnly: boolean;
};

const DEFAULT_LATEST_ENTRY_OPTIONS: LatestEntryOptions = { numericOnly: false };

/**
 * The newest entry recorded under each LOINC exactly as the lab printed it —
 * deliberately not folded through the alias maps; `getLatest` folds a badge's
 * codes at read time instead. A draw that lists a marker without a reading is
 * not a test, so it never wins the slot. On a date tie the first entry stays.
 */
export function latestEntryByLoinc(
  entries: readonly ResultEntry[],
  { numericOnly }: LatestEntryOptions = DEFAULT_LATEST_ENTRY_OPTIONS,
): Record<string, ResultEntry> {
  const map: Record<string, ResultEntry> = {};
  for (const entry of entries) {
    if (entry.result.value == null && (numericOnly || !entry.result.rawValue)) continue;
    const existing = map[entry.loinc];
    if (!existing || entry.date > existing.date) map[entry.loinc] = entry;
  }
  return map;
}

export function getStatus(latestByLoinc: LatestByLoinc, loincs: string[]): Status {
  const current = getLatest(latestByLoinc, loincs);
  if (!current) return 'never';
  if (!hasReference(current.result)) return 'unknown';
  return isOutOfRange(current.result) ? 'out-of-range' : 'in-range';
}
