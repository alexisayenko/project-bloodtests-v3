import { describe, it, expect } from 'vitest';
import {
  LOINC_RE,
  latinPart,
  normalizeUnit,
  tokenOverlap,
  resolveLoinc,
  crossCheckLocal,
  selectByUnit,
} from '../src/data/loincCheck';
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
    lang: { 'el-GR': 'Γλυκόζη', 'ru-RU': 'Глюкоза' },
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

describe('normalizeUnit', () => {
  it('lowercases', () => {
    expect(normalizeUnit('mIU/L')).toBe('miu/l');
  });

  it('maps mu variants to u', () => {
    expect(normalizeUnit('μIU/mL')).toBe('uiu/ml');
    expect(normalizeUnit('µg/dL')).toBe('ug/dl');
  });

  it('treats mcg and µg as the same unit', () => {
    expect(normalizeUnit('mcg/dL')).toBe('ug/dl');
    expect(normalizeUnit('mcg/dL')).toBe(normalizeUnit('μg/dL'));
  });

  it('handles exponent-style counts', () => {
    expect(normalizeUnit('x10^3/μL')).toBe('x10^3/ul');
  });

  it('strips spaces and trailing dots', () => {
    expect(normalizeUnit(' mg / dL. ')).toBe('mg/dl');
  });

  it('treats undefined as empty', () => {
    expect(normalizeUnit(undefined)).toBe('');
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

describe('resolveLoinc', () => {
  // Two unit variants of one analyte, same name — only the unit tells them apart.
  const prolactinCatalog: Analysis[] = [
    {
      loinc: '15081-3',
      longCommonName: 'Prolactin [Units/volume] in Serum or Plasma',
      displayName: 'Prolactin',
      lang: {},
    },
    {
      loinc: '2842-3',
      longCommonName: 'Prolactin [Mass/volume] in Serum or Plasma',
      displayName: 'Prolactin',
      lang: {},
    },
    {
      loinc: '2345-7',
      longCommonName: 'Glucose [Mass/volume] in Serum or Plasma',
      displayName: 'Glucose',
      lang: {},
    },
  ];
  const prolactinUnits = { '15081-3': 'mIU/L', '2842-3': 'ng/mL' };

  it('hard-selects the mIU/L variant for a mIU/L row', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', analysis: 'Prolactin', unit: 'mIU/L' }),
      prolactinCatalog,
      prolactinUnits
    );
    expect(res.candidates[0]?.loinc).toBe('15081-3');
    expect(res.confident).toBe(true);
    // The contradicting variant is penalized out entirely.
    expect(res.candidates.map((c) => c.loinc)).not.toContain('2842-3');
  });

  it('hard-selects the ng/mL variant for a ng/mL row', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', analysis: 'Prolactin', unit: 'ng/mL' }),
      prolactinCatalog,
      prolactinUnits
    );
    expect(res.candidates[0]?.loinc).toBe('2842-3');
    expect(res.confident).toBe(true);
  });

  // Regression: curated tables spell micrograms "mcg", labs print "μg" —
  // that must read as agreement, not a contradiction (real case: Zinc and
  // DHEA-S rows got zero suggestions).
  it('treats a curated mcg unit as agreeing with a printed µg unit', () => {
    const zincCatalog: Analysis[] = [
      { loinc: '5763-8', longCommonName: 'Zinc [Mass/volume] in Serum or Plasma', displayName: 'Zinc (Zn)', lang: {} },
    ];
    const res = resolveLoinc(
      createResult({ loinc: '', analysis: 'Zinc (Zn)', unit: 'μg/dL' }),
      zincCatalog,
      { '5763-8': 'mcg/dL' }
    );
    expect(res.candidates[0]?.loinc).toBe('5763-8');
    expect(res.confident).toBe(true);
  });

  it('is not confident between variants when the row has no unit', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', analysis: 'Prolactin', unit: '' }),
      prolactinCatalog,
      prolactinUnits
    );
    expect(res.candidates.length).toBe(2);
    expect(res.confident).toBe(false);
  });

  it('matches unit despite μ/case/spacing differences', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', analysis: 'Prolactin', unit: 'μIU/mL' }),
      prolactinCatalog,
      { '15081-3': 'uIU/mL', '2842-3': 'ng/mL' }
    );
    expect(res.candidates[0]?.loinc).toBe('15081-3');
    expect(res.confident).toBe(true);
  });

  it('resolves a purely Greek printed name via lang translations', () => {
    const res = resolveLoinc(createResult({ loinc: '', analysis: 'Γλυκόζη' }), catalog, {});
    expect(res.candidates[0]?.loinc).toBe('2345-7');
    expect(res.confident).toBe(true);
  });

  it('resolves a purely Russian printed name via lang translations', () => {
    const res = resolveLoinc(createResult({ loinc: '', analysis: 'Глюкоза' }), catalog, {});
    expect(res.candidates[0]?.loinc).toBe('2345-7');
  });

  it('returns nothing for an unrecognized name', () => {
    const res = resolveLoinc(createResult({ loinc: '', analysis: 'Xyzzy' }), catalog, {});
    expect(res.candidates).toEqual([]);
    expect(res.confident).toBe(false);
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
    expect(res?.derived).toBeUndefined();
  });

  it('demotes a printed code that the name+unit derivation confidently contradicts', () => {
    const thyroidCatalog: Analysis[] = [
      {
        loinc: '3016-3',
        longCommonName: 'Thyrotropin [Units/volume] in Serum or Plasma',
        displayName: 'Thyrotropin',
        lang: {},
      },
      {
        loinc: '3051-0',
        longCommonName: 'Triiodothyronine (T3) Free [Mass/volume] in Serum or Plasma',
        displayName: 'Free T3',
        lang: {},
      },
    ];
    const [res] = crossCheckLocal(
      [createResult({ loinc: '3016-3', analysis: 'Free T3', unit: 'pg/mL' })],
      thyroidCatalog,
      { '3016-3': 'mIU/L', '3051-0': 'pg/mL' }
    );
    expect(res?.status).toBe('mismatch');
    expect(res?.confident).toBe(true);
    expect(res?.derived).toEqual({ loinc: '3051-0', name: 'Free T3' });
    expect(res?.loincName).toBe('Thyrotropin');
    expect(res?.suggestions?.[0]?.loinc).toBe('3051-0');
  });

  it('flags mismatch with derivation even when the printed code is not in the catalog', () => {
    const [res] = crossCheckLocal([createResult({ loinc: '9999999-9' })], catalog);
    expect(res?.status).toBe('mismatch');
    expect(res?.derived?.loinc).toBe('2345-7');
  });

  it('flags unknown-code when a code missing from the catalog cannot be derived', () => {
    const [res] = crossCheckLocal([createResult({ loinc: '9999999-9', analysis: 'Xyzzy' })], catalog);
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

describe('selectByUnit', () => {
  const entries = [
    { loinc: '15081-3', name: 'Prolactin [Units/vol]', unit: 'mIU/L' },
    { loinc: '2842-3', name: 'Prolactin [Mass/vol]', unit: 'ng/mL;ug/L' },
    { loinc: '20568-2', name: 'Prolactin panel', unit: undefined },
  ];

  it('puts unit-agreeing entries first and drops contradicting ones', () => {
    expect(selectByUnit(entries, 'ng/mL').map((e) => e.loinc)).toEqual(['2842-3', '20568-2']);
  });

  it('matches any unit in a semicolon-separated list', () => {
    expect(selectByUnit(entries, 'μg/L')[0]?.loinc).toBe('2842-3');
  });

  it('returns entries unchanged when the row has no unit', () => {
    expect(selectByUnit(entries, undefined)).toEqual(entries);
  });

  it('returns entries unchanged when nothing agrees', () => {
    expect(selectByUnit(entries, 'mmol/L')).toEqual(entries);
  });
});
