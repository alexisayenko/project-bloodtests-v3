import file from '../../public/data/martin-hopkins-ldl-table.json';

// The Martin/Hopkins 180-cell median TG:VLDL-C factor table (Martin SS et al
// 2013 JAMA 310(19):2061-2068), shipped as reference data, never hand-typed.

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

// Rounded to whole mg/dL the way the table's own strata are labelled.
function nonHdlColumn(nonHdlMgDl: number): number {
  const rounded = Math.round(nonHdlMgDl);
  const idx = MARTIN_HOPKINS_NON_HDL_BANDS.findIndex((b) => inBand(rounded, b));
  // The last band is open above ('>=220'), so -1 is unreachable for a finite input.
  return idx === -1 ? MARTIN_HOPKINS_NON_HDL_BANDS.length - 1 : idx;
}

/** Both mg/dL; undefined outside the table's TG range (7–13975) so the caller renders null, not a guess. */
export function martinHopkinsFactor(nonHdlMgDl: number, trigMgDl: number): number | undefined {
  const trig = Math.round(trigMgDl);
  const row = MARTIN_HOPKINS_ROWS.find((r) => trig >= r.trigLow && trig <= r.trigHigh);
  if (!row) return undefined;
  return row.factors[nonHdlColumn(nonHdlMgDl)];
}
