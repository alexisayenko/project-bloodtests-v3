/**
 * Column sorting for the Reference Book's LOINC database table. Pure, so the
 * two rules that look like bugs from the outside -- numeric LOINC order and
 * empty cells at the bottom in both directions -- are testable on their own.
 * Also the Reference Book's one other ordering, its list of retrieval dates.
 */

// 'lastTested' ranks on the ISO date behind the cell, never the "Aug 26" and
// lab name it shows -- an ISO date sorts chronologically as plain text.
export type AnalyteSortKey = 'loinc' | 'friendlyName' | 'specimen' | 'unit' | 'lastTested';

export type SortDirection = 'asc' | 'desc';

export type AnalyteSortValues = Record<AnalyteSortKey, string | undefined> & { loinc: string };

// A LOINC code is a number, a hyphen and a check digit, so comparing the whole
// string puts 14913-8 before 2986-8. Only the part before the hyphen ranks.
function compareLoinc(a: string, b: string): number {
  const [aNumber, aCheck = ''] = a.split('-');
  const [bNumber, bCheck = ''] = b.split('-');
  return Number(aNumber) - Number(bNumber) || aCheck.localeCompare(bCheck);
}

/**
 * Ascending or descending within the column, then LOINC as a stable tie-break
 * so equal cells keep one order whichever column was clicked.
 */
export function compareAnalytes(
  a: AnalyteSortValues,
  b: AnalyteSortValues,
  key: AnalyteSortKey,
  direction: SortDirection
): number {
  const left = a[key];
  const right = b[key];
  // An absent cell is not a value that ranks below "A" -- it is a row the
  // column says nothing about, so it sinks to the bottom in both directions.
  if (!left || !right) {
    if (left) return -1;
    if (right) return 1;
    return compareLoinc(a.loinc, b.loinc);
  }
  const within = key === 'loinc' ? compareLoinc(left, right) : left.localeCompare(right);
  if (within === 0) return compareLoinc(a.loinc, b.loinc);
  return direction === 'asc' ? within : -within;
}

export function sortAnalytes<T>(
  rows: readonly T[],
  valuesOf: (row: T) => AnalyteSortValues,
  key: AnalyteSortKey,
  direction: SortDirection
): T[] {
  return [...rows].sort((a, b) => compareAnalytes(valuesOf(a), valuesOf(b), key, direction));
}

/** Each distinct string once, in code-unit order -- which for ISO dates is chronological. */
export function sortedUnique(values: Iterable<string>): string[] {
  return Array.from(new Set(values)).sort((a, b) => (a < b ? -1 : Number(a > b)));
}
