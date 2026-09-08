import data from '../../public/data/molar-masses.json';

/**
 * The single source of truth for mass↔molar conversion.
 *
 * `web/public/data/molar-masses.json` stores molar masses, not factors: each
 * entry carries a molecular formula, the mass computed from it and the atomic
 * weights it was computed with, and the sources every one of those was verified
 * against. This module turns a molar mass into the factor a given unit pair
 * needs, so nothing in the app writes a conversion factor by hand and "38.666
 * mg/dL per mmol/L" cannot drift from "cholesterol is 386.664 g/mol".
 *
 * Deliberately dependency-free: `massMolarSiblings.ts` builds on it, and
 * `unitNormalization.ts` builds on that, so it cannot reach back for their unit
 * parsing without a cycle.
 */

export interface AtomicWeight {
  element: string;
  value: number;
  publishedAs: string;
  table: 'abridged' | 'full';
  note?: string;
}

export interface MolarMassSource {
  authority: string;
  identifier: string;
  url: string;
  reportedMolarMassGPerMol?: number;
  retrieved: string;
}

/**
 * `compound` — a single molecular species, so the molar mass is exact.
 * `element` — measured as the element itself, so it is an atomic weight.
 * `conventional` — no single true molar mass exists and clinical practice
 * agrees on a stand-in; the entry's `note` says what the convention is.
 */
export type MolarMassBasis = 'compound' | 'element' | 'conventional';

export interface MolarMassEntry {
  id: string;
  name: string;
  formula: string;
  molarMassGPerMol: number;
  basis: MolarMassBasis;
  note?: string;
  sources: MolarMassSource[];
}

interface MolarMassFile {
  atomicWeights: {
    source: { authority: string; identifier: string; url: string; fullTableUrl?: string; retrieved: string };
    elements: Record<string, AtomicWeight>;
  };
  analytes: MolarMassEntry[];
}

const file = data as MolarMassFile;

export const ATOMIC_WEIGHTS: Record<string, AtomicWeight> = file.atomicWeights.elements;
export const ATOMIC_WEIGHTS_SOURCE = file.atomicWeights.source;
export const MOLAR_MASSES: MolarMassEntry[] = file.analytes;

export const MOLAR_MASS_BY_ID: Record<string, MolarMassEntry> = Object.fromEntries(
  MOLAR_MASSES.map((m) => [m.id, m])
);

/**
 * Recompute a formula's molar mass from `ATOMIC_WEIGHTS`. The stored
 * `molarMassGPerMol` is exactly this, and the conformance suite checks it —
 * the function exists so the check has something to check against, and so a
 * Reference Book page can show the arithmetic rather than assert the result.
 * Returns undefined for a formula naming an element the table does not carry.
 */
export function molarMassFromFormula(formula: string): number | undefined {
  const tokens = formula.match(/[A-Z][a-z]?\d*/g);
  if (!tokens || tokens.join('') !== formula) return undefined;
  let total = 0;
  for (const token of tokens) {
    const symbol = token.match(/^[A-Z][a-z]?/)![0];
    const weight = ATOMIC_WEIGHTS[symbol];
    if (!weight) return undefined;
    const count = token.slice(symbol.length);
    total += weight.value * (count ? Number(count) : 1);
  }
  return total;
}

export function molarMassOf(id: string): number {
  const entry = MOLAR_MASS_BY_ID[id];
  if (!entry) throw new Error(`no molar mass tabulated for "${id}"`);
  return entry.molarMassGPerMol;
}

const SI_PREFIX: Record<string, number> = {
  k: 1e3,
  d: 1e-1,
  c: 1e-2,
  m: 1e-3,
  u: 1e-6,
  µ: 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15,
};

const VOLUME: Record<string, number> = { L: 1, dL: 1e-1, mL: 1e-3, uL: 1e-6, µL: 1e-6 };

/**
 * A concentration unit's multiplier onto its dimension's base scale (g/L for a
 * mass concentration, mol/L for a molar one), plus which of the two it is.
 * Anything else — a unit with no volume, an activity, a count — is undefined,
 * so nothing converts on a unit this does not fully understand.
 */
function concentrationScale(unit: string): { kind: 'mass' | 'substance'; scale: number } | undefined {
  const [amount, volume, ...rest] = unit.split('/');
  if (rest.length > 0 || !amount || !volume) return undefined;
  const perLitre = VOLUME[volume];
  if (perLitre === undefined) return undefined;

  const base = amount.endsWith('mol') ? 'mol' : amount.endsWith('g') ? 'g' : undefined;
  if (!base) return undefined;
  const prefix = amount.slice(0, amount.length - base.length);
  const multiplier = prefix === '' ? 1 : SI_PREFIX[prefix];
  if (multiplier === undefined || (prefix !== '' && prefix.length !== 1)) return undefined;

  return { kind: base === 'mol' ? 'substance' : 'mass', scale: multiplier / perLitre };
}

function scaleOf(unit: string, kind: 'mass' | 'substance'): number {
  const parsed = concentrationScale(unit);
  if (!parsed || parsed.kind !== kind) {
    throw new Error(`"${unit}" is not a ${kind === 'mass' ? 'mass' : 'molar'} concentration unit`);
  }
  return parsed.scale;
}

/**
 * How much of `toUnit` one unit of `fromUnit` is, when both express the SAME
 * dimension (g/L → mg/dL is 100). Pure SI arithmetic — no molar mass is
 * involved and none is needed — but it belongs beside the functions above so
 * that a caller rescaling a concentration never writes the factor out by hand
 * either. Undefined when either unit is not a concentration this module fully
 * understands, or when the two are of different dimensions (that is the
 * mass↔molar case, and it needs `massPerMolarUnit` and a molar mass).
 */
export function concentrationRatio(fromUnit: string, toUnit: string): number | undefined {
  const from = concentrationScale(fromUnit);
  const to = concentrationScale(toUnit);
  if (!from || !to || from.kind !== to.kind) return undefined;
  return from.scale / to.scale;
}

/**
 * How much of `massUnit` one unit of `molarUnit` is — the number a mass value
 * is divided by to reach the molar scale. Cholesterol in mg/dL and mmol/L
 * gives 38.666.
 */
export function massPerMolarUnit(id: string, massUnit: string, molarUnit: string): number {
  return (molarMassOf(id) * scaleOf(molarUnit, 'substance')) / scaleOf(massUnit, 'mass');
}

/**
 * The reciprocal: how much of `molarUnit` one unit of `massUnit` is — the
 * number a mass value is multiplied by. Testosterone in ng/dL and nmol/L gives
 * 0.034670.
 */
export function molarPerMassUnit(id: string, massUnit: string, molarUnit: string): number {
  return scaleOf(massUnit, 'mass') / (molarMassOf(id) * scaleOf(molarUnit, 'substance'));
}
