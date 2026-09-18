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
  /** Off, a text-only result ("negative", in `rawValue`) also counts. */
  numericOnly: boolean;
};

const DEFAULT_LATEST_ENTRY_OPTIONS: LatestEntryOptions = { numericOnly: false };

/** Unaliased on purpose; `getLatest` folds a badge's codes at read time. A draw without a reading never wins. */
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

/** Closest on either side, `date` itself excluded (a same-date reading is the caller's); ties go to the earlier date. */
export function nearestEntryTo(
  entries: readonly ResultEntry[],
  loincs: readonly string[],
  date: string,
  { numericOnly }: LatestEntryOptions = DEFAULT_LATEST_ENTRY_OPTIONS,
): ResultEntry | null {
  const anchor = Date.parse(date);
  let current: ResultEntry | null = null;
  let currentDistance = Infinity;
  for (const entry of entries) {
    if (entry.date === date) continue;
    if (!loincs.includes(entry.loinc)) continue;
    if (entry.result.value == null && (numericOnly || !entry.result.rawValue)) continue;
    const distance = Math.abs(Date.parse(entry.date) - anchor);
    if (Number.isNaN(distance)) continue;
    const closer = distance < currentDistance;
    const tieButEarlier = distance === currentDistance && current != null && entry.date < current.date;
    if (closer || tieButEarlier) {
      current = entry;
      currentDistance = distance;
    }
  }
  return current;
}

export function getStatus(latestByLoinc: LatestByLoinc, loincs: string[]): Status {
  const current = getLatest(latestByLoinc, loincs);
  if (!current) return 'never';
  if (!hasReference(current.result)) return 'unknown';
  return isOutOfRange(current.result) ? 'out-of-range' : 'in-range';
}
