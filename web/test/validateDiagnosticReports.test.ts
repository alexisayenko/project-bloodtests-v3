import { describe, it, expect } from 'vitest';
import {
  validateDiagnosticReports,
  hasErrors,
  groupHasErrors,
  groupHasWarnings,
  type ValidationIssue,
} from '../src/data/validateDiagnosticReports';
import type { DiagnosticReport, Result } from '../src/types';

const createResult = (overrides?: Partial<Result>): Result => ({
  loinc: '718-7',
  analysis: 'Hemoglobin',
  symbol: 'Hgb',
  section: '',
  value: 14.2,
  rawValue: '14.2',
  valueQualifier: '',
  unit: 'g/dL',
  refText: '13.5 - 17.5',
  refMin: 13.5,
  refMax: 17.5,
  method: '',
  ...overrides,
});

const createGroup = (overrides?: Partial<DiagnosticReport>): DiagnosticReport => ({
  date: '2026-01-10',
  place: 'Lab A',
  file: 'test-file',
  items: [createResult()],
  itemCount: 1,
  ...overrides,
});

describe('validateDiagnosticReports', () => {
  it('returns no issues for a valid complete record', () => {
    const groups = [createGroup()];
    const issues = validateDiagnosticReports(groups);
    expect(issues).toHaveLength(0);
  });

  it('reports warning when loinc is missing', () => {
    const groups = [createGroup({ items: [createResult({ loinc: '' })] })];
    const issues = validateDiagnosticReports(groups);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.level).toBe('warning');
    expect(issues[0]?.message).toContain("won't appear in panels");
  });

  it('reports error when loinc is not a valid LOINC code', () => {
    const groups = [createGroup({ items: [createResult({ loinc: '900101' })] })];
    const issues = validateDiagnosticReports(groups);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.level).toBe('error');
    expect(issues[0]?.message).toContain("'900101' is not a LOINC code");
  });

  it('accepts well-formed LOINC codes of varying length', () => {
    for (const loinc of ['2093-3', '1-8', '1234567-0']) {
      const issues = validateDiagnosticReports([createGroup({ items: [createResult({ loinc })] })]);
      expect(issues).toHaveLength(0);
    }
  });

  it('reports error when analysis is missing', () => {
    const groups = [createGroup({ items: [createResult({ analysis: '' })] })];
    const issues = validateDiagnosticReports(groups);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.level).toBe('error');
  });

  it('does not report error when value is null but rawValue is present', () => {
    const groups = [createGroup({ items: [createResult({ value: null })] })];
    const issues = validateDiagnosticReports(groups);
    expect(issues).toHaveLength(0);
  });

  it('does not report error when rawValue is empty but value is present', () => {
    const groups = [createGroup({ items: [createResult({ rawValue: '' })] })];
    const issues = validateDiagnosticReports(groups);
    expect(issues).toHaveLength(0);
  });

  it('reports error when value is null and rawValue is empty', () => {
    const groups = [createGroup({ items: [createResult({ value: null, rawValue: '' })] })];
    const issues = validateDiagnosticReports(groups);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.level).toBe('error');
    expect(issues[0]?.message).toContain('result value');
  });

  it('reports warning when unit is missing', () => {
    const groups = [createGroup({ items: [createResult({ unit: '' })] })];
    const issues = validateDiagnosticReports(groups);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.level).toBe('warning');
    expect(issues[0]?.message).toBe('No unit');
  });

  it('reports warning when both refMin/refMax are null', () => {
    const groups = [createGroup({ items: [createResult({ refMin: null, refMax: null, refText: '' })] })];
    const issues = validateDiagnosticReports(groups);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.level).toBe('warning');
  });

  it('does not report warning when refText is present', () => {
    const groups = [createGroup({ items: [createResult({ refMin: null, refMax: null, refText: 'Normal' })] })];
    const issues = validateDiagnosticReports(groups);
    expect(issues).toHaveLength(0);
  });

  it('does not report warning when refMin and refMax are present', () => {
    const groups = [createGroup({ items: [createResult({ refText: '', refMin: 13, refMax: 17 })] })];
    const issues = validateDiagnosticReports(groups);
    expect(issues).toHaveLength(0);
  });

  it('sorts issues by groupFile then resultIndex', () => {
    const groups = [
      createGroup({
        file: 'file-b',
        items: [createResult({ loinc: '' }), createResult({ loinc: '' })],
      }),
      createGroup({
        file: 'file-a',
        items: [createResult({ loinc: '' })],
      }),
    ];
    const issues = validateDiagnosticReports(groups);
    expect(issues.map((i) => `${i.groupFile}:${i.resultIndex}`)).toEqual(['file-a:0', 'file-b:0', 'file-b:1']);
  });
});

describe('hasErrors', () => {
  it('returns true when there are any errors', () => {
    const issues: ValidationIssue[] = [
      { groupFile: 'file', resultIndex: 0, level: 'error', message: 'test' },
    ];
    expect(hasErrors(issues)).toBe(true);
  });

  it('returns false when there are only warnings', () => {
    const issues: ValidationIssue[] = [
      { groupFile: 'file', resultIndex: 0, level: 'warning', message: 'test' },
    ];
    expect(hasErrors(issues)).toBe(false);
  });

  it('returns false for empty issues', () => {
    expect(hasErrors([])).toBe(false);
  });
});

describe('groupHasErrors', () => {
  it('returns true for errors in the specified group', () => {
    const issues: ValidationIssue[] = [
      { groupFile: 'file-a', resultIndex: 0, level: 'error', message: 'test' },
    ];
    expect(groupHasErrors('file-a', issues)).toBe(true);
  });

  it('returns false when the group has no errors', () => {
    const issues: ValidationIssue[] = [
      { groupFile: 'file-a', resultIndex: 0, level: 'warning', message: 'test' },
    ];
    expect(groupHasErrors('file-a', issues)).toBe(false);
  });
});

describe('groupHasWarnings', () => {
  it('returns true for warnings in the specified group', () => {
    const issues: ValidationIssue[] = [
      { groupFile: 'file-a', resultIndex: 0, level: 'warning', message: 'test' },
    ];
    expect(groupHasWarnings('file-a', issues)).toBe(true);
  });

  it('returns false when the group has no warnings', () => {
    const issues: ValidationIssue[] = [
      { groupFile: 'file-a', resultIndex: 0, level: 'error', message: 'test' },
    ];
    expect(groupHasWarnings('file-a', issues)).toBe(false);
  });
});
