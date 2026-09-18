import { describe, it, expect } from 'vitest';
import { resolveLoinc, crossCheckLocal } from '../src/data/loincCheck';
import type { Analysis, Result } from '../src/types';
import { makeResult } from './helpers/fixtures';

const createResult = (overrides?: Partial<Result>): Result =>
  makeResult({ loinc: '2345-7', rawName: 'Glucose', value: 90, rawValue: '90', unit: 'mg/dL', refMin: 70, refMax: 100, ...overrides });

const catalog: Analysis[] = [
  {
    loinc: '2345-7',
    longCommonName: 'Glucose [Mass/volume] in Serum or Plasma',
    friendlyName: 'Glucose',
    lang: { 'el-GR': 'Γλυκόζη', 'ru-RU': 'Глюкоза' },
  },
  {
    loinc: '2093-3',
    longCommonName: 'Cholesterol [Mass/volume] in Serum or Plasma',
    friendlyName: 'Total Cholesterol',
    lang: {},
  },
  {
    loinc: '718-7',
    longCommonName: 'Hemoglobin [Mass/volume] in Blood',
    friendlyName: 'Hemoglobin',
    lang: {},
  },
];

describe('resolveLoinc', () => {
  // Two unit variants of one analyte, same name — only the unit tells them apart.
  const prolactinCatalog: Analysis[] = [
    {
      loinc: '15081-3',
      longCommonName: 'Prolactin [Units/volume] in Serum or Plasma',
      friendlyName: 'Prolactin',
      lang: {},
    },
    {
      loinc: '2842-3',
      longCommonName: 'Prolactin [Mass/volume] in Serum or Plasma',
      friendlyName: 'Prolactin',
      lang: {},
    },
    {
      loinc: '2345-7',
      longCommonName: 'Glucose [Mass/volume] in Serum or Plasma',
      friendlyName: 'Glucose',
      lang: {},
    },
  ];
  const prolactinUnits = { '15081-3': 'mIU/L', '2842-3': 'ng/mL' };

  it('hard-selects the mIU/L variant for a mIU/L row', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'Prolactin', unit: 'mIU/L' }),
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
      createResult({ loinc: '', rawName: 'Prolactin', unit: 'ng/mL' }),
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
      { loinc: '5763-8', longCommonName: 'Zinc [Mass/volume] in Serum or Plasma', friendlyName: 'Zinc (Zn)', lang: {} },
    ];
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'Zinc (Zn)', unit: 'μg/dL' }),
      zincCatalog,
      { '5763-8': 'mcg/dL' }
    );
    expect(res.candidates[0]?.loinc).toBe('5763-8');
    expect(res.confident).toBe(true);
  });

  it('is not confident between variants when the row has no unit', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'Prolactin', unit: '' }),
      prolactinCatalog,
      prolactinUnits
    );
    expect(res.candidates).toHaveLength(2);
    expect(res.confident).toBe(false);
  });

  it('matches unit despite μ/case/spacing differences', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'Prolactin', unit: 'μIU/mL' }),
      prolactinCatalog,
      { '15081-3': 'uIU/mL', '2842-3': 'ng/mL' }
    );
    expect(res.candidates[0]?.loinc).toBe('15081-3');
    expect(res.confident).toBe(true);
  });

  it('resolves a purely Greek printed name via lang translations', () => {
    const res = resolveLoinc(createResult({ loinc: '', rawName: 'Γλυκόζη' }), catalog, {});
    expect(res.candidates[0]?.loinc).toBe('2345-7');
    expect(res.confident).toBe(true);
  });

  it('resolves a purely Russian printed name via lang translations', () => {
    const res = resolveLoinc(createResult({ loinc: '', rawName: 'Глюкоза' }), catalog, {});
    expect(res.candidates[0]?.loinc).toBe('2345-7');
  });

  it('returns nothing for an unrecognized name', () => {
    const res = resolveLoinc(createResult({ loinc: '', rawName: 'Xyzzy' }), catalog, {});
    expect(res.candidates).toEqual([]);
    expect(res.confident).toBe(false);
  });
});

describe('resolveLoinc on real lab-report names', () => {
  const labCatalog: Analysis[] = [
    {
      loinc: '3016-3',
      longCommonName: 'Thyrotropin [Units/volume] in Serum or Plasma',
      friendlyName: 'Thyroid-stimulating hormone (TSH)',
      lang: {},
    },
    {
      loinc: '3024-7',
      longCommonName: 'Thyroxine (T4) free [Mass/volume] in Serum or Plasma',
      friendlyName: 'Free Thyroxine (FT4)',
      lang: {},
    },
    {
      loinc: '718-7',
      longCommonName: 'Hemoglobin [Mass/volume] in Blood',
      friendlyName: 'Hemoglobin (HGB)',
      lang: {},
    },
    {
      loinc: '2143-6',
      longCommonName: 'Cortisol [Mass/volume] in Serum or Plasma',
      friendlyName: 'Cortisol',
      lang: {},
    },
    {
      loinc: '2243-4',
      longCommonName: 'Estradiol (E2) [Mass/volume] in Serum or Plasma',
      friendlyName: 'Estradiol (E2)',
      lang: {},
    },
  ];
  const labUnits = {
    '3016-3': 'mIU/L',
    '3024-7': 'ng/dL',
    '718-7': 'g/dL',
    '2143-6': 'µg/dL',
    '2243-4': 'pg/mL',
  };

  it('resolves "TSH 3rd" μIU/ml confidently despite the noise token and /mL spelling', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'TSH 3rd', unit: 'μIU/ml' }),
      labCatalog,
      labUnits
    );
    expect(res.candidates[0]?.loinc).toBe('3016-3');
    expect(res.confident).toBe(true);
  });

  it('resolves the British "Haemoglobin (Hb)" to Hemoglobin', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'Haemoglobin (Hb)', unit: 'g/dL' }),
      labCatalog,
      labUnits
    );
    expect(res.candidates[0]?.loinc).toBe('718-7');
    expect(res.confident).toBe(true);
  });

  it('resolves the misspelled "CORTIZOL" to Cortisol', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'CORTIZOL', unit: 'µg/dl' }),
      labCatalog,
      labUnits
    );
    expect(res.candidates[0]?.loinc).toBe('2143-6');
    expect(res.confident).toBe(true);
  });

  it('resolves "FT4 (Thyroxin free)" to Free Thyroxine', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'FT4 (Thyroxin free)', unit: 'ng/dL' }),
      labCatalog,
      labUnits
    );
    expect(res.candidates[0]?.loinc).toBe('3024-7');
    expect(res.confident).toBe(true);
  });

  it('resolves the British "Oestradiol" to Estradiol, pg/mL agreeing with curated pg/mL', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'Oestradiol', unit: 'pg/ml' }),
      labCatalog,
      labUnits
    );
    expect(res.candidates[0]?.loinc).toBe('2243-4');
    expect(res.confident).toBe(true);
  });

  // A ×100 unit conflict (ng/L vs ng/dL) must block confidence but NOT hide
  // the candidate — the strong name hit still surfaces as a suggestion.
  it('keeps FT4 as a suggestion when ng/L contradicts curated ng/dL, without confidence', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'FT4 (Thyroxin free)', unit: 'ng/L' }),
      labCatalog,
      labUnits
    );
    expect(res.candidates[0]?.loinc).toBe('3024-7');
    expect(res.confident).toBe(false);
  });

  // IDF noise guard: common tokens ("factor", "index") plus an unknown one
  // must not surface unrelated analytes, fuzzy matching included.
  it('suggests nothing for "Risk Factor Index"', () => {
    const noiseCatalog: Analysis[] = [
      {
        loinc: '3236-2',
        longCommonName: 'Tumor necrosis factor.alpha [Mass/volume] in Serum or Plasma',
        friendlyName: 'TNF-alpha',
        lang: {},
      },
      {
        loinc: '5964-2',
        longCommonName: 'Prothrombin time (PT) actual/normal in Platelet poor plasma by Coagulation assay',
        friendlyName: 'Prothrombin Time (PT)',
        lang: {},
      },
      {
        loinc: '3289-6',
        longCommonName: 'Coagulation factor II activity actual/normal in Platelet poor plasma',
        friendlyName: 'Factor II Activity',
        lang: {},
      },
      {
        loinc: '41770-1',
        longCommonName: 'Free androgen index in Serum or Plasma',
        friendlyName: 'Free Androgen Index (FAI)',
        lang: {},
      },
      {
        loinc: '47690-5',
        longCommonName: 'Insulin resistance index in Serum or Plasma',
        friendlyName: 'HOMA-IR Index',
        lang: {},
      },
    ];
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'Risk Factor Index', unit: '' }),
      noiseCatalog,
      {}
    );
    expect(res.candidates).toEqual([]);
    expect(res.confident).toBe(false);
  });

  it('treats a printed unit as agreeing with an uncertain curated unit ("fL?")', () => {
    const rdwCatalog: Analysis[] = [
      {
        loinc: '21000-5',
        longCommonName: 'Erythrocyte distribution width [Entitic volume] by Automated count',
        friendlyName: 'RDW-SD',
        lang: {},
      },
    ];
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'RDW-SD', unit: 'fl' }),
      rdwCatalog,
      { '21000-5': 'fL?' }
    );
    expect(res.candidates[0]?.loinc).toBe('21000-5');
    expect(res.confident).toBe(true);
  });
});

describe('crossCheckLocal', () => {
  it('matches a known code with an agreeing printed name', () => {
    const [res] = crossCheckLocal([createResult()], catalog);
    expect(res?.status).toBe('match');
    expect(res?.resolvedName).toBe('Glucose');
  });

  it('matches despite a non-Latin prefix in the printed name', () => {
    const [res] = crossCheckLocal([createResult({ rawName: 'Γλυκόζη Glucose Serum' })], catalog);
    expect(res?.status).toBe('match');
  });

  it('flags mismatch when the printed name shares nothing with the catalog name', () => {
    const [res] = crossCheckLocal([createResult({ rawName: 'Ferritin' })], catalog);
    expect(res?.status).toBe('mismatch');
    expect(res?.resolvedName).toBe('Glucose');
    expect(res?.derived).toBeUndefined();
  });

  it('demotes a printed code that the name+unit derivation confidently contradicts', () => {
    const thyroidCatalog: Analysis[] = [
      {
        loinc: '3016-3',
        longCommonName: 'Thyrotropin [Units/volume] in Serum or Plasma',
        friendlyName: 'Thyrotropin',
        lang: {},
      },
      {
        loinc: '3051-0',
        longCommonName: 'Triiodothyronine (T3) Free [Mass/volume] in Serum or Plasma',
        friendlyName: 'Free T3',
        lang: {},
      },
    ];
    const [res] = crossCheckLocal(
      [createResult({ loinc: '3016-3', rawName: 'Free T3', unit: 'pg/mL' })],
      thyroidCatalog,
      { '3016-3': 'mIU/L', '3051-0': 'pg/mL' }
    );
    expect(res?.status).toBe('mismatch');
    expect(res?.confident).toBe(true);
    expect(res?.derived).toEqual({ loinc: '3051-0', name: 'Free T3' });
    expect(res?.resolvedName).toBe('Thyrotropin');
    expect(res?.suggestions?.[0]?.loinc).toBe('3051-0');
  });

  // Real case: the token "insulin" from "Insulin-like growth factor"
  // corroborated a wrong printed IGF-1 code on an Insulin row.
  it('demotes a printed IGF-1 code on an "Insulin total" µU/mL row', () => {
    const igfCatalog: Analysis[] = [
      {
        loinc: '2484-4',
        longCommonName: 'Insulin-like growth factor 1 [Mass/volume] in Serum or Plasma',
        friendlyName: 'IGF-1 (Somatomedin C)',
        lang: {},
      },
      {
        loinc: '20448-7',
        longCommonName: 'Insulin [Units/volume] in Serum or Plasma',
        friendlyName: 'Insulin',
        lang: {},
      },
    ];
    const [res] = crossCheckLocal(
      [createResult({ loinc: '2484-4', rawName: 'Insulin total', unit: 'µU/mL' })],
      igfCatalog,
      { '2484-4': 'ng/mL', '20448-7': 'µIU/mL' }
    );
    expect(res?.status).toBe('mismatch');
    expect(res?.confident).toBe(true);
    expect(res?.derived?.loinc).toBe('20448-7');
  });

  // British spelling is an official LOINC language variant — a correct code
  // must not be flagged just because the row prints "Haemoglobin".
  it('matches a correct code against a British-spelled printed name', () => {
    const hgbCatalog: Analysis[] = [
      {
        loinc: '718-7',
        longCommonName: 'Hemoglobin [Mass/volume] in Blood',
        friendlyName: 'Hemoglobin (HGB)',
        lang: {},
      },
    ];
    const [res] = crossCheckLocal(
      [createResult({ loinc: '718-7', rawName: 'Haemoglobin (Hb)', unit: 'g/dL' })],
      hgbCatalog,
      { '718-7': 'g/dL' }
    );
    expect(res?.status).toBe('match');
    expect(res?.resolvedName).toBe('Hemoglobin (HGB)');
  });

  it('flags mismatch with derivation even when the printed code is not in the catalog', () => {
    const [res] = crossCheckLocal([createResult({ loinc: '9999999-9' })], catalog);
    expect(res?.status).toBe('mismatch');
    expect(res?.derived?.loinc).toBe('2345-7');
  });

  it('flags unknown-code when a code missing from the catalog cannot be derived', () => {
    const [res] = crossCheckLocal([createResult({ loinc: '9999999-9', rawName: 'Xyzzy' })], catalog);
    expect(res?.status).toBe('unknown-code');
    expect(res?.resolvedName).toBeUndefined();
  });

  it('flags malformed for a non-LOINC code', () => {
    const [res] = crossCheckLocal([createResult({ loinc: '900101' })], catalog);
    expect(res?.status).toBe('malformed');
  });

  it('suggests catalog entries for a codeless row, best match first', () => {
    const [res] = crossCheckLocal(
      [createResult({ loinc: '', rawName: 'Cholesterol', unit: 'mg/dL' })],
      catalog
    );
    expect(res?.status).toBe('no-code');
    expect(res?.suggestions?.[0]?.loinc).toBe('2093-3');
    expect(res?.suggestions?.length).toBeLessThanOrEqual(3);
  });

  it('returns no suggestions for a codeless row with an unrecognized name', () => {
    const [res] = crossCheckLocal([createResult({ loinc: '', rawName: 'Xyzzy' })], catalog);
    expect(res?.status).toBe('no-code');
    expect(res?.suggestions).toEqual([]);
  });

  it('accepts a Map catalog too', () => {
    const map = new Map(catalog.map((a) => [a.loinc, a]));
    const [res] = crossCheckLocal([createResult()], map);
    expect(res?.status).toBe('match');
  });
});
