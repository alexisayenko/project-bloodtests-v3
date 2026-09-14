import file from '../../public/data/martin-hopkins-ldl-table.json';

/**
 * The Martin/Hopkins 180-cell median TG:VLDL-C factor table (Martin SS et al
 * 2013 JAMA 310(19):2061-2068), read from `martin-hopkins-ldl-table.json`
 * (ADR-0010/ADR-0011: a lookup table this size is reference data, never
 * hand-typed into TypeScript). `computedIndices.ts`'s `ldlmh` fn (via
 * `indexDefs.ts`) is the only caller.
 */

export interface MartinHopkinsBand {
  low?: number;
  high?: number;
}

export interface MartinHopkinsRow {
  trigLow: number;
  trigHigh: number;
  factors: number[];
}

export interface MartinHopkinsSource {
  id: string;
  organization: string;
  title: string;
  year?: number;
  url: string;
  doi?: string;
  retrieved: string;
  quote: string;
}

interface MartinHopkinsFile {
  unit: string;
  nonHdlBands: MartinHopkinsBand[];
  rows: MartinHopkinsRow[];
  sources: MartinHopkinsSource[];
}

const data = file as MartinHopkinsFile;

export const MARTIN_HOPKINS_UNIT: string = data.unit;
export const MARTIN_HOPKINS_NON_HDL_BANDS: readonly MartinHopkinsBand[] = data.nonHdlBands;
export const MARTIN_HOPKINS_ROWS: readonly MartinHopkinsRow[] = data.rows;
export const MARTIN_HOPKINS_SOURCES: readonly MartinHopkinsSource[] = data.sources;

const inBand = (value: number, band: MartinHopkinsBand): boolean =>
  (band.low === undefined || value >= band.low) && (band.high === undefined || value <= band.high);

/**
 * The table's column index for this non-HDL-C value (mg/dL), rounded to the
 * nearest whole mg/dL the way the table's own strata are labelled. Always
 * defined -- the 6 bands cover the whole range, from '<100' to '>=220'.
 */
function nonHdlColumn(nonHdlMgDl: number): number {
  const rounded = Math.round(nonHdlMgDl);
  const idx = MARTIN_HOPKINS_NON_HDL_BANDS.findIndex((b) => inBand(rounded, b));
  // The last band is open above ('>=220'), so this is unreachable for a finite input.
  return idx === -1 ? MARTIN_HOPKINS_NON_HDL_BANDS.length - 1 : idx;
}

/**
 * The table's median TG:VLDL-C factor for this (non-HDL-C, triglycerides)
 * pair, both mg/dL -- or undefined when the triglyceride value falls outside
 * the table's covered range (below 7 or above 13975 mg/dL), so the caller
 * returns null rather than a value from a row that does not exist.
 */
export function martinHopkinsFactor(nonHdlMgDl: number, trigMgDl: number): number | undefined {
  const trig = Math.round(trigMgDl);
  const row = MARTIN_HOPKINS_ROWS.find((r) => trig >= r.trigLow && trig <= r.trigHigh);
  if (!row) return undefined;
  return row.factors[nonHdlColumn(nonHdlMgDl)];
}
