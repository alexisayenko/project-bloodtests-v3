import type { MedicationRow } from '../../data/medications';

/** One drawable span for the What's-in-range medication lane (task-0053). */
export type MedicationBar = {
  id: string;
  brand: string;
  detail: string;
  color: string;
  /** epoch seconds, UTC -- same convention lab-explore.ts's ts() uses for its own series */
  startTs: number;
  endTs: number;
};

function monthIndex(month: string): number {
  const [year, mon] = month.split('-').map(Number);
  return year * 12 + (mon - 1);
}

function monthStartTs(index: number): number {
  const year = Math.floor(index / 12);
  const mon = index % 12;
  return Date.UTC(year, mon, 1) / 1000;
}

function compoundsLine(row: MedicationRow): string {
  return row.compounds
    .map((c) => `${c.name} ${c.dose}`.trim())
    .filter(Boolean)
    .join(', ');
}

/**
 * One bar per contiguous run of taken months in one row -- a course stopped
 * and later resumed draws as two separate bars rather than one spanning the
 * gap. `months` is read already sorted (toggleMonth/parseRow keep it that
 * way) but sorted again here defensively since nothing enforces that on a
 * caller-supplied row.
 */
function rowBars(row: MedicationRow, color: string): MedicationBar[] {
  const months = [...row.months].sort((a, b) => a.localeCompare(b));
  const detail = compoundsLine(row);
  const bars: MedicationBar[] = [];
  let segment = 0;
  let runStart = monthIndex(months[0]!);
  let prev = runStart;
  const flush = (endIndex: number) => {
    bars.push({
      id: `${row.id}:${segment++}`,
      brand: row.brand,
      detail,
      color,
      startTs: monthStartTs(runStart),
      endTs: monthStartTs(endIndex + 1),
    });
  };
  for (let i = 1; i < months.length; i++) {
    const idx = monthIndex(months[i]!);
    if (idx !== prev + 1) {
      flush(prev);
      runStart = idx;
    }
    prev = idx;
  }
  flush(prev);
  return bars;
}

/**
 * Bars for the What's-in-range medication lane -- one entry per named
 * medication row with at least one taken month, in `rows`' own order (the
 * Medications page's row order). `colorOf` is asked for a color once per
 * row that actually produces a bar, so an unnamed or never-taken row (which
 * MedicationsView itself never persists/shows once unnamed, but a caller
 * could still pass one) never burns a palette slot.
 */
export function buildMedicationBars(rows: MedicationRow[], colorOf: (index: number) => string): MedicationBar[] {
  let colorIndex = 0;
  return rows
    .filter((row) => row.brand.trim() !== '' && row.months.length > 0)
    .flatMap((row) => rowBars(row, colorOf(colorIndex++)));
}
