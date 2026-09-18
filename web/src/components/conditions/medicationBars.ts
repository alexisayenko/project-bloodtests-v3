import type { MedicationRow } from '../../data/storage/medications';

/** One drawable span for the What's-in-range medication lane. */
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

/** One bar per contiguous run of months; sorted again here since nothing enforces order on a caller-supplied row. */
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

/** `colorOf` is asked once per row that actually produces a bar, so an empty row never burns a palette slot. */
export function buildMedicationBars(rows: MedicationRow[], colorOf: (index: number) => string): MedicationBar[] {
  let colorIndex = 0;
  return rows
    .filter((row) => row.brand.trim() !== '' && row.months.length > 0)
    .flatMap((row) => rowBars(row, colorOf(colorIndex++)));
}
