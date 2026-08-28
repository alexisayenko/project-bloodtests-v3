import type { DiagnosticReport } from '../types';
import { LOINC_RE, DEFAULT_UNITS, normalizeUnit } from './loincCheck';

export interface ValidationIssue {
  groupFile: string;
  resultIndex: number;
  level: 'error' | 'warning';
  message: string;
}

export function validateDiagnosticReports(groups: DiagnosticReport[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const group of groups) {
    const items = group.items;
    if (!items) continue;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      const hasValue = item.value != null || (item.rawValue && item.rawValue.trim() !== '');
      if (!item.analysis || !hasValue) {
        const missing = [];
        if (!item.analysis) missing.push('test name');
        if (!hasValue) missing.push('result value');
        issues.push({
          groupFile: group.file,
          resultIndex: i,
          level: 'error',
          message: `Missing required field: ${missing.join(', ')}`,
        });
      }

      if (!item.loinc) {
        issues.push({
          groupFile: group.file,
          resultIndex: i,
          level: 'warning',
          message: `No LOINC code — this observation won't appear in panels or All Observations`,
        });
      } else if (!LOINC_RE.test(item.loinc)) {
        issues.push({
          groupFile: group.file,
          resultIndex: i,
          level: 'error',
          message: `'${item.loinc}' is not a LOINC code (expected digits-checkdigit, e.g. 2093-3)`,
        });
      }

      if (!item.unit) {
        issues.push({
          groupFile: group.file,
          resultIndex: i,
          level: 'warning',
          message: `No unit`,
        });
      } else if (item.loinc && LOINC_RE.test(item.loinc)) {
        const expected = DEFAULT_UNITS[item.loinc];
        if (expected && normalizeUnit(expected) !== normalizeUnit(item.unit)) {
          issues.push({
            groupFile: group.file,
            resultIndex: i,
            level: 'warning',
            message: `Unit '${item.unit}' unexpected for ${item.loinc} (expected ${expected})`,
          });
        }
      }

      const hasRefRange = item.refMin != null && item.refMax != null;
      const hasRefText = item.refText && item.refText.trim() !== '';
      if (!hasRefRange && !hasRefText) {
        issues.push({
          groupFile: group.file,
          resultIndex: i,
          level: 'warning',
          message: `Missing reference range information`,
        });
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
