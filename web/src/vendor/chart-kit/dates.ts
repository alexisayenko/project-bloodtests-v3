/** Date formatters for tooltip headers and the adaptive time axis. */

export const MON = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** 2026-06-25 */
export function isoDate(sec: number): string {
  return new Date(sec * 1000).toISOString().slice(0, 10);
}

/** Jun 2026 */
export function monthYear(sec: number): string {
  const d = new Date(sec * 1000);
  return MON[d.getUTCMonth()] + " " + d.getUTCFullYear();
}
