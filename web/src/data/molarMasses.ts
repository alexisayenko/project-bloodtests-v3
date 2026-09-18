import data from '../../public/data/molar-masses.json';

// molar-masses.json stores molar masses, never factors; every factor is derived
// here (ADR-0011). Dependency-free on purpose: unitNormalization builds on this.

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

/** `conventional`: no single true molar mass exists; the entry's `note` names the clinical stand-in. */
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

/** Recomputed from `ATOMIC_WEIGHTS` so the conformance suite can check the stored mass against it. */
export function molarMassFromFormula(formula: string): number | undefined {
  const tokens = formula.match(/[A-Z][a-z]?\d*/g);
  if (tokens?.join('') !== formula) return undefined;
  let total = 0;
  for (const token of tokens) {
    const symbol = /^[A-Z][a-z]?/.exec(token)![0];
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

function baseAmountOf(amount: string): 'mol' | 'g' | undefined {
  if (amount.endsWith('mol')) return 'mol';
  if (amount.endsWith('g')) return 'g';
  return undefined;
}

// Multiplier onto g/L or mol/L; undefined for anything not fully understood, so nothing converts on a guess.
function concentrationScale(unit: string): { kind: 'mass' | 'substance'; scale: number } | undefined {
  const [amount, volume, ...rest] = unit.split('/');
  if (rest.length > 0 || !amount || !volume) return undefined;
  const perLitre = VOLUME[volume];
  if (perLitre === undefined) return undefined;

  const base = baseAmountOf(amount);
  if (!base) return undefined;
  const prefix = amount.slice(0, amount.length - base.length);
  const multiplier = prefix === '' ? 1 : SI_PREFIX[prefix];
  if (multiplier === undefined || (prefix !== '' && prefix.length !== 1)) return undefined;

  return { kind: base === 'mol' ? 'substance' : 'mass', scale: multiplier / perLitre };
}

function scaleOf(unit: string, kind: 'mass' | 'substance'): number {
  const parsed = concentrationScale(unit);
  if (parsed?.kind !== kind) {
    throw new Error(`"${unit}" is not a ${kind === 'mass' ? 'mass' : 'molar'} concentration unit`);
  }
  return parsed.scale;
}

/** Same-dimension rescale (g/L → mg/dL is 100); undefined across mass↔molar, which needs `massPerMolarUnit`. */
export function concentrationRatio(fromUnit: string, toUnit: string): number | undefined {
  const from = concentrationScale(fromUnit);
  const to = concentrationScale(toUnit);
  if (!to || from?.kind !== to.kind) return undefined;
  return from.scale / to.scale;
}

/** The number a mass value is divided by to reach the molar scale (cholesterol mg/dL→mmol/L: 38.666). */
export function massPerMolarUnit(id: string, massUnit: string, molarUnit: string): number {
  return (molarMassOf(id) * scaleOf(molarUnit, 'substance')) / scaleOf(massUnit, 'mass');
}

/** The reciprocal: the number a mass value is multiplied by (testosterone ng/dL→nmol/L: 0.034670). */
export function molarPerMassUnit(id: string, massUnit: string, molarUnit: string): number {
  return scaleOf(massUnit, 'mass') / (molarMassOf(id) * scaleOf(molarUnit, 'substance'));
}
