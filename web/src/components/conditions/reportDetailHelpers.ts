import type { Analysis, Result } from '../../types';
import { fmtNum } from '../../utils/format';
import type { ValidationIssue } from '../../data/validateDiagnosticReports';
import { latinPart, type CrossCheckResult, type CrossCheckSuggestion } from '../../data/loincCheck';
import { selectByUnit, type NlmEntry } from '../../data/loincNlm';
import { normalizeObservationUnit, unitForChecks } from '../../data/unitNormalization';
import { SIBLING_BY_MASS_LOINC, SIBLING_BY_MOLAR_LOINC } from '../../data/massMolarSiblings';
import { ALSO_REFS, ALIAS_TO_PRIMARY } from './markers';
import { COLOR } from '../../styles/tokens';

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

/** The Unit cell shows the file's stored `unit` when it has one, with the differing printed unit as a note. */
export function unitCellOf(item: Result): { unit: string; printed: string | null } {
  if (item.storedUnit === undefined) return { unit: item.unit, printed: null };
  return { unit: item.storedUnit, printed: item.unit && item.unit !== item.storedUnit ? item.unit : null };
}

export function applyFieldEdit(item: Result, field: EditableField, newValue: string): Result {
  if (field === 'loinc') return { ...item, loinc: newValue };
  if (field === 'unit') return item.storedUnit === undefined ? { ...item, unit: newValue } : { ...item, storedUnit: newValue };
  const numVal = Number.parseFloat(newValue);
  return { ...item, value: Number.isNaN(numVal) ? null : numVal, rawValue: newValue };
}

// A confident derivation is applied straight into the draft (still gated by Save/Cancel).
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
    const found = byName[latinPart(items[i]!.rawName)];
    if (found?.length) perRow[i] = selectByUnit(found, items[i]!.unit).slice(0, 3);
  }
  return perRow;
}

export function resolvedNameOf(
  item: Result,
  check: CrossCheckResult | undefined,
  nlmByCode: Record<string, string | null>
): string | undefined {
  if (!check) return undefined;
  if (check.resolvedName) return check.resolvedName;
  if (check.status === 'unknown-code') return nlmByCode[item.loinc] ?? undefined;
  return undefined;
}

// Expanded with unit-variant aliases, since labs report e.g. SHBG under 13967-5 while the catalog keys 2942-1.
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
  if (!check.derived) return 'Printed name matches none of the names this code carries (friendly, short, LOINC or translated)';
  const resolvedNameSuffix = check.resolvedName ? ` is ${check.resolvedName}` : '';
  return `printed code ${item.loinc.trim()}${resolvedNameSuffix} — name+unit resolve to ${check.derived.loinc} ${check.derived.name}`;
}

export function getDotColor(itemHasError: boolean, itemHasWarning: boolean, nameMismatch: boolean): string {
  if (itemHasError) return COLOR.statusBad;
  if (itemHasWarning || nameMismatch) return COLOR.statusWarn;
  return COLOR.statusOk;
}

export function getDotTitle(itemIssues: ValidationIssue[], mismatchMsg: string | null): string {
  const messages = itemIssues.map((issue) => issue.message);
  if (mismatchMsg) messages.push(mismatchMsg);
  return messages.join('; ') || 'OK';
}

// The repair is the code, never the printed value or unit (ADR-0003), and it is offered, never auto-applied.
export function unitRepairFor(item: Result): UnitRepairSuggestion | undefined {
  if (!item.loinc || !item.unit) return undefined;
  const { check } = normalizeObservationUnit({ loinc: item.loinc, unit: unitForChecks(item) });
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

// The unit is shown only where it disambiguates.
export function getUnitLabel(suggestion: SuggestionChip, chipSuggestions: SuggestionChip[]): string {
  if (!suggestion.unit) return '';
  const disambiguates =
    suggestion.loinc in ALIAS_TO_PRIMARY ||
    suggestion.loinc in ALSO_REFS ||
    chipSuggestions.some((o) => o !== suggestion && o.name === suggestion.name);
  return disambiguates ? ` · ${suggestion.unit}` : '';
}

export function saveButtonLabel(isSaving: boolean): string {
  return isSaving ? 'Saving...' : 'Save';
}
