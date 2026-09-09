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
 * The LOINC "Kind of Property" a long common name states in its bracket —
 * "Mass/volume", "Moles/volume", "Enzymatic activity/volume", "Units/volume".
 * The catalog stores no property field, so the name is the only place it is
 * recorded; a name with no bracket ("Prothrombin time (PT)") yields undefined.
 */
export function propertyOf(longCommonName: string | undefined): string | undefined {
  return longCommonName?.match(/\[([^[\]]*)\]/)?.[1];
}

/**
 * Why an analyte's "U" and its "IU" name one and the same unit. Two LOINC
 * properties permit that fold, and they permit it for opposite reasons — which
 * is exactly why the permission is asked of the analyte's property rather than
 * of the spelling, and why one name covers both:
 *
 * - `catalytic-activity`: the measurement is an enzyme activity, whose unit is
 *   the 1964 enzyme unit of 1 µmol/min. That unit's own name is U; a lab that
 *   prints "IU" for it is writing the same unit loosely, so here IU means U.
 * - `arbitrary-unit`: the measurement is against a WHO International Unit, which
 *   LOINC files under "Units/volume". That unit's own name is IU; a lab that
 *   prints "U" for it is writing the same unit loosely, so here U means IU.
 *
 * Under every other property the two are different scales and stay apart, and
 * so does a WHO IU of one analyte against a WHO IU of another — the fold is
 * within one code's own history of spellings, never across analytes.
 */
export type UIuFoldReason = 'catalytic-activity' | 'arbitrary-unit';

const U_IU_FOLD_PROPERTIES: Record<string, UIuFoldReason> = {
  'Enzymatic activity/volume': 'catalytic-activity',
  'Catalytic activity/volume': 'catalytic-activity',
  'Enzymatic activity/mass': 'catalytic-activity',
  'Units/volume': 'arbitrary-unit',
  'Arbitrary concentration': 'arbitrary-unit',
};

/**
 * Each code that permits the U/IU fold, mapped to its reason. Derived from the
 * catalog's own long common names (ADR-0010), never a hand-kept analyte list; a
 * code whose property is absent from the table above is simply not in here. See
 * `sameUnitScale` in unitNormalization.ts, the one place it is acted on.
 */
export const U_IU_FOLD_REASON: Readonly<Record<string, UIuFoldReason>> = Object.fromEntries(
  ANALYTES.map((a) => [a.loinc, U_IU_FOLD_PROPERTIES[propertyOf(a.longCommonName) ?? '']]).filter(
    (entry): entry is [string, UIuFoldReason] => entry[1] !== undefined
  )
);

/** The codes permitting the fold under one reason — ALT, AST and the rest, or insulin and the WHO-standardised hormones. */
export function loincsFoldingUAndIu(reason: UIuFoldReason): string[] {
  return Object.keys(U_IU_FOLD_REASON).filter((loinc) => U_IU_FOLD_REASON[loinc] === reason);
}

/**
 * The specimen a LOINC is measured in, read out of the long common name — LOINC
 * names its system in an "… in Serum or Plasma" / "… of Blood" clause, optionally
 * followed by a method ("… by Automated count"). The catalog stores no specimen
 * field, so this is the only place it can come from; a name that carries no such
 * clause ("Prothrombin time (PT)") yields undefined rather than a guess. The
 * property bracket is excluded so a match can never run through "[Entitic mass]".
 * Group 1 is the specimen, group 2 the method that trails it — captured rather
 * than swallowed so `trimmedLongName` can put the method back.
 */
const SPECIMEN_CLAUSE = /\s(?:in|of)\s([^[\]]+?)(\s+by\s.*)?$/;

export function specimenOf(longCommonName: string | undefined): string | undefined {
  return longCommonName?.match(SPECIMEN_CLAUSE)?.[1];
}

/**
 * A LOINC property bracket — "[Mass/volume]", "[#/volume]", "[Presence]". Every
 * bracketed token in the catalog is one of these; no long name brackets anything else.
 */
const PROPERTY_BRACKET = /\s*\[[^[\]]*\]/g;

/**
 * The long common name with the two parts a table can show in columns of their own
 * taken off: the property bracket and the "… in <System>" clause `specimenOf` reads.
 * The trailing "by <method>" is always kept — it is what separates two codes for the
 * same analyte (CRP from high-sensitivity CRP, ESR from Westergren), so dropping it
 * would render genuinely different tests as identical rows. Display only — the stored
 * name stays authoritative, and a name carrying neither part comes back unchanged.
 * Never empties a name: trimming everything away yields the original.
 */
export function trimmedLongName(longCommonName: string): string {
  const trimmed = longCommonName
    .replace(SPECIMEN_CLAUSE, '$2')
    .replace(PROPERTY_BRACKET, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return trimmed || longCommonName;
}

export const SPECIMENS: Record<string, string> = Object.fromEntries(
  ANALYTES.map((a) => [a.loinc, specimenOf(a.longCommonName)]).filter((e): e is [string, string] => !!e[1])
);
