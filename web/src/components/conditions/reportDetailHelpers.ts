import type { CSSProperties } from 'react';
import type { Analysis, Result } from '../../types';
import { fmtNum } from '../../utils/format';
import type { ValidationIssue } from '../../data/validateDiagnosticReports';
import { latinPart, type CrossCheckResult, type CrossCheckSuggestion } from '../../data/loincCheck';
import { selectByUnit, type NlmEntry } from '../../data/loincNlm';
import { normalizeObservationUnit } from '../../data/unitNormalization';
import { SIBLING_BY_MASS_LOINC, SIBLING_BY_MOLAR_LOINC } from '../../data/massMolarSiblings';
import { ALSO_REFS, ALIAS_TO_PRIMARY } from './markers';

export type EditableField = 'loinc' | 'value' | 'unit';

/** The sibling code a dimension-mismatched row should carry instead. */
export interface UnitRepairSuggestion {
  loinc: string;
  name: string;
  unit: string;
}

export type SuggestionChip = CrossCheckSuggestion | NlmEntry | UnitRepairSuggestion;

export function referenceRangeOf(item: Result): string {
  if (item.refText) return item.refText;
  if (item.refMin != null && item.refMax != null) return `${fmtNum(item.refMin)} - ${fmtNum(item.refMax)}`;
  return '';
}

export function pluralize(n: number): string {
  return n === 1 ? '' : 's';
}

export function applyFieldEdit(item: Result, field: EditableField, newValue: string): Result {
  if (field === 'loinc') return { ...item, loinc: newValue };
  if (field === 'unit') return { ...item, unit: newValue };
  const numVal = Number.parseFloat(newValue);
  return { ...item, value: Number.isNaN(numVal) ? null : numVal, rawValue: newValue };
}

// A confident derivation is applied immediately (draft-gated by Save/Cancel)
// — the user shouldn't have to pick between codes the resolver already
// decided between.
export function computeConfidentFixes(items: Result[], results: CrossCheckResult[]): Map<number, string> {
  const fixes = new Map<number, string>();
  results.forEach((r, i) => {
    const top = r.suggestions?.[0];
    if (r.confident && top && top.loinc !== items[i]!.loinc.trim()) fixes.set(i, top.loinc);
  });
  return fixes;
}

export function applyFixes(items: Result[], fixes: Map<number, string>): Result[] {
  return items.map((item, i) => {
    const fix = fixes.get(i);
    return fix ? { ...item, loinc: fix } : item;
  });
}

export function isRowUnresolved(
  r: CrossCheckResult,
  i: number,
  items: Result[],
  nlmByCode: Record<string, string | null>,
  nlmSuggestions: Record<number, NlmEntry[]>
): boolean {
  if (r.status === 'unknown-code') return nlmByCode[items[i]!.loinc] == null;
  if (r.status === 'no-code') return !r.suggestions?.length && !nlmSuggestions[i]?.length;
  return false;
}

export function buildNlmSuggestionsByRow(
  unresolvedRows: { r: CrossCheckResult; i: number }[],
  items: Result[],
  byName: Record<string, NlmEntry[]>
): Record<number, NlmEntry[]> {
  const perRow: Record<number, NlmEntry[]> = {};
  for (const { r, i } of unresolvedRows) {
    if (r.status !== 'no-code') continue;
    const found = byName[latinPart(items[i]!.analysis)];
    if (found?.length) perRow[i] = selectByUnit(found, items[i]!.unit).slice(0, 3);
  }
  return perRow;
}

// Resolved official name for a row, from the local catalog or the NLM lookup.
export function resolvedNameOf(
  item: Result,
  check: CrossCheckResult | undefined,
  nlmByCode: Record<string, string | null>
): string | undefined {
  if (!check) return undefined;
  if (check.loincName) return check.loincName;
  if (check.status === 'unknown-code') return nlmByCode[item.loinc] ?? undefined;
  return undefined;
}

// Catalog expanded with unit-variant aliases (ALSO_REFS): labs report
// e.g. SHBG as 13967-5 (nmol/L) while the catalog keys it as 2942-1.
export function buildExpandedCatalog(analysesCatalog: Record<string, Analysis>): Analysis[] {
  const base = Object.values(analysesCatalog);
  const byCode = new Map(base.map((a) => [a.loinc, a]));
  const aliases = Object.entries(ALSO_REFS).flatMap(([primary, refs]) => {
    const canonical = byCode.get(primary);
    if (!canonical) return [];
    return refs
      .filter((r) => !byCode.has(r.loinc))
      .map((r) => ({ ...canonical, loinc: r.loinc, longCommonName: r.longCommonName }));
  });
  return [...base, ...aliases];
}

export function getMismatchMessage(
  item: Result,
  check: CrossCheckResult | undefined,
  nameMismatch: boolean
): string | null {
  if (!nameMismatch || !check) return null;
  if (!check.derived) return 'Printed name differs from the LOINC name';
  const loincNameSuffix = check.loincName ? ` is ${check.loincName}` : '';
  return `printed code ${item.loinc.trim()}${loincNameSuffix} — name+unit resolve to ${check.derived.loinc} ${check.derived.name}`;
}

export function getDotColor(itemHasError: boolean, itemHasWarning: boolean, nameMismatch: boolean): string {
  if (itemHasError) return '#ea4335';
  if (itemHasWarning || nameMismatch) return '#fbbc04';
  return '#34a853';
}

export function getDotTitle(itemIssues: ValidationIssue[], mismatchMsg: string | null): string {
  const messages = itemIssues.map((issue) => issue.message);
  if (mismatchMsg) messages.push(mismatchMsg);
  return messages.join('; ') || 'OK';
}

// The row's unit contradicts what its code measures and the sibling table
// knows the code on the printed scale. The repair is the code — the value and
// the unit are what the lab printed (ADR-0003) — and it is offered, never
// applied: which of the two the lab got wrong is a judgement, not a derivation.
export function unitRepairFor(item: Result): UnitRepairSuggestion | undefined {
  if (!item.loinc || !item.unit) return undefined;
  const { check } = normalizeObservationUnit({ loinc: item.loinc, unit: item.unit });
  if (check.kind !== 'dimension-mismatch' || !check.suggestedLoinc) return undefined;
  const pair = SIBLING_BY_MASS_LOINC[item.loinc] ?? SIBLING_BY_MOLAR_LOINC[item.loinc];
  const side = pair && [pair.mass, pair.molar].find((s) => s.loinc === check.suggestedLoinc);
  if (!side) return undefined;
  return { loinc: side.loinc, name: side.longCommonName, unit: side.unit };
}

export function getChipSuggestions(
  check: CrossCheckResult | undefined,
  rowNlmSuggestions: NlmEntry[] | undefined,
  unitRepair?: UnitRepairSuggestion
): SuggestionChip[] {
  const fromCheck = crossCheckChips(check, rowNlmSuggestions);
  if (!unitRepair) return fromCheck;
  return [unitRepair, ...fromCheck.filter((s) => s.loinc !== unitRepair.loinc)];
}

function crossCheckChips(
  check: CrossCheckResult | undefined,
  rowNlmSuggestions: NlmEntry[] | undefined
): SuggestionChip[] {
  if (!check) return [];
  const isResolvableStatus = check.status === 'no-code' || check.status === 'malformed' || check.status === 'mismatch';
  if (!isResolvableStatus) return [];
  if (check.suggestions?.length) return check.suggestions;
  return rowNlmSuggestions ?? [];
}

// Show the unit only where it disambiguates: on a known unit-variant code,
// or when two chips share a name.
export function getUnitLabel(suggestion: SuggestionChip, chipSuggestions: SuggestionChip[]): string {
  if (!suggestion.unit) return '';
  const disambiguates =
    suggestion.loinc in ALIAS_TO_PRIMARY ||
    suggestion.loinc in ALSO_REFS ||
    chipSuggestions.some((o) => o !== suggestion && o.name === suggestion.name);
  return disambiguates ? ` · ${suggestion.unit}` : '';
}

export function saveButtonStyle(hasErrors: boolean): CSSProperties {
  return {
    padding: '8px 16px',
    backgroundColor: hasErrors ? '#ccc' : '#1971c2',
    color: 'white',
    border: 'none',
    borderRadius: 4,
    fontSize: 13,
    cursor: hasErrors ? 'not-allowed' : 'pointer',
    opacity: hasErrors ? 0.5 : 1,
  };
}

export function saveButtonLabel(isSaving: boolean): string {
  return isSaving ? 'Saving...' : 'Save';
}
