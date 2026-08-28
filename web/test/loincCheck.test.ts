import { describe, it, expect } from 'vitest';
import { LOINC_RE, latinPart, tokenOverlap, crossCheckLocal } from '../src/data/loincCheck';
import type { Analysis, Result } from '../src/types';

const createResult = (overrides?: Partial<Result>): Result => ({
  loinc: '2345-7',
  analysis: 'Glucose',
  symbol: 'GLU',
  section: '',
  value: 90,
  rawValue: '90',
  valueQualifier: '',
  unit: 'mg/dL',
  refText: '',
  refMin: 70,
  refMax: 100,
  method: '',
  ...overrides,
});

const catalog: Analysis[] = [
  {
    loinc: '2345-7',
    longCommonName: 'Glucose [Mass/volume] in Serum or Plasma',
    displayName: 'Glucose',
    lang: {},
  },
  {
    loinc: '2093-3',
    longCommonName: 'Cholesterol [Mass/volume] in Serum or Plasma',
    displayName: 'Total Cholesterol',
    lang: {},
  },
  {
    loinc: '718-7',
    longCommonName: 'Hemoglobin [Mass/volume] in Blood',
    displayName: 'Hemoglobin',
    lang: {},
  },
];

describe('LOINC_RE', () => {
  it('accepts well-formed codes', () => {
    for (const code of ['2093-3', '1-8', '1234567-0', '718-7']) {
      expect(LOINC_RE.test(code)).toBe(true);
    }
  });

  it('rejects lab-internal and malformed codes', () => {
    for (const code of ['900101', '12345678-9', '2093-', '-3', '2093-33', 'ABC-1', '2093 3', '']) {
      expect(LOINC_RE.test(code)).toBe(false);
    }
  });
});

describe('latinPart', () => {
  it('strips Greek words', () => {
    expect(latinPart('Γλυκόζη Glucose Serum')).toBe('Glucose Serum');
  });

  it('strips Cyrillic words', () => {
    expect(latinPart('Глюкоза Glucose')).toBe('Glucose');
  });

  it('keeps pure Latin names unchanged', () => {
    expect(latinPart('Total Cholesterol')).toBe('Total Cholesterol');
  });

  it('keeps numeric and punctuation tokens', () => {
    expect(latinPart('Vitamin B12 (Cobalamin)')).toBe('Vitamin B12 (Cobalamin)');
  });

  it('collapses whitespace', () => {
    expect(latinPart('  Γλυκόζη   Glucose   Serum  ')).toBe('Glucose Serum');
  });

  it('returns empty string when nothing is Latin', () => {
    expect(latinPart('Γλυκόζη')).toBe('');
  });
});

describe('tokenOverlap', () => {
  it('is 1 when all printed tokens appear in the official name', () => {
    expect(tokenOverlap('Glucose', 'Glucose [Mass/volume] in Serum or Plasma')).toBe(1);
  });

  it('is 0 for unrelated names', () => {
    expect(tokenOverlap('Ferritin', 'Glucose [Mass/volume] in Serum or Plasma')).toBe(0);
  });

  it('is case-insensitive', () => {
    expect(tokenOverlap('GLUCOSE serum', 'Glucose [Mass/volume] in Serum or Plasma')).toBe(1);
  });
});

describe('crossCheckLocal', () => {
  it('matches a known code with an agreeing printed name', () => {
    const [res] = crossCheckLocal([createResult()], catalog);
    expect(res?.status).toBe('match');
    expect(res?.loincName).toBe('Glucose');
  });

  it('matches despite a non-Latin prefix in the printed name', () => {
    const [res] = crossCheckLocal([createResult({ analysis: 'Γλυκόζη Glucose Serum' })], catalog);
    expect(res?.status).toBe('match');
  });

  it('flags mismatch when the printed name shares nothing with the catalog name', () => {
    const [res] = crossCheckLocal([createResult({ analysis: 'Ferritin' })], catalog);
    expect(res?.status).toBe('mismatch');
    expect(res?.loincName).toBe('Glucose');
  });

  it('flags unknown-code for a well-formed code missing from the catalog', () => {
    const [res] = crossCheckLocal([createResult({ loinc: '9999999-9' })], catalog);
    expect(res?.status).toBe('unknown-code');
    expect(res?.loincName).toBeUndefined();
  });

  it('flags malformed for a non-LOINC code', () => {
    const [res] = crossCheckLocal([createResult({ loinc: '900101' })], catalog);
    expect(res?.status).toBe('malformed');
  });

  it('suggests catalog entries for a codeless row, best match first', () => {
    const [res] = crossCheckLocal(
      [createResult({ loinc: '', analysis: 'Cholesterol', unit: 'mg/dL' })],
      catalog
    );
    expect(res?.status).toBe('no-code');
    expect(res?.suggestions?.[0]?.loinc).toBe('2093-3');
    expect(res?.suggestions?.length).toBeLessThanOrEqual(3);
  });

  it('returns no suggestions for a codeless row with an unrecognized name', () => {
    const [res] = crossCheckLocal([createResult({ loinc: '', analysis: 'Xyzzy' })], catalog);
    expect(res?.status).toBe('no-code');
    expect(res?.suggestions).toEqual([]);
  });

  it('accepts a Map catalog too', () => {
    const map = new Map(catalog.map((a) => [a.loinc, a]));
    const [res] = crossCheckLocal([createResult()], map);
    expect(res?.status).toBe('match');
  });
});
