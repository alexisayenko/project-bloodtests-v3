// A calendar month is stored as an ISO `YYYY-MM` key: it sorts
// lexicographically and needs no timezone. Every month label is read off the
// string itself rather than through a Date, so no locale or zone can move it.

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: unknown): value is string {
  return typeof value === 'string' && MONTH_KEY_RE.test(value);
}

/** `monthIndex` is zero-based, as `Date.getMonth()` returns it. */
export function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

export function monthKeyOf(date: Date): string {
  return monthKey(date.getFullYear(), date.getMonth());
}

function labelOf(month: string): string {
  return MONTH_LABELS[Number(month) - 1] ?? month;
}

/** "2026-08-25" (or "2026-08") → "Aug 26". */
export function formatMonthYear(date: string): string {
  const [year, month] = date.split('-');
  return `${labelOf(month)} ${year.slice(-2)}`;
}

/** "2027-03" → "Mar 2027". */
export function formatMonthFullYear(date: string): string {
  const [year, month] = date.split('-');
  return `${labelOf(month)} ${year}`;
}
