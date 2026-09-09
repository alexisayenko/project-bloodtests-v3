import type { Analysis, LoincRef } from '../types';
import catalog from '../../public/data/analyses.json';

/**
 * The analyte catalog is the single source of truth for everything the app
 * knows about a LOINC code: its names and translations, its badge label, the
 * unit it is expected in, any further units accepted for it, and which codes
 * are unit or method variants of which. The lookup maps below are derived from
 * it at load — none of them is hand-maintained.
 */
export const ANALYTES = catalog as Analysis[];

export const ANALYTE_BY_LOINC: Record<string, Analysis> = Object.fromEntries(
  ANALYTES.map((a) => [a.loinc, a])
);

/** Badge label plus reference unit, for the analytes that carry one. */
export const SHORT_LABELS: Record<string, { short: string; unit: string }> = Object.fromEntries(
  ANALYTES.filter((a) => a.short).map((a) => [a.loinc, { short: a.short!, unit: a.unit ?? '' }])
);

/** Primary LOINC → its variant codes, in catalog order. */
export const ALSO_REFS: Record<string, LoincRef[]> = ANALYTES.reduce<Record<string, LoincRef[]>>(
  (acc, a) => {
    if (!a.aliasOf) return acc;
    acc[a.aliasOf] ??= [];
    acc[a.aliasOf].push({
      label: a.aliasLabel ?? '',
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

/**
 * The specimen a LOINC is measured in, read out of the long common name — LOINC
 * names its system in an "… in Serum or Plasma" / "… of Blood" clause, optionally
 * followed by a method ("… by Automated count"). The catalog stores no specimen
 * field, so this is the only place it can come from; a name that carries no such
 * clause ("Prothrombin time (PT)") yields undefined rather than a guess. The
 * property bracket is excluded so a match can never run through "[Entitic mass]".
 */
const SPECIMEN_CLAUSE = /\s(?:in|of)\s([^[\]]+?)(?:\s+by\s.*)?$/;

export function specimenOf(longCommonName: string | undefined): string | undefined {
  return longCommonName?.match(SPECIMEN_CLAUSE)?.[1];
}

export const SPECIMENS: Record<string, string> = Object.fromEntries(
  ANALYTES.map((a) => [a.loinc, specimenOf(a.longCommonName)]).filter((e): e is [string, string] => !!e[1])
);
