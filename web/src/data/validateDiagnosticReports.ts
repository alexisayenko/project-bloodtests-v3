import type { DiagnosticReport, Result } from '../types';
import { LOINC_RE, unitAllowed } from './loincCheck';
import { DEFAULT_UNITS, ALLOWED_UNITS } from './analyteCatalog';
import { normalizeObservationUnit, type UnitNormalization } from './unitNormalization';

export interface ValidationIssue {
  groupFile: string;
  resultIndex: number;
  level: 'error' | 'warning';
  message: string;
}

type Issue = Pick<ValidationIssue, 'level' | 'message'>;

function checkNameAndValue(item: Result): Issue | null {
  const hasValue = item.value != null || (item.rawValue && item.rawValue.trim() !== '');
  if (item.analysis && hasValue) return null;
  const missing = [];
  if (!item.analysis) missing.push('test name');
  if (!hasValue) missing.push('result value');
  return { level: 'error', message: `Missing required field: ${missing.join(', ')}` };
}

function checkLoinc(item: Result): Issue | null {
  if (!item.loinc) {
    return {
      level: 'warning',
      message: `No LOINC code — this observation won't appear in panels or All Observations`,
    };
  }
  if (!LOINC_RE.test(item.loinc)) {
    return {
      level: 'error',
      message: `'${item.loinc}' is not a LOINC code (expected digits-checkdigit, e.g. 2093-3)`,
    };
  }
  return null;
}

function checkUnitDimension(item: Result, normalization: UnitNormalization): Issue | null {
  if (!item.loinc || !LOINC_RE.test(item.loinc)) return null;

  const { check } = normalization;
  const sibling = check.kind === 'dimension-mismatch' ? check.suggestedLoinc : undefined;
  if (sibling) {
    // The value is right and the code is wrong: converting the number
    // would invent a reading no lab printed (ADR-0003).
    return {
      level: 'warning',
      message: `Unit '${item.unit}' measures a different quantity than ${item.loinc} — ${sibling} is the same analyte on that scale (change the code, not the value)`,
    };
  }

  if (unitAllowed(item.loinc, item.unit) === false) {
    const accepted = [DEFAULT_UNITS[item.loinc], ...(ALLOWED_UNITS[item.loinc] ?? [])].filter(
      (u): u is string => Boolean(u)
    );
    return {
      level: 'warning',
      message: `Unit '${item.unit}' unexpected for ${item.loinc} (expected ${accepted.join(' or ')})`,
    };
  }

  return null;
}

function checkUnit(item: Result): Issue[] {
  if (!item.unit) {
    return [{ level: 'warning', message: `No unit` }];
  }

  const issues: Issue[] = [];
  const normalization = normalizeObservationUnit({ loinc: item.loinc, unit: item.unit });

  const dimensionIssue = checkUnitDimension(item, normalization);
  if (dimensionIssue) issues.push(dimensionIssue);

  if (normalization.ucumUnit === undefined) {
    issues.push({
      level: 'warning',
      message: `Unit '${item.unit}' is not in the unit tables — left exactly as printed, and not comparable across units`,
    });
  }

  return issues;
}

function checkRefRange(item: Result): Issue | null {
  const hasRefRange = item.refMin != null && item.refMax != null;
  const hasRefText = item.refText && item.refText.trim() !== '';
  if (hasRefRange || hasRefText) return null;
  return { level: 'warning', message: `Missing reference range information` };
}

function validateItem(item: Result): Issue[] {
  return [checkNameAndValue(item), checkLoinc(item), ...checkUnit(item), checkRefRange(item)].filter(
    (issue): issue is Issue => issue !== null
  );
}

export function validateDiagnosticReports(groups: DiagnosticReport[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const group of groups) {
    const items = group.items;
    if (!items) continue;

    for (let i = 0; i < items.length; i++) {
      for (const issue of validateItem(items[i])) {
        issues.push({ groupFile: group.file, resultIndex: i, ...issue });
      }
    }
  }

  issues.sort((a, b) => {
    if (a.groupFile !== b.groupFile) return a.groupFile.localeCompare(b.groupFile);
    return a.resultIndex - b.resultIndex;
  });

  return issues;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.level === 'error');
}

export function groupHasErrors(groupFile: string, issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.groupFile === groupFile && issue.level === 'error');
}

export function groupHasWarnings(groupFile: string, issues: ValidationIssue[]): boolean {
  return issues.some((issue) => issue.groupFile === groupFile && issue.level === 'warning');
}
