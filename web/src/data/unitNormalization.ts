// Printed unit → Latin unit → UCUM code, plus a code-vs-unit dimension check.
// Curated tables, not a UCUM parser: an unrecognized unit returns undefined
// rather than a guess (ADR-0007). Nothing here rewrites a printed value or unit
// (ADR-0003); a molar unit under a mass code is a CODE problem, fixed by the
// sibling code, never by a converted number.

import { DEFAULT_UNITS, ALLOWED_UNITS, U_IU_FOLD_REASON } from './analyteCatalog';
import { MASS_MOLAR_SIBLINGS, SIBLING_BY_MASS_LOINC, SIBLING_BY_MOLAR_LOINC } from './massMolarSiblings';
import type { MassMolarSibling } from './massMolarSiblings';

type TokenKind ='substance' | 'mass' | 'volume' | 'arbitrary' | 'count' | 'time' | 'length' | 'area' | 'ratio';

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

// IU and U share a KIND on purpose (so "Ед/л" vs "МЕ/л" is no dimension
// mismatch); whether they are the same SCALE is answered per analyte in `sameUnitScale`.
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

// Values are LATIN_TOKENS keys or a power-of-ten token resolveToken handles itself.
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
  // Ukrainian МО is the same international unit as Russian МЕ.
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

/** Folds superscripts, µ/μ and ×/х onto ASCII; case is left alone on purpose. */
export function foldUnitGlyphs(text: string): string {
  return foldSuperscripts(String(text ?? '').trim())
    .replace(/[µμΜ]/g, 'u')
    .replace(/[×хХ]/g, 'x');
}

// The trailing "." / "?" some curated tables carry ("fL?") is dropped.
function clean(printed: string): string {
  return foldUnitGlyphs(printed)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/10[*^](\d)/g, '10^$1')
    .replace(/(?<=[^.?]|^)[.?]+$/, '');
}

function splitUnit(cleaned: string): string[] | undefined {
  if (!cleaned) return undefined;
  const parts = cleaned.split('/');
  return parts.includes('') ? undefined : parts;
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

/** Stages 1–2 in one call. Spelling only — no value is converted (ADR-0003). */
export function ucumUnitFor(printedUnit: string): string | undefined {
  const latin = toLatinUnit(printedUnit);
  return latin === undefined ? undefined : toUcum(latin);
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

// Same-kind ratios (mg/g, mmol/mol, %) are all dimensionless, so HbA1c in % and
// in mmol/mol compare equal on purpose — neither is a code error.
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

type CodeUnitCheck =
  | { kind: 'ok' }
  | { kind: 'unknown-code' }
  | { kind: 'unknown-unit' }
  | { kind: 'dimension-mismatch'; expected: string; suggestedLoinc?: string; note: string };

// Covers the molar twins the marker tables lack, so a suggested code is itself checkable.
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

/** Stage 3: does the unit's dimension fit the LOINC? Non-dimensional codes (Positive/Negative) read as ok. */
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

// Counts, areas and annotation units ({ratio}) are deliberately absent, so nothing built on them converts.
const SCALE_BASES = new Set(['mol', 'g', 'L', 'U', '[IU]']);

function baseOfUcum(ucum: string): { base: string; factor: number } | undefined {
  if (SCALE_BASES.has(ucum)) return { base: ucum, factor: 1 };
  const prefix = SI_PREFIX[ucum.slice(0, 1)];
  const base = ucum.slice(1);
  return prefix !== undefined && SCALE_BASES.has(base) ? { base, factor: prefix } : undefined;
}

interface UnitScale {
  kinds: TokenKind[];
  bases: string[];
  factor: number;
}

function unitScale(unit: string): UnitScale | undefined {
  const parts = splitUnit(clean(unit));
  if (!parts || parts.length > 2) return undefined;
  const kinds: TokenKind[] = [];
  const bases: string[] = [];
  const factors: number[] = [];
  for (const part of parts) {
    const token = resolveToken(part.replace(/[[\]]/g, ''));
    if (!token) return undefined;
    const scale = baseOfUcum(token.ucum);
    if (!scale) return undefined;
    kinds.push(token.kind);
    bases.push(scale.base);
    factors.push(scale.factor);
  }
  return { kinds, bases, factor: parts.length === 1 ? factors[0] : factors[0] / factors[1] };
}

// Kind-by-kind equality, not just equal dimensions: mmol/mol and mg/g are both
// "dimensionless" yet measure different things, and must never convert.
function sameKinds(a: TokenKind[], b: TokenKind[]): boolean {
  return a.length === b.length && a.every((kind, i) => kind === b[i]);
}

// UCUM keeps U and [IU] incommensurable, but labs print both spellings for
// analytes measured in only ONE of them, so whether they fold is a fact about
// the analyte, not the string — see U_IU_FOLD_REASON.
const ARBITRARY_BASES = new Set(['U', '[IU]']);

// No analyte supplied → the conservative answer.
function foldsUAndIu(loinc: string | undefined): boolean {
  return loinc !== undefined && U_IU_FOLD_REASON[loinc] !== undefined;
}

// U and [IU] are one base only for an analyte whose property permits it.
function sameBases(a: string[], b: string[], foldArbitraryBases: boolean): boolean {
  return (
    a.length === b.length &&
    a.every(
      (base, i) =>
        base === b[i] || (foldArbitraryBases && ARBITRARY_BASES.has(base) && ARBITRARY_BASES.has(b[i]))
    )
  );
}

// Fold to Latin first: only resolveToken's mc→u rule understands "mcg/dL".
function latinScale(unit: string): UnitScale | undefined {
  const latin = toLatinUnit(unit);
  return latin === undefined ? undefined : unitScale(latin);
}

/**
 * Do two spellings denote the IDENTICAL unit (same bases, ratio exactly 1)?
 * uIU/mL = mIU/L, mg/L = ug/mL; mg/dL vs g/L does not. An unrecognized unit
 * is "no", never a throw. `loinc` decides whether a printed U and IU fold —
 * only where the analyte's LOINC property says it is measured in just one.
 */
export function sameUnitScale(a: string, b: string, loinc?: string): boolean {
  const left = latinScale(a);
  const right = latinScale(b);
  if (!left || !right || !sameKinds(left.kinds, right.kinds)) return false;
  if (!sameBases(left.bases, right.bases, foldsUAndIu(loinc))) return false;
  return Math.abs(left.factor / right.factor - 1) < 1e-9;
}

/**
 * Families of spellings that are one unit, per `sameUnitScale` (the only notion
 * of equivalence). Singletons and unplaceable units are dropped, not guessed.
 */
export function unitScaleFamilies(units: Iterable<string>, loinc?: string): string[][] {
  const seen = new Set<string>();
  const families: string[][] = [];
  for (const printed of units) {
    const latin = toLatinUnit(printed);
    if (latin === undefined || seen.has(latin)) continue;
    seen.add(latin);
    const family = families.find((members) => sameUnitScale(members[0], latin, loinc));
    if (family) family.push(latin);
    else families.push([latin]);
  }
  return families.filter((members) => members.length > 1);
}

/**
 * Scale-only within a dimension, or mass↔molar via the sibling table's molar
 * mass; undefined whenever the conversion is not exactly known. For reading a
 * mixed-unit history, never a remedy for a code/unit mismatch (checkCodeUnit).
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
    // Across U/[IU] there is no factor unless the analyte permits the fold.
    if (!sameBases(from.bases, to.bases, foldsUAndIu(loinc))) return undefined;
    return { value: (value * from.factor) / to.factor, unit: toUcum };
  }
  if (from.kinds[1] !== 'volume' || to.kinds[1] !== 'volume') return undefined;
  const molarToMass = from.kinds[0] === 'substance' && to.kinds[0] === 'mass';
  const massToMolar = from.kinds[0] === 'mass' && to.kinds[0] === 'substance';
  if (!molarToMass && !massToMolar) return undefined;
  const pair = SIBLING_BY_MASS_LOINC[loinc] ?? SIBLING_BY_MOLAR_LOINC[loinc];
  if (!pair) return undefined;
  const grams = pair.molarMassGPerMol;
  const base = value * from.factor;
  return { value: (molarToMass ? base * grams : base / grams) / to.factor, unit: toUcum };
}

/** The code's curated reference unit (DEFAULT_UNITS, or the sibling table), in UCUM. */
export function canonicalUnitFor(loinc: string): string | undefined {
  const primary = expectedUnitsFor(loinc)[0];
  return primary === undefined ? undefined : toUcum(primary);
}

interface ObservationUnit {
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
  /** Derived for comparability only; the printed pair stays authoritative. */
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


// A stored `unit` is already UCUM, which the printed-spelling stages do not map; a UCUM code
// the tables can place still counts as understood.
function isKnownUcum(unit: string): boolean {
  const parts = splitUnit(clean(unit));
  return parts !== undefined && parts.every((part) => UCUM_POWER_RE.test(part) || part in UCUM_KINDS);
}

/**
 * The unit the unit-vs-LOINC checks read: the stored normalized `unit` when there is one and the
 * tables can place it, else the printed unit. Nothing is written back (ADR-0003).
 */
export function unitForChecks(item: { unit: string; storedUnit?: string }): string {
  const stored = item.storedUnit;
  return stored && (ucumUnitFor(stored) !== undefined || isKnownUcum(stored)) ? stored : item.unit;
}

/** Stages 1–3 in one result plus the derived canonical form; never rewrites the printed pair. */
export function normalizeObservationUnit(observation: ObservationUnit): UnitNormalization {
  const printedUnit = observation.unit ?? '';
  const loinc = observation.loinc ?? '';
  const latinUnit = toLatinUnit(printedUnit);
  const ucumUnit = ucumUnitFor(printedUnit) ?? (isKnownUcum(printedUnit) ? printedUnit.trim() : undefined);
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
