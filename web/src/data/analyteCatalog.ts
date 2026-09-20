import type { Analysis, LoincRef } from '../types';
import catalog from '../../public/data/analyses.json';

/** The single source of truth per LOINC; every lookup map below is derived from it, none hand-kept (ADR-0010). */
export const ANALYTES = catalog as Analysis[];

export const ANALYTE_BY_LOINC: Record<string, Analysis> = Object.fromEntries(
  ANALYTES.map((a) => [a.loinc, a])
);

/** Short name plus reference unit, for the analytes that carry one. */
export const SHORT_NAMES: Record<string, { shortName: string; unit: string }> = Object.fromEntries(
  ANALYTES.filter((a) => a.shortName).map((a) => [a.loinc, { shortName: a.shortName!, unit: a.unit ?? '' }])
);

/** Primary LOINC → its variant codes, in catalog order. */
export const ALSO_REFS: Record<string, LoincRef[]> = ANALYTES.reduce<Record<string, LoincRef[]>>(
  (acc, a) => {
    if (!a.aliasOf) return acc;
    acc[a.aliasOf] ??= [];
    acc[a.aliasOf].push({
      aliasLabel: a.aliasLabel ?? '',
      loinc: a.loinc,
      longCommonName: a.longCommonName,
      unit: a.unit ?? '',
    });
    return acc;
  },
  {}
);

/** Reverse of ALSO_REFS: a variant code → the primary whose row it folds into. */
export const ALIAS_TO_PRIMARY: Record<string, string> = Object.fromEntries(
  ANALYTES.filter((a) => a.aliasOf).map((a) => [a.loinc, a.aliasOf!])
);

/** Known reference unit per LOINC — what lets a row's unit pick the right variant. */
export const DEFAULT_UNITS: Record<string, string> = Object.fromEntries(
  ANALYTES.filter((a) => a.unit).map((a) => [a.loinc, a.unit!])
);

/** Extra accepted units per LOINC, beyond the reference one. */
export const ALLOWED_UNITS: Record<string, string[]> = Object.fromEntries(
  ANALYTES.filter((a) => a.allowedUnits?.length).map((a) => [a.loinc, a.allowedUnits!])
);

/** Per-LOINC printed-unit aliases (ADR-0010): a printed spelling that denotes the code's reference unit. */
export const PRINTED_UNIT_ALIASES: Record<string, Record<string, string>> = Object.fromEntries(
  ANALYTES.filter((a) => a.printedUnitAliases).map((a) => [a.loinc, a.printedUnitAliases!])
);

/** The LOINC property from the long name's bracket — the catalog stores no property field. */
export function propertyOf(longCommonName: string | undefined): string | undefined {
  return longCommonName?.match(/\[([^[\]]*)\]/)?.[1];
}

/**
 * Why "U" and "IU" are one unit for an analyte: an enzyme activity's unit is U
 * (a printed IU means U); a WHO International Unit's is IU (a printed U means
 * IU). The fold is within one code's spellings, never across analytes.
 */
export type UIuFoldReason = 'catalytic-activity' | 'arbitrary-unit';

const U_IU_FOLD_PROPERTIES: Record<string, UIuFoldReason> = {
  'Enzymatic activity/volume': 'catalytic-activity',
  'Catalytic activity/volume': 'catalytic-activity',
  'Enzymatic activity/mass': 'catalytic-activity',
  'Units/volume': 'arbitrary-unit',
  'Arbitrary concentration': 'arbitrary-unit',
};

/** Derived from the long common names, never a hand-kept list; acted on only in `sameUnitScale`. */
export const U_IU_FOLD_REASON: Readonly<Record<string, UIuFoldReason>> = Object.fromEntries(
  ANALYTES.map((a) => [a.loinc, U_IU_FOLD_PROPERTIES[propertyOf(a.longCommonName) ?? '']]).filter(
    (entry): entry is [string, UIuFoldReason] => entry[1] !== undefined
  )
);

export function loincsFoldingUAndIu(reason: UIuFoldReason): string[] {
  return Object.keys(U_IU_FOLD_REASON).filter((loinc) => U_IU_FOLD_REASON[loinc] === reason);
}

// The "… in <System> [by <method>]" clause of a long common name. A scanner
// rather than one regex, so no lazy group backtracks against an optional tail;
// it reproduces `/\s(?:in|of)\s([^[\]]+?)(\s+by\s.*)?$/` exactly.
interface SpecimenClause {
  start: number;
  specimen: string;
  method: string;
}

const CLAUSE_OPENER = /\s(?:in|of)\s/g;
const METHOD_TAIL = /^\s+by\s.*$/;

function clauseAt(name: string, start: number, bodyStart: number): SpecimenClause | undefined {
  for (let end = bodyStart + 1; end <= name.length; end++) {
    const last = name[end - 1];
    if (last === '[' || last === ']') return undefined;
    if (end === name.length) return { start, specimen: name.slice(bodyStart), method: '' };
    const rest = name.slice(end);
    if (METHOD_TAIL.test(rest)) return { start, specimen: name.slice(bodyStart, end), method: rest };
  }
  return undefined;
}

function findSpecimenClause(name: string): SpecimenClause | undefined {
  const opener = new RegExp(CLAUSE_OPENER);
  for (let m = opener.exec(name); m; m = opener.exec(name)) {
    const clause = clauseAt(name, m.index, m.index + m[0].length);
    if (clause) return clause;
    opener.lastIndex = m.index + 1;
  }
  return undefined;
}

export function specimenOf(longCommonName: string | undefined): string | undefined {
  if (!longCommonName) return undefined;
  return findSpecimenClause(longCommonName)?.specimen;
}

const PROPERTY_BRACKET = /\[[^[\]]*\]/g;

/**
 * Long name minus the property bracket and specimen clause, for display. The
 * "by <method>" tail is kept — it is what separates CRP from hs-CRP.
 */
export function trimmedLongName(longCommonName: string): string {
  const clause = findSpecimenClause(longCommonName);
  const withoutSpecimen = clause ? longCommonName.slice(0, clause.start) + clause.method : longCommonName;
  const trimmed = withoutSpecimen
    .replace(PROPERTY_BRACKET, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return trimmed || longCommonName;
}

export const SPECIMENS: Record<string, string> = Object.fromEntries(
  ANALYTES.map((a) => [a.loinc, specimenOf(a.longCommonName)]).filter((e): e is [string, string] => !!e[1])
);
