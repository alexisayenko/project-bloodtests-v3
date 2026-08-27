import type { Result, DiagnosticReport } from '../types';

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
      if (!item.loinc || !item.analysis || !hasValue || !item.unit) {
        const missing = [];
        if (!item.loinc) missing.push('LOINC');
        if (!item.analysis) missing.push('test name');
        if (!hasValue) missing.push('result value');
        if (!item.unit) missing.push('unit');
        issues.push({
          groupFile: group.file,
          resultIndex: i,
          level: 'error',
          message: `Missing required field: ${missing.join(', ')}`,
        });
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
