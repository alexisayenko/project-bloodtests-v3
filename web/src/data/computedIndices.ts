import type { Result } from '../types';
import { ALIAS_TO_PRIMARY, ALSO_REFS, DEFAULT_UNITS } from './analyteCatalog';
import { concentrationRatio, massPerMolarUnit, molarPerMassUnit } from './molarMasses';
import { toLatinUnit } from './unitNormalization';

// Engine for client-side computed indices; the definitions (formulas, cut-points,
// prose, sources) live in `indexDefs.ts`. eGFR/FIB-4 deliberately not computed.

export type Markers = Record<string, number | undefined>;

/** Input key -> candidate LOINCs, primary first; the first with data on the draw's date wins. */
export const MARKER_LOINC: Record<string, string[]> = {
  TC: ['2093-3'],
  'HDL-C': ['2085-9'],
  'LDL-C': ['13457-7'],
  TRIG: ['2571-8'],
  ApoB: ['1884-6'],
  ApoA1: ['1869-7'],
  GLU: ['2345-7'],
  Insulin: ['20448-7'],
  T: ['14913-8', '2986-8'],
  FT: ['2991-8'],
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

// Every factor below is DERIVED from molar-masses.json, never typed as a literal.

/** The unit pair each conversion works in; the Reference Book reads these rather than restating them. */
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
const CORTISOL_UGDL_TO_NMOLL = molarPerMass('cortisol');
const FT_PGML_TO_PMOLL = molarPerMassUnit('testosterone', 'pg/mL', 'pmol/L');
const FT_NGDL_TO_PMOLL = molarPerMassUnit('testosterone', 'ng/dL', 'pmol/L');

/** A same-dimension rescale, derived rather than typed: g/L -> mg/dL is 100. */
const rescale = (fromUnit: string, toUnit: string): number => {
  const ratio = concentrationRatio(fromUnit, toUnit);
  if (ratio === undefined) throw new Error(`no same-dimension rescale from "${fromUnit}" to "${toUnit}"`);
  return ratio;
};

/** Both directions of one same-dimension rescale, for a marker labs spell two ways. */
const rescaleBoth = (marker: string, from: string, to: string): UnitConv[] => [
  { marker, from, to, conv: (x) => x * rescale(from, to) },
  { marker, from: to, to: from, conv: (x) => x * rescale(to, from) },
];

const UNIT_CONVERSIONS: UnitConv[] = [
  { marker: 'FT3', from: 'pg/mL', to: 'pmol/L', conv: (x) => x * FT3_PGML_TO_PMOLL },
  { marker: 'FT3', from: 'pmol/L', to: 'pg/mL', conv: (x) => x / FT3_PGML_TO_PMOLL },
  { marker: 'FT4', from: 'ng/dL', to: 'pmol/L', conv: (x) => x * FT4_NGDL_TO_PMOLL },
  { marker: 'FT4', from: 'pmol/L', to: 'ng/dL', conv: (x) => x / FT4_NGDL_TO_PMOLL },
  { marker: 'T', from: 'nmol/L', to: 'ng/dL', conv: (x) => x / T_NGDL_TO_NMOLL },
  { marker: 'T', from: 'ng/dL', to: 'nmol/L', conv: (x) => x * T_NGDL_TO_NMOLL },
  ...rescaleBoth('T', 'ng/mL', 'ng/dL'),
  { marker: 'T', from: 'ng/mL', to: 'nmol/L', conv: (x) => x * rescale('ng/mL', 'ng/dL') * T_NGDL_TO_NMOLL },
  { marker: 'T', from: 'nmol/L', to: 'ng/mL', conv: (x) => x / T_NGDL_TO_NMOLL / rescale('ng/mL', 'ng/dL') },
  { marker: 'FT', from: 'pg/mL', to: 'pmol/L', conv: (x) => x * FT_PGML_TO_PMOLL },
  { marker: 'FT', from: 'pmol/L', to: 'pg/mL', conv: (x) => x / FT_PGML_TO_PMOLL },
  { marker: 'FT', from: 'ng/dL', to: 'pmol/L', conv: (x) => x * FT_NGDL_TO_PMOLL },
  { marker: 'FT', from: 'pmol/L', to: 'ng/dL', conv: (x) => x / FT_NGDL_TO_PMOLL },
  { marker: 'Cortisol', from: 'nmol/L', to: 'ug/dL', conv: (x) => x / CORTISOL_UGDL_TO_NMOLL },
  { marker: 'Cortisol', from: 'ug/dL', to: 'nmol/L', conv: (x) => x * CORTISOL_UGDL_TO_NMOLL },
  ...rescaleBoth('ApoB', 'g/L', 'mg/dL'),
  ...rescaleBoth('ApoA1', 'g/L', 'mg/dL'),
  ...rescaleBoth('ALB', 'g/L', 'g/dL'),
  ...Object.entries(MGDL_TO_MMOLL).flatMap(([marker, f]): UnitConv[] => [
    { marker, from: 'mg/dL', to: 'mmol/L', conv: f },
    { marker, from: 'mmol/L', to: 'mg/dL', conv: (x) => x / f(1) },
  ]),
];

/**
 * Undefined when no verified conversion covers the pair — the caller keeps the
 * printed unit rather than relabelling (ADR-0003). Spellings fold to Latin first
 * so "ммоль/л" converts like "mmol/L".
 */
export function convertUnit(
  value: number,
  marker: string,
  from: string | null | undefined,
  to: string
): number | undefined {
  if (!from) return undefined;
  const latinFrom = toLatinUnit(from) ?? from;
  const latinTo = toLatinUnit(to) ?? to;
  if (latinFrom === latinTo) return value;
  const rule = UNIT_CONVERSIONS.find((r) => r.marker === marker && r.from === latinFrom && r.to === latinTo);
  return rule ? rule.conv(value) : undefined;
}

/** convertUnit, falling back to the value untouched -- only for callers that show no unit of their own. */
export function toUnit(value: number, marker: string, from: string | null | undefined, to: string): number {
  return convertUnit(value, marker, from, to) ?? value;
}

/** Only markers with a verified UNIT_CONVERSIONS entry; everything else stays as reported. */
export const SI_US_UNIT: Record<string, { si: string; us: string }> = {
  TC: { si: 'mmol/L', us: 'mg/dL' },
  'HDL-C': { si: 'mmol/L', us: 'mg/dL' },
  'LDL-C': { si: 'mmol/L', us: 'mg/dL' },
  TRIG: { si: 'mmol/L', us: 'mg/dL' },
  GLU: { si: 'mmol/L', us: 'mg/dL' },
  T: { si: 'nmol/L', us: 'ng/dL' },
  FT3: { si: 'pmol/L', us: 'pg/mL' },
  FT4: { si: 'pmol/L', us: 'ng/dL' },
  Cortisol: { si: 'nmol/L', us: 'ug/dL' },
};

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

/** Who the readings belong to, as far as choosing an index's band needs to know. */
export type SubjectProfile = { sex?: 'female' | 'male' };

export type IndexBands = { cut: [number, number]; hi?: boolean };

/** A `bandsBySex` index has no band until sex is known — never the other sex's. */
export function indexBands(def: IndexDef, profile: SubjectProfile = {}): IndexBands | null {
  if (def.bandsBySex) return profile.sex ? (def.bandsBySex[profile.sex] ?? null) : null;
  return def.cut ? { cut: def.cut, hi: def.hi } : null;
}

/** `zone()` over `indexBands()`; null = no band, so the value carries no status. */
export function indexZone(def: IndexDef, value: number, profile: SubjectProfile = {}): Zone | null {
  const bands = indexBands(def, profile);
  return bands ? zone(value, bands.cut[0], bands.cut[1], bands.hi) : null;
}

export interface IndexReference {
  organization: string;
  document: string;
  year?: number;
  url?: string;
  doi?: string | null;
  quote: string;
  /** ISO date the quoted text was retrieved from `url`. */
  retrieved?: string;
}

export interface IndexDef {
  key: string;
  friendlyName: string;
  shortName: string;
  panels: string[];
  formula: string;
  /** [good, warn] cut-points. */
  cut?: [number, number];
  /** true = higher-is-better. */
  hi?: boolean;
  /** Bands that differ by sex; when set, `cut` and `hi` are ignored (see `indexBands`). */
  bandsBySex?: Partial<Record<'female' | 'male', IndexBands>>;
  unit?: string;
  /** Keys into MARKER_LOINC. */
  inputKeys: string[];
  /** Replaced by a stated default when absent, so they never gate the index nor get scheduled. */
  optionalInputKeys?: string[];
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

/** Reverse of MARKER_LOINC. */
export const LOINC_TO_MARKER: Record<string, string> = Object.fromEntries(
  Object.entries(MARKER_LOINC).flatMap(([marker, loincs]) => loincs.map((loinc) => [loinc, marker]))
);

/**
 * MARKER_LOINC plus each code's catalog variants, derived through
 * ALSO_REFS / ALIAS_TO_PRIMARY (ADR-0010) rather than listed twice. Declared
 * codes come first so a draw carrying both keeps their precedence.
 */
export const MARKER_CANDIDATE_LOINCS: Record<string, string[]> = Object.fromEntries(
  Object.entries(MARKER_LOINC).map(([marker, declared]) => {
    const codes = new Set(declared);
    for (const loinc of declared) {
      const primary = ALIAS_TO_PRIMARY[loinc] ?? loinc;
      codes.add(primary);
      for (const variant of ALSO_REFS[primary] ?? []) codes.add(variant.loinc);
    }
    return [marker, [...codes]];
  })
);

// The yardstick for an input whose formula declares no unit: a ratio only needs both sides on the SAME one.
const MARKER_REFERENCE_UNIT: Record<string, string | undefined> = Object.fromEntries(
  Object.entries(MARKER_LOINC).map(([marker, declared]) => [
    marker,
    declared[0] ? DEFAULT_UNITS[declared[0]] : undefined,
  ])
);

// Derived for computation only, never written back (ADR-0003). An input that
// cannot be placed in the expected unit is left OUT rather than passed as
// printed — except a PRIMARY-code value with no formula-declared unit (DHT in
// pg/mL, which dhtt rescales itself); a variant code gets no such benefit.
function markerValue(
  inputKey: string,
  resultsByLoinc: Record<string, Result>,
  target: string | undefined
): number | undefined {
  const primary = (MARKER_LOINC[inputKey] ?? [])[0];
  const to = target ?? MARKER_REFERENCE_UNIT[inputKey];
  for (const loinc of MARKER_CANDIDATE_LOINCS[inputKey] ?? []) {
    const r = resultsByLoinc[loinc];
    if (r?.value == null) continue;
    if (!to) return r.value;
    const converted = convertUnit(r.value, inputKey, r.unit, to);
    if (converted !== undefined) return converted;
    if (!target && loinc === primary) return r.value;
  }
  return undefined;
}

/** One draw's observations, converted to the units each index's fn expects. */
export function markersForIndex(def: IndexDef, resultsByLoinc: Record<string, Result>): Markers {
  const m: Markers = {};
  for (const inputKey of [...def.inputKeys, ...(def.optionalInputKeys ?? [])]) {
    const value = markerValue(inputKey, resultsByLoinc, def.inputUnits?.[inputKey]);
    if (value !== undefined) m[inputKey] = value;
  }
  return m;
}

export function computeIndex(def: IndexDef, resultsByLoinc: Record<string, Result>): number | null {
  const v = def.fn(markersForIndex(def, resultsByLoinc));
  if (v == null || !Number.isFinite(v)) return null;
  // Quantize to 2dp before display formatting (AIP 0.4475 -> "0.45", not fmtNum's "0.448").
  return Math.round(v * 100) / 100;
}
