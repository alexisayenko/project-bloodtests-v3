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
  it('warns when the unit contradicts the curated unit for the code', () => {
    const groups = [createGroup({ items: [createResult({ loinc: '15081-3', analysis: 'Prolactin', unit: 'ng/mL', refText: '1-2' })] })];
    const issues = validateDiagnosticReports(groups);
    const unitIssue = issues.find((i) => i.message.includes('unexpected for 15081-3'));
    expect(unitIssue?.level).toBe('warning');
    expect(unitIssue?.message).toContain('mIU/L');
  });

  it('accepts the curated unit for the code, across spellings', () => {
    const groups = [
      createGroup({ items: [createResult({ loinc: '15081-3', analysis: 'Prolactin', unit: 'mIU/L', refText: '1-2' })] }),
      createGroup({ file: 'f2', items: [createResult({ loinc: '5763-8', analysis: 'Zinc', unit: 'μg/dL', refText: '1-2' })] }),
    ];
    const issues = validateDiagnosticReports(groups);
    expect(issues.filter((i) => i.message.includes('unexpected'))).toHaveLength(0);
  });

  it('does not warn on a Cyrillic spelling of the code\'s own unit', () => {
    const groups = [
      createGroup({ items: [createResult({ loinc: '2951-2', analysis: 'Sodium', unit: 'ммоль/л', refText: '1-2' })] }),
      createGroup({ file: 'f2', items: [createResult({ loinc: '14682-9', analysis: 'Creatinine', unit: 'мкмоль/л', refText: '1-2' })] }),
    ];
    const issues = validateDiagnosticReports(groups);
    expect(issues.filter((i) => i.message.includes('unexpected'))).toHaveLength(0);
  });

  it('still warns on a Cyrillic unit that is wrong for the code', () => {
    const groups = [createGroup({ items: [createResult({ loinc: '14682-9', analysis: 'Creatinine', unit: 'ммоль/л', refText: '1-2' })] })];
    const issue = validateDiagnosticReports(groups).find((i) => i.message.includes('unexpected for 14682-9'));
    expect(issue?.level).toBe('warning');
  });

  it('accepts every allowed unit for a code with a unit set (DHT ng/dL and pg/mL)', () => {
    const groups = [
      createGroup({ items: [createResult({ loinc: '1848-1', analysis: 'DHT', unit: 'ng/dL', refText: '1-2' })] }),
      createGroup({ file: 'f2', items: [createResult({ loinc: '1848-1', analysis: 'DHT', unit: 'pg/mL', refText: '1-2' })] }),
    ];
    const issues = validateDiagnosticReports(groups);
    expect(issues.filter((i) => i.message.includes('unexpected'))).toHaveLength(0);
  });

  it('warns listing all accepted units when none match', () => {
    const groups = [createGroup({ items: [createResult({ loinc: '1848-1', analysis: 'DHT', unit: 'nmol/L', refText: '1-2' })] })];
    const issue = validateDiagnosticReports(groups).find((i) => i.message.includes('unexpected for 1848-1'));
    expect(issue?.level).toBe('warning');
    expect(issue?.message).toContain('expected ng/dL or pg/mL');
  });

  it('names the mass/molar sibling code when the unit measures the wrong quantity', () => {
    const groups = [
      createGroup({
        items: [createResult({ loinc: '2093-3', analysis: 'Cholesterol', value: 4.8, unit: 'mmol/L', refText: '1-2' })],
      }),
    ];
    const issues = validateDiagnosticReports(groups);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.level).toBe('warning');
    expect(issues[0]?.message).toBe(
      `Unit 'mmol/L' measures a different quantity than 2093-3 — 14647-2 is the same analyte on that scale (change the code, not the value)`
    );
  });

  it('reads the Cyrillic spelling of a molar unit as the same code problem', () => {
    const groups = [
      createGroup({
        items: [createResult({ loinc: '2160-0', analysis: 'Creatinine', value: 72, unit: 'мкмоль/л', refText: '1-2' })],
      }),
    ];
    const issue = validateDiagnosticReports(groups)[0];
    expect(issue?.message).toContain('14682-9 is the same analyte on that scale');
  });

  it('warns when the unit is in neither the Latin nor the UCUM tables', () => {
    const groups = [createGroup({ items: [createResult({ loinc: '1234567-0', unit: 'blorp/L' })] })];
    const issues = validateDiagnosticReports(groups);
    expect(issues).toHaveLength(1);
    expect(issues[0]?.level).toBe('warning');
    expect(issues[0]?.message).toBe(
      `Unit 'blorp/L' is not in the unit tables — left exactly as printed, and not comparable across units`
    );
  });

  it('adds no unit warning to a report whose units all normalize', () => {
    const groups = [
      createGroup({
        items: [
          createResult({ loinc: '718-7', unit: 'g/dL' }),
          createResult({ loinc: '2093-3', analysis: 'Cholesterol', value: 186, unit: 'mg/dL', refText: '1-2' }),
          createResult({ loinc: '2160-0', analysis: 'Creatinine', value: 0.9, unit: 'mg/dL', refText: '1-2' }),
        ],
      }),
    ];
    expect(validateDiagnosticReports(groups)).toHaveLength(0);
  });

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
    // 718-7 keeps the default g/dL unit consistent; the others have no curated unit.
    for (const loinc of ['718-7', '1-8', '1234567-0']) {
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

  it('accepts an observation carrying either a value or a rawValue', () => {
    expect(validateDiagnosticReports([createGroup({ items: [createResult({ value: null })] })])).toHaveLength(0);
    expect(validateDiagnosticReports([createGroup({ items: [createResult({ rawValue: '' })] })])).toHaveLength(0);
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

  it('accepts a reference given either as printed text or as numeric bounds', () => {
    expect(
      validateDiagnosticReports([createGroup({ items: [createResult({ refMin: null, refMax: null, refText: 'Normal' })] })])
    ).toHaveLength(0);
    expect(
      validateDiagnosticReports([createGroup({ items: [createResult({ refText: '', refMin: 13, refMax: 17 })] })])
    ).toHaveLength(0);
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

describe('issue predicates', () => {
  const issue = (level: 'error' | 'warning', groupFile = 'file-a'): ValidationIssue => ({
    groupFile,
    resultIndex: 0,
    level,
    message: 'test',
  });

  it('hasErrors is true only when some issue is an error', () => {
    expect(hasErrors([issue('error')])).toBe(true);
    expect(hasErrors([issue('warning')])).toBe(false);
    expect(hasErrors([])).toBe(false);
  });

  it('the group predicates read the level and the group the issue belongs to', () => {
    expect(groupHasErrors('file-a', [issue('error')])).toBe(true);
    expect(groupHasErrors('file-a', [issue('warning')])).toBe(false);
    expect(groupHasErrors('file-a', [issue('error', 'file-b')])).toBe(false);

    expect(groupHasWarnings('file-a', [issue('warning')])).toBe(true);
    expect(groupHasWarnings('file-a', [issue('error')])).toBe(false);
    expect(groupHasWarnings('file-a', [issue('warning', 'file-b')])).toBe(false);
  });
});
