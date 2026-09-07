// Printed unit → Latin unit → UCUM code, plus a code-vs-unit dimension check.
//
// The tables here are a curated subset, not a UCUM parser: UCUM is an
// expression grammar, so a valid unit can be written that no lookup table
// anticipated. The eventual upgrade path is the NLM JavaScript UCUM library
// (ADR-0007 / task-0008); until then an unrecognized unit returns undefined
// rather than a guess.
//
// Nothing here rewrites a value or a stored unit. A molar unit under a
// mass-concentration code is a CODE problem — the remedy is the sibling code
// (see massMolarSiblings.ts), never a converted number.
//
// `convertValue` and the `canonical` field exist for a different reason:
// comparability across a history that mixes units. The printed value and unit
// are the authoritative provenance — `rawValue` / `rawUnit` in the interchange
// format — and a canonical form is DERIVED alongside them, never a replacement.
// Every function here is pure: no argument is mutated, nothing is stored, and
// the untouched printed pair is always part of the result.

import { DEFAULT_UNITS, ALLOWED_UNITS } from './analyteCatalog';
import { MASS_MOLAR_SIBLINGS, SIBLING_BY_MASS_LOINC, SIBLING_BY_MOLAR_LOINC } from './massMolarSiblings';
import type { MassMolarSibling } from './massMolarSiblings';

export type TokenKind = 'substance' | 'mass' | 'volume' | 'arbitrary' | 'count' | 'time' | 'length' | 'area' | 'ratio';

export type UnitDimension =
  | 'substance/volume'
  | 'mass/volume'
  | 'arbitrary/volume'
  | 'count/volume'
  | 'mass'
  | 'volume'
  | 'time'
  | 'length/time'
  | 'clearance'
  | 'dimensionless';

interface UnitToken {
  latin: string;
  ucum: string;
  kind: TokenKind;
}

// IU and U share a kind on purpose: labs spell the same enzyme or hormone
// activity both ways ("Ед/л" and "МЕ/л" for ALT), and loincCheck already folds
// them together. Telling them apart here would raise mismatches that aren't.
export const LATIN_TOKENS: Record<string, UnitToken> = {
  mol: { latin: 'mol', ucum: 'mol', kind: 'substance' },
  mmol: { latin: 'mmol', ucum: 'mmol', kind: 'substance' },
  umol: { latin: 'umol', ucum: 'umol', kind: 'substance' },
  nmol: { latin: 'nmol', ucum: 'nmol', kind: 'substance' },
  pmol: { latin: 'pmol', ucum: 'pmol', kind: 'substance' },
  fmol: { latin: 'fmol', ucum: 'fmol', kind: 'substance' },
  kg: { latin: 'kg', ucum: 'kg', kind: 'mass' },
  g: { latin: 'g', ucum: 'g', kind: 'mass' },
  mg: { latin: 'mg', ucum: 'mg', kind: 'mass' },
  ug: { latin: 'ug', ucum: 'ug', kind: 'mass' },
  ng: { latin: 'ng', ucum: 'ng', kind: 'mass' },
  pg: { latin: 'pg', ucum: 'pg', kind: 'mass' },
  fg: { latin: 'fg', ucum: 'fg', kind: 'mass' },
  l: { latin: 'L', ucum: 'L', kind: 'volume' },
  dl: { latin: 'dL', ucum: 'dL', kind: 'volume' },
  ml: { latin: 'mL', ucum: 'mL', kind: 'volume' },
  ul: { latin: 'uL', ucum: 'uL', kind: 'volume' },
  nl: { latin: 'nL', ucum: 'nL', kind: 'volume' },
  fl: { latin: 'fL', ucum: 'fL', kind: 'volume' },
  u: { latin: 'U', ucum: 'U', kind: 'arbitrary' },
  mu: { latin: 'mU', ucum: 'mU', kind: 'arbitrary' },
  uu: { latin: 'uU', ucum: 'uU', kind: 'arbitrary' },
  iu: { latin: 'IU', ucum: '[IU]', kind: 'arbitrary' },
  miu: { latin: 'mIU', ucum: 'm[IU]', kind: 'arbitrary' },
  uiu: { latin: 'uIU', ucum: 'u[IU]', kind: 'arbitrary' },
  kiu: { latin: 'kIU', ucum: 'k[IU]', kind: 'arbitrary' },
  sec: { latin: 'sec', ucum: 's', kind: 'time' },
  min: { latin: 'min', ucum: 'min', kind: 'time' },
  h: { latin: 'h', ucum: 'h', kind: 'time' },
  hr: { latin: 'h', ucum: 'h', kind: 'time' },
  d: { latin: 'd', ucum: 'd', kind: 'time' },
  mm: { latin: 'mm', ucum: 'mm', kind: 'length' },
  cm: { latin: 'cm', ucum: 'cm', kind: 'length' },
  '%': { latin: '%', ucum: '%', kind: 'ratio' },
  ratio: { latin: 'ratio', ucum: '{ratio}', kind: 'ratio' },
  index: { latin: 'index', ucum: '{index}', kind: 'ratio' },
  // The body-surface-area denominator of an eGFR result.
  '1.73m2': { latin: '1.73m2', ucum: '{1.73_m2}', kind: 'area' },
};

// Cyrillic (and mixed-script) unit words as labs print them, mapped to the
// canonical Latin token. Values are keys of LATIN_TOKENS' `latin` column, or a
// power-of-ten token which resolveToken handles on its own.
export const CYRILLIC_TO_LATIN: Record<string, string> = {
  моль: 'mol',
  ммоль: 'mmol',
  мкмоль: 'umol',
  нмоль: 'nmol',
  пмоль: 'pmol',
  фмоль: 'fmol',
  кг: 'kg',
  г: 'g',
  мг: 'mg',
  мкг: 'ug',
  нг: 'ng',
  пг: 'pg',
  фг: 'fg',
  л: 'L',
  дл: 'dL',
  мл: 'mL',
  мкл: 'uL',
  нл: 'nL',
  фл: 'fL',
  ед: 'U',
  'ед.': 'U',
  мед: 'mU',
  мкед: 'uU',
  ме: 'IU',
  мме: 'mIU',
  мкме: 'uIU',
  кме: 'kIU',
  // Ukrainian МО (міжнародна одиниця) is the same international unit as the
  // Russian МЕ, so the whole prefix family maps onto the IU spellings.
  мо: 'IU',
  ммо: 'mIU',
  мкмо: 'uIU',
  кмо: 'kIU',
  сек: 'sec',
  мин: 'min',
  ч: 'h',
  час: 'h',
  сут: 'd',
  мм: 'mm',
  см: 'cm',
  тыс: '10^3',
  млн: '10^6',
};

const SUPERSCRIPT_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

const POWER_RE = /^x?10\^(\d{1,2})$/;

function foldSuperscripts(text: string): string {
  return text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (run) =>
    ['^', ...[...run].map((ch) => String(SUPERSCRIPT_DIGITS.indexOf(ch)))].join('')
  );
}

// Lowercase, whitespace-free, micro-sign folded to "u", multiplication signs
// (Latin x, ×, Cyrillic х) folded to "x", caret and star exponents unified,
// and the trailing "." / "?" the curated tables carry ("fL?") dropped.
function clean(printed: string): string {
  return foldSuperscripts(String(printed ?? '').trim())
    .toLowerCase()
    .replace(/[µμ]/g, 'u')
    .replace(/[×х]/g, 'x')
    .replace(/\s+/g, '')
    .replace(/10[*^](\d)/g, '10^$1')
    .replace(/[.?]+$/, '');
}

function splitUnit(cleaned: string): string[] | undefined {
  if (!cleaned) return undefined;
  const parts = cleaned.split('/');
  return parts.some((p) => p === '') ? undefined : parts;
}

function resolveToken(token: string): UnitToken | undefined {
  const cyrillic = CYRILLIC_TO_LATIN[token];
  const candidate = cyrillic ? cyrillic.toLowerCase() : token;
  const power = POWER_RE.exec(candidate);
  if (power) {
    const exponent = Number(power[1]);
    return { latin: `10^${exponent}`, ucum: `10*${exponent}`, kind: 'count' };
  }
  return LATIN_TOKENS[candidate] ?? LATIN_TOKENS[candidate.replace(/^mc/, 'u')];
}

/** Stage 1: printed unit (Cyrillic, mixed-script or Latin) → canonical Latin spelling. */
export function toLatinUnit(printed: string): string | undefined {
  const parts = splitUnit(clean(printed));
  if (!parts) return undefined;
  const latin: string[] = [];
  for (const part of parts) {
    const token = resolveToken(part);
    if (!token) return undefined;
    latin.push(token.latin);
  }
  return latin.join('/');
}

/** Stage 2: Latin unit → UCUM code, from the curated table above. */
export function toUcum(latinUnit: string): string | undefined {
  const parts = splitUnit(clean(latinUnit));
  if (!parts) return undefined;
  const ucum: string[] = [];
  for (const part of parts) {
    const token = resolveToken(part);
    if (!token) return undefined;
    ucum.push(token.ucum);
  }
  return ucum.join('/');
}

const UCUM_KINDS: Record<string, TokenKind> = Object.fromEntries(
  Object.values(LATIN_TOKENS).map((token) => [token.ucum.toLowerCase(), token.kind])
);

const UCUM_POWER_RE = /^10\*(\d{1,2})$/;

function kindOfToken(token: string): TokenKind | undefined {
  if (UCUM_POWER_RE.test(token)) return 'count';
  return resolveToken(token)?.kind ?? UCUM_KINDS[token];
}

const PER_VOLUME: Partial<Record<TokenKind, UnitDimension>> = {
  substance: 'substance/volume',
  mass: 'mass/volume',
  arbitrary: 'arbitrary/volume',
  count: 'count/volume',
};

const SOLE_KIND: Partial<Record<TokenKind, UnitDimension>> = {
  mass: 'mass',
  volume: 'volume',
  time: 'time',
  ratio: 'dimensionless',
};

// A ratio of two same-kind quantities (mg/g, mmol/mol, %) is dimensionless, so
// HbA1c in % and in mmol/mol compare equal — deliberately, since neither is a
// code error.
function dimensionFromKinds(kinds: TokenKind[]): UnitDimension | undefined {
  if (kinds.length === 1) return SOLE_KIND[kinds[0]];
  if (kinds.length === 2) {
    const [numerator, denominator] = kinds;
    if (numerator === denominator) return 'dimensionless';
    if (denominator === 'volume') return PER_VOLUME[numerator];
    if (numerator === 'length' && denominator === 'time') return 'length/time';
    return undefined;
  }
  if (kinds.length === 3 && kinds[0] === 'volume' && kinds[1] === 'time' && kinds[2] === 'area') {
    return 'clearance';
  }
  return undefined;
}

/** The physical dimension of a unit written in UCUM, Latin or printed form. */
export function dimensionOf(unit: string): UnitDimension | undefined {
  const parts = splitUnit(clean(unit));
  if (!parts) return undefined;
  const kinds: TokenKind[] = [];
  for (const part of parts) {
    const kind = kindOfToken(part);
    if (!kind) return undefined;
    kinds.push(kind);
  }
  return dimensionFromKinds(kinds);
}

export type CodeUnitCheck =
  | { kind: 'ok' }
  | { kind: 'unknown-code' }
  | { kind: 'unknown-unit' }
  | { kind: 'dimension-mismatch'; expected: string; suggestedLoinc?: string; note: string };

// The sibling table knows the scale of codes the curated marker tables don't
// carry (the molar twins), so a suggested code is itself checkable.
const SIBLING_UNITS: Record<string, string> = Object.fromEntries(
  MASS_MOLAR_SIBLINGS.flatMap((pair) => [
    [pair.mass.loinc, pair.mass.unit],
    [pair.molar.loinc, pair.molar.unit],
  ])
);

function expectedUnitsFor(loinc: string): string[] {
  const primary = DEFAULT_UNITS[loinc] ?? SIBLING_UNITS[loinc];
  return [primary, ...(ALLOWED_UNITS[loinc] ?? [])].filter(Boolean);
}

function siblingFor(loinc: string, actual: UnitDimension): { pair: MassMolarSibling; suggested: string } | undefined {
  const asMass = SIBLING_BY_MASS_LOINC[loinc];
  if (asMass && actual === 'substance/volume') return { pair: asMass, suggested: asMass.molar.loinc };
  const asMolar = SIBLING_BY_MOLAR_LOINC[loinc];
  if (asMolar && actual === 'mass/volume') return { pair: asMolar, suggested: asMolar.mass.loinc };
  return undefined;
}

/**
 * Stage 3: does the unit's dimension fit what the LOINC measures? A code whose
 * expected units are not dimensional at all (Positive/Negative) reads as ok —
 * there is nothing to contradict.
 */
export function checkCodeUnit(loinc: string, ucumUnit: string): CodeUnitCheck {
  const expectedUnits = expectedUnitsFor(loinc);
  if (expectedUnits.length === 0) return { kind: 'unknown-code' };

  const actual = dimensionOf(ucumUnit);
  if (!actual) return { kind: 'unknown-unit' };

  const expectedDimensions = new Set(expectedUnits.map((u) => dimensionOf(u)).filter(Boolean));
  if (expectedDimensions.size === 0 || expectedDimensions.has(actual)) return { kind: 'ok' };

  const primary = expectedUnits[0];
  const expected = toUcum(primary) ?? primary;
  const sibling = siblingFor(loinc, actual);
  if (sibling) {
    const other = sibling.suggested === sibling.pair.molar.loinc ? sibling.pair.molar : sibling.pair.mass;
    return {
      kind: 'dimension-mismatch',
      expected,
      suggestedLoinc: sibling.suggested,
      note: `${loinc} expects ${expected}, but ${ucumUnit} is a ${actual} unit. ${sibling.pair.analyte} on that scale is ${other.loinc} (${other.longCommonName}) — change the code, not the value.`,
    };
  }
  return {
    kind: 'dimension-mismatch',
    expected,
    note: `${loinc} expects ${expected} (${[...expectedDimensions].join(', ')}), but ${ucumUnit} is a ${actual} unit.`,
  };
}

// --- Value conversion: derived comparability, not a correction ---

const SI_PREFIX: Record<string, number> = {
  k: 1e3,
  d: 1e-1,
  c: 1e-2,
  m: 1e-3,
  u: 1e-6,
  n: 1e-9,
  p: 1e-12,
  f: 1e-15,
};

// Only bases with a defined magnitude. Counts (10*3), areas and the opaque
// annotation units ({ratio}) are deliberately absent, so nothing built on them
// converts.
const SCALE_BASES = new Set(['mol', 'g', 'L', 'U', '[IU]']);

function factorOfUcum(ucum: string): number | undefined {
  if (SCALE_BASES.has(ucum)) return 1;
  const prefix = SI_PREFIX[ucum.slice(0, 1)];
  return prefix !== undefined && SCALE_BASES.has(ucum.slice(1)) ? prefix : undefined;
}

interface UnitScale {
  kinds: TokenKind[];
  // Multiplier onto the dimension's base unit: g/L, mol/L, U/L, g, L.
  factor: number;
}

function unitScale(unit: string): UnitScale | undefined {
  const parts = splitUnit(clean(unit));
  if (!parts || parts.length > 2) return undefined;
  const kinds: TokenKind[] = [];
  const factors: number[] = [];
  for (const part of parts) {
    const token = resolveToken(part.replace(/[[\]]/g, ''));
    if (!token) return undefined;
    const factor = factorOfUcum(token.ucum);
    if (factor === undefined) return undefined;
    kinds.push(token.kind);
    factors.push(factor);
  }
  return { kinds, factor: parts.length === 1 ? factors[0] : factors[0] / factors[1] };
}

// Kind-by-kind equality, not just equal dimensions: mmol/mol and mg/g are both
// "dimensionless" yet measure different things, and must never convert.
function sameKinds(a: TokenKind[], b: TokenKind[]): boolean {
  return a.length === b.length && a.every((kind, i) => kind === b[i]);
}

// The pair's own `massPerMolarUnit` is stated on its declared units, so it
// yields g/mol once both are put on their base scales — that covers the pairs
// whose factor is not a molecular molar mass at all (urea nitrogen).
function gramsPerMole(pair: MassMolarSibling): number | undefined {
  if (pair.molarMassGPerMol !== undefined) return pair.molarMassGPerMol;
  const mass = unitScale(pair.mass.unit);
  const molar = unitScale(pair.molar.unit);
  if (!mass || !molar) return undefined;
  return (pair.massPerMolarUnit * mass.factor) / molar.factor;
}

/**
 * Convert a value between two UCUM units for one analyte: scale-only within a
 * dimension (g/L ↔ mg/dL, ug/L ↔ ng/mL), or across the mass/molar divide using
 * the sibling table's molar mass. Returns undefined whenever the conversion is
 * not exactly known — an unlisted pair, an analyte with no tabulated molar
 * mass, or two units that merely look compatible.
 *
 * This is for reading a history that mixes units. It is not a remedy for a
 * code/unit mismatch: see checkCodeUnit, whose answer stays "change the code".
 */
export function convertValue(
  value: number,
  fromUcum: string,
  toUcum: string,
  loinc: string
): { value: number; unit: string } | undefined {
  if (!Number.isFinite(value)) return undefined;
  const from = unitScale(fromUcum);
  const to = unitScale(toUcum);
  if (!from || !to) return undefined;
  if (sameKinds(from.kinds, to.kinds)) {
    return { value: (value * from.factor) / to.factor, unit: toUcum };
  }
  if (from.kinds[1] !== 'volume' || to.kinds[1] !== 'volume') return undefined;
  const molarToMass = from.kinds[0] === 'substance' && to.kinds[0] === 'mass';
  const massToMolar = from.kinds[0] === 'mass' && to.kinds[0] === 'substance';
  if (!molarToMass && !massToMolar) return undefined;
  const pair = SIBLING_BY_MASS_LOINC[loinc] ?? SIBLING_BY_MOLAR_LOINC[loinc];
  if (!pair) return undefined;
  const grams = gramsPerMole(pair);
  if (grams === undefined) return undefined;
  const base = value * from.factor;
  return { value: (molarToMass ? base * grams : base / grams) / to.factor, unit: toUcum };
}

/**
 * The UCUM unit this project treats as canonical for a code — its curated
 * reference unit (the analyte catalog's DEFAULT_UNITS, with the sibling table
 * covering the molar twins), expressed in UCUM.
 */
export function canonicalUnitFor(loinc: string): string | undefined {
  const primary = expectedUnitsFor(loinc)[0];
  return primary === undefined ? undefined : toUcum(primary);
}

export interface ObservationUnit {
  loinc: string;
  unit: string;
  /** Optional: supply it to also get the derived canonical form. */
  value?: number;
}

export interface UnitNormalization {
  printedUnit: string;
  latinUnit?: string;
  ucumUnit?: string;
  check: CodeUnitCheck;
  message: string;
  /**
   * The same reading expressed in the code's canonical unit, derived for
   * comparability and present only when the conversion is known and the unit
   * already fits the code. `printedUnit` (with the caller's own value) remains
   * the authoritative record.
   */
  canonical?: { value: number; unit: string };
}

function messageFor(printedUnit: string, ucumUnit: string | undefined, loinc: string, check: CodeUnitCheck): string {
  switch (check.kind) {
    case 'ok':
      return `"${printedUnit}" reads as ${ucumUnit}, which fits ${loinc}.`;
    case 'unknown-code':
      return `"${printedUnit}" reads as ${ucumUnit}, but ${loinc} is not in the curated unit tables — unit left unchecked.`;
    case 'unknown-unit':
      return `"${printedUnit}" is not in the unit tables — left exactly as printed.`;
    case 'dimension-mismatch':
      return check.note;
  }
}

// Only for a unit that already fits the code: converting a dimension-mismatched
// row would present a wrong code as a solved problem.
function canonicalForm(
  observation: ObservationUnit,
  ucumUnit: string | undefined,
  loinc: string,
  check: CodeUnitCheck
): { value: number; unit: string } | undefined {
  if (check.kind !== 'ok' || ucumUnit === undefined || typeof observation.value !== 'number') {
    return undefined;
  }
  const target = canonicalUnitFor(loinc);
  return target === undefined ? undefined : convertValue(observation.value, ucumUnit, target, loinc);
}

/**
 * Stage 1–3 in one reviewable result, plus the optional derived canonical form.
 * Never mutates its argument and never rewrites the printed value or unit.
 */
export function normalizeObservationUnit(observation: ObservationUnit): UnitNormalization {
  const printedUnit = observation.unit ?? '';
  const loinc = observation.loinc ?? '';
  const latinUnit = toLatinUnit(printedUnit);
  const ucumUnit = latinUnit === undefined ? undefined : toUcum(latinUnit);
  const check = checkCodeUnit(loinc, ucumUnit ?? printedUnit);
  const canonical = canonicalForm(observation, ucumUnit, loinc, check);
  return {
    printedUnit,
    latinUnit,
    ucumUnit,
    check,
    message: messageFor(printedUnit, ucumUnit, loinc, check),
    ...(canonical ? { canonical } : {}),
  };
}
