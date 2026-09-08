import type { Result } from '../types';
import { massPerMolarUnit, molarPerMassUnit } from './molarMasses';

/**
 * Client-side computed indices — ratios/estimates derived from other
 * observations, not reported directly by any lab. Ported from
 * project-bloodtests-v2's engine/src/indices/{definitions,build,free-testosterone}.ts
 * and engine/src/{flag,convert}.ts. Age/sex-dependent indices (eGFR x3, FIB-4)
 * are intentionally NOT ported; eGFR stays the lab-reported LOINC value it
 * already was. The definitions themselves (formulas, cut-points, prose,
 * sources) live in `indexDefs.ts`.
 */

export type Markers = Record<string, number | undefined>;

/**
 * v2 marker short name -> candidate v3 LOINC codes, for every marker any ported
 * index needs. Some analytes are reported under different LOINCs across labs/eras
 * (same list as MedicalConditionsPage's ALSO_REFS) -- listed primary-first, tried
 * in order, first one with data on the draw's date wins.
 */
export const MARKER_LOINC: Record<string, string[]> = {
  TC: ['2093-3'],
  'HDL-C': ['2085-9'],
  'LDL-C': ['13457-7'],
  TRIG: ['2571-8'],
  ApoB: ['1884-6'],
  ApoA1: ['1869-7'],
  GLU: ['2339-0'],
  Insulin: ['20448-7'],
  T: ['14913-8', '2986-8'],
  SHBG: ['2942-1', '13967-5'],
  ALB: ['1751-7'],
  DHT: ['1848-1', '15057-3'],
  LH: ['10501-5'],
  E2: ['2243-4'],
  Cortisol: ['2143-6'],
  'DHEA-S': ['2191-5'],
  FT3: ['3051-0'],
  FT4: ['3024-7'],
  AST: ['1920-8'],
  ALT: ['1742-6'],
  Fe: ['2498-4'],
  TIBC: ['2500-7'],
};

// ---- unit conversion, ported from engine/src/convert.ts + build.ts's
// UNIT_CONVERSIONS. v2 wrote each factor out as a literal; here every one is
// DERIVED from the molar-mass reference data, so an index can no longer
// disagree with the mass/molar sibling table about what a mole of glucose
// weighs (it did: v2 used 18.018, the sibling table 18.016, and 180.156 g/mol
// makes it 18.0156). ----

/**
 * The mass/molar unit pair each conversion below works in, as data: the
 * Reference Book's conversion table states the same pairs, and for an analyte
 * tabulated for an index rather than for a LOINC sibling pair (T3, DHEA-S)
 * this is the only place they are written down.
 */
export const INDEX_UNIT_PAIRS: Record<string, { mass: string; molar: string }> = {
  cholesterol: { mass: 'mg/dL', molar: 'mmol/L' },
  triglyceride: { mass: 'mg/dL', molar: 'mmol/L' },
  glucose: { mass: 'mg/dL', molar: 'mmol/L' },
  testosterone: { mass: 'ng/dL', molar: 'nmol/L' },
  triiodothyronine: { mass: 'pg/mL', molar: 'pmol/L' },
  thyroxine: { mass: 'ng/dL', molar: 'pmol/L' },
  cortisol: { mass: 'ug/dL', molar: 'nmol/L' },
  dheas: { mass: 'ug/dL', molar: 'nmol/L' },
};

const massPerMolar = (id: string) =>
  massPerMolarUnit(id, INDEX_UNIT_PAIRS[id].mass, INDEX_UNIT_PAIRS[id].molar);

export const molarPerMass = (id: string) =>
  molarPerMassUnit(id, INDEX_UNIT_PAIRS[id].mass, INDEX_UNIT_PAIRS[id].molar);

const CHOL_MGDL_PER_MMOLL = massPerMolar('cholesterol');
const TG_MGDL_PER_MMOLL = massPerMolar('triglyceride');
const GLU_MGDL_PER_MMOLL = massPerMolar('glucose');

const cholMgdlToMmoll = (x: number) => x / CHOL_MGDL_PER_MMOLL;
const tgMgdlToMmoll = (x: number) => x / TG_MGDL_PER_MMOLL;
const glucoseMgdlToMmoll = (x: number) => x / GLU_MGDL_PER_MMOLL;

const MGDL_TO_MMOLL: Record<string, (x: number) => number> = {
  TC: cholMgdlToMmoll,
  'HDL-C': cholMgdlToMmoll,
  'LDL-C': cholMgdlToMmoll,
  TRIG: tgMgdlToMmoll,
  GLU: glucoseMgdlToMmoll,
};

interface UnitConv {
  marker: string;
  from: string;
  to: string;
  conv: (x: number) => number;
}

const T_NGDL_TO_NMOLL = molarPerMass('testosterone');
const FT3_PGML_TO_PMOLL = molarPerMass('triiodothyronine');
const FT4_NGDL_TO_PMOLL = molarPerMass('thyroxine');

const UNIT_CONVERSIONS: UnitConv[] = [
  { marker: 'FT3', from: 'pg/mL', to: 'pmol/L', conv: (x) => x * FT3_PGML_TO_PMOLL },
  { marker: 'FT3', from: 'pmol/L', to: 'pg/mL', conv: (x) => x / FT3_PGML_TO_PMOLL },
  { marker: 'FT4', from: 'ng/dL', to: 'pmol/L', conv: (x) => x * FT4_NGDL_TO_PMOLL },
  { marker: 'FT4', from: 'pmol/L', to: 'ng/dL', conv: (x) => x / FT4_NGDL_TO_PMOLL },
  // Testosterone: nmol/L (molar, e.g. LOINC 14913-8) <-> ng/dL (the mass unit
  // cft/tlh/te2/dhtt's formulas expect).
  { marker: 'T', from: 'nmol/L', to: 'ng/dL', conv: (x) => x / T_NGDL_TO_NMOLL },
  { marker: 'T', from: 'ng/dL', to: 'nmol/L', conv: (x) => x * T_NGDL_TO_NMOLL },
  // Testosterone: ng/mL (e.g. LOINC 2986-8) <-> ng/dL -- same mass unit, dL = 100 mL.
  { marker: 'T', from: 'ng/mL', to: 'ng/dL', conv: (x) => x * 100 },
  { marker: 'T', from: 'ng/dL', to: 'ng/mL', conv: (x) => x / 100 },
  // Testosterone: ng/mL <-> nmol/L directly (ng/mL -> ng/dL -> nmol/L combined).
  { marker: 'T', from: 'ng/mL', to: 'nmol/L', conv: (x) => x * 100 * T_NGDL_TO_NMOLL },
  { marker: 'T', from: 'nmol/L', to: 'ng/mL', conv: (x) => x / T_NGDL_TO_NMOLL / 100 },
  ...Object.entries(MGDL_TO_MMOLL).flatMap(([marker, f]): UnitConv[] => [
    { marker, from: 'mg/dL', to: 'mmol/L', conv: f },
    { marker, from: 'mmol/L', to: 'mg/dL', conv: (x) => x / f(1) },
  ]),
];

export function toUnit(value: number, marker: string, from: string | null | undefined, to: string): number {
  if (!from || from === to) return value;
  const rule = UNIT_CONVERSIONS.find((r) => r.marker === marker && r.from === from && r.to === to);
  return rule ? rule.conv(value) : value;
}

/**
 * The SI/US toggle only touches observations we have a verified conversion
 * factor for (the markers above with an entry in UNIT_CONVERSIONS) -- every
 * other observation keeps showing its as-reported value/unit unchanged rather
 * than an invented conversion.
 */
export const SI_US_UNIT: Record<string, { si: string; us: string }> = {
  TC: { si: 'mmol/L', us: 'mg/dL' },
  'HDL-C': { si: 'mmol/L', us: 'mg/dL' },
  'LDL-C': { si: 'mmol/L', us: 'mg/dL' },
  TRIG: { si: 'mmol/L', us: 'mg/dL' },
  GLU: { si: 'mmol/L', us: 'mg/dL' },
  T: { si: 'nmol/L', us: 'ng/dL' },
  FT3: { si: 'pmol/L', us: 'pg/mL' },
  FT4: { si: 'pmol/L', us: 'ng/dL' },
};

// ---- 3-zone coloring, ported verbatim from engine/src/flag.ts's `zone()` ----

export type Zone = 'ok' | 'warn' | 'bad';

export function zone(value: number, good: number, warn: number, hi = false): Zone {
  if (hi) {
    if (value >= good) return 'ok';
    if (value >= warn) return 'warn';
    return 'bad';
  }
  if (value < good) return 'ok';
  if (value < warn) return 'warn';
  return 'bad';
}

export interface IndexReference {
  organization: string;
  document: string;
  year?: number;
  url?: string;
  doi?: string | null;
  quote: string;
}

export interface IndexDef {
  key: string;
  name: string;
  nameCompact: string;
  /** Monitoring Panel names (MedicalConditionsPage's PANEL_DEFS) this index appears under. */
  panels: string[];
  formula: string;
  /** [good, warn] cut-points. */
  cut: [number, number];
  /** true = higher-is-better. */
  hi?: boolean;
  unit?: string;
  /** v2 marker short names -- keys into MARKER_LOINC. */
  needs: string[];
  inputUnits?: Partial<Record<string, string>>;
  level: 'consensus' | 'heuristic';
  meaning: string;
  consensus: string;
  evidenceLevel: string;
  references: IndexReference[];
  /** Set only when the lab can independently report this exact quantity. */
  loinc?: string;
  fn: (m: Markers) => number | null;
}

/** First of a marker's candidate LOINCs that has a value on this draw. */
function findResult(short: string, resultsByLoinc: Record<string, Result>): Result | undefined {
  for (const loinc of MARKER_LOINC[short] ?? []) {
    const r = resultsByLoinc[loinc];
    if (r?.value != null) return r;
  }
  return undefined;
}

/** One draw's observations, converted to the units each index's fn expects. */
export function markersForIndex(def: IndexDef, resultsByLoinc: Record<string, Result>): Markers {
  const m: Markers = {};
  for (const short of def.needs) {
    const r = findResult(short, resultsByLoinc);
    if (r?.value == null) continue;
    const target = def.inputUnits?.[short];
    m[short] = target ? toUnit(r.value, short, r.unit, target) : r.value;
  }
  if (def.key === 'cft') {
    const alb = findResult('ALB', resultsByLoinc);
    if (alb?.value != null) m['ALB'] = alb.value;
  }
  return m;
}

export function computeIndex(def: IndexDef, resultsByLoinc: Record<string, Result>): number | null {
  const v = def.fn(markersForIndex(def, resultsByLoinc));
  if (v == null || !Number.isFinite(v)) return null;
  // Quantize to 2dp before display formatting -- matches v2's historical display
  // (e.g. AIP 0.4475 -> 0.45 -> "0.45", not fmtNum's raw "0.448").
  return Math.round(v * 100) / 100;
}
