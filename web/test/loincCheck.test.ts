import { describe, it, expect } from 'vitest';
import {
  LOINC_RE,
  latinPart,
  normalizeUnit,
  canonicalUnit,
  tokenOverlap,
  resolveLoinc,
  crossCheckLocal,
  unitAllowed,
} from '../src/data/loincCheck';
import { ALLOWED_UNITS, DEFAULT_UNITS } from '../src/data/analyteCatalog';
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
  it('keeps the Latin tokens (numbers and punctuation included) and drops the rest', () => {
    const cases: [string, string][] = [
      ['Γλυκόζη Glucose Serum', 'Glucose Serum'],
      ['Глюкоза Glucose', 'Glucose'],
      ['Total Cholesterol', 'Total Cholesterol'],
      ['Vitamin B12 (Cobalamin)', 'Vitamin B12 (Cobalamin)'],
      ['  Γλυκόζη   Glucose   Serum  ', 'Glucose Serum'], // whitespace collapsed
      ['Γλυκόζη', ''], // nothing Latin at all
    ];
    for (const [printed, latin] of cases) {
      expect([printed, latinPart(printed)]).toEqual([printed, latin]);
    }
  });
});

describe('normalizeUnit', () => {
  it('lowercases and folds the micro-sign, mcg and IU/U spelling variants', () => {
    expect(normalizeUnit('mIU/L')).toBe('mu/l');
    expect(normalizeUnit('μIU/mL')).toBe('uu/ml');
    expect(normalizeUnit('µg/dL')).toBe('ug/dl');
    expect(normalizeUnit('mcg/dL')).toBe('ug/dl');
    expect(normalizeUnit('x10^3/μL')).toBe('x10^3/ul');
    expect(normalizeUnit('µU/mL')).toBe(normalizeUnit('μIU/mL'));
    expect(normalizeUnit('mIU/L')).toBe(normalizeUnit('mU/L'));
    expect(normalizeUnit('mcg/dL')).toBe(normalizeUnit('μg/dL'));
  });

  it('strips spaces, trailing dots, an uncertainty mark, and reads undefined as empty', () => {
    expect(normalizeUnit(' mg / dL. ')).toBe('mg/dl');
    expect(normalizeUnit('fL?')).toBe(normalizeUnit('fl'));
    expect(normalizeUnit('x10^3/uL?')).toBe('x10^3/ul');
    expect(normalizeUnit(undefined)).toBe('');
  });
});

describe('canonicalUnit', () => {
  it('rewrites metric-prefix /mL units to the equivalent /L form', () => {
    expect(canonicalUnit('μIU/mL')).toBe('mu/l');
    expect(canonicalUnit('pg/mL')).toBe('ng/l');
    expect(canonicalUnit('ng/mL')).toBe('ug/l');
    expect(canonicalUnit('mg/mL')).toBe('g/l');
    expect(canonicalUnit('mIU/mL')).toBe('u/l');
    expect(canonicalUnit('nmol/mL')).toBe('umol/l');
  });

  it('makes μIU/mL, µU/mL and mIU/L all compare equal', () => {
    expect(canonicalUnit('μIU/mL')).toBe(canonicalUnit('mIU/L'));
    expect(canonicalUnit('µU/mL')).toBe(normalizeUnit('mIU/L'));
    expect(canonicalUnit('µU/mL')).toBe(normalizeUnit('mU/L'));
  });

  it('leaves /dL, /uL and prefixless numerators alone', () => {
    expect(canonicalUnit('ng/dL')).toBe('ng/dl');
    expect(canonicalUnit('x10^3/μL')).toBe('x10^3/ul');
    expect(canonicalUnit('IU/mL')).toBe('u/ml');
    expect(canonicalUnit('g/mL')).toBe('g/ml');
  });

  it('reads an uncertain curated unit as agreeing with the plain one', () => {
    expect(canonicalUnit('fL?')).toBe(canonicalUnit('fl'));
  });

  it('folds a printed Cyrillic, Ukrainian or superscript spelling onto its Latin key', () => {
    const same: [string, string][] = [
      ['ммоль/л', 'mmol/L'],
      ['мкмоль/л', 'umol/L'],
      ['МЕ/мл', 'IU/mL'],
      ['мкМЕ/мл', 'uIU/mL'],
      ['Ед/л', 'U/L'],
      ['г/дл', 'g/dL'],
      ['мм/ч', 'mm/h'],
      // Ukrainian МО is the same international-unit family as МЕ.
      ['МО/л', 'IU/L'],
      ['мМО/л', 'mIU/L'],
      // Superscripts, the multiplication sign and the micro sign.
      ['тыс/мкл', 'x10^3/uL'],
      ['x10³/µL', 'x10^3/uL'],
      ['x10⁶/µL', 'x10^6/uL'],
      ['×10⁹/л', 'x10^9/L'],
      ['10^9/L', 'x10^9/L'],
    ];
    for (const [printed, latin] of same) {
      expect([printed, canonicalUnit(printed)]).toEqual([printed, canonicalUnit(latin)]);
    }
    // The catalog's x-multiplier survives the fold.
    expect(canonicalUnit('×10⁹/л')).toBe('x10^9/l');
  });

  it('leaves an untranslatable Cyrillic unit exactly as normalizeUnit had it', () => {
    expect(canonicalUnit('усл.ед')).toBe(normalizeUnit('усл.ед'));
  });

  // unitAllowed canonicalises both the printed unit and the catalog's own, so a
  // catalog unit's key must be a fixed point: were it not, a lab printing a unit
  // exactly as the catalog spells its key would still fail to match.
  const catalogUnits = [
    ...new Set([...Object.values(DEFAULT_UNITS), ...Object.values(ALLOWED_UNITS).flat(), '']),
  ];

  it('canonicalises every catalog unit to a stable key', () => {
    for (const unit of catalogUnits) {
      const key = canonicalUnit(unit);
      expect([unit, canonicalUnit(key)]).toEqual([unit, key]);
    }
  });
});

describe('tokenOverlap', () => {
  it('is 1 when every printed token appears in the official name (case-insensitively), 0 when none does', () => {
    const official = 'Glucose [Mass/volume] in Serum or Plasma';
    expect(tokenOverlap('Glucose', official)).toBe(1);
    expect(tokenOverlap('GLUCOSE serum', official)).toBe(1);
    expect(tokenOverlap('Ferritin', official)).toBe(0);
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
    expect(res.candidates).toHaveLength(2);
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

describe('resolveLoinc on real lab-report names', () => {
  const labCatalog: Analysis[] = [
    {
      loinc: '3016-3',
      longCommonName: 'Thyrotropin [Units/volume] in Serum or Plasma',
      displayName: 'Thyroid-stimulating hormone (TSH)',
      lang: {},
    },
    {
      loinc: '3024-7',
      longCommonName: 'Thyroxine (T4) free [Mass/volume] in Serum or Plasma',
      displayName: 'Free Thyroxine (FT4)',
      lang: {},
    },
    {
      loinc: '718-7',
      longCommonName: 'Hemoglobin [Mass/volume] in Blood',
      displayName: 'Hemoglobin (HGB)',
      lang: {},
    },
    {
      loinc: '2143-6',
      longCommonName: 'Cortisol [Mass/volume] in Serum or Plasma',
      displayName: 'Cortisol',
      lang: {},
    },
    {
      loinc: '2243-4',
      longCommonName: 'Estradiol (E2) [Mass/volume] in Serum or Plasma',
      displayName: 'Estradiol (E2)',
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
      createResult({ loinc: '', analysis: 'TSH 3rd', unit: 'μIU/ml' }),
      labCatalog,
      labUnits
    );
    expect(res.candidates[0]?.loinc).toBe('3016-3');
    expect(res.confident).toBe(true);
  });

  it('resolves the British "Haemoglobin (Hb)" to Hemoglobin', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', analysis: 'Haemoglobin (Hb)', unit: 'g/dL' }),
      labCatalog,
      labUnits
    );
    expect(res.candidates[0]?.loinc).toBe('718-7');
    expect(res.confident).toBe(true);
  });

  it('resolves the misspelled "CORTIZOL" to Cortisol', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', analysis: 'CORTIZOL', unit: 'µg/dl' }),
      labCatalog,
      labUnits
    );
    expect(res.candidates[0]?.loinc).toBe('2143-6');
    expect(res.confident).toBe(true);
  });

  it('resolves "FT4 (Thyroxin free)" to Free Thyroxine', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', analysis: 'FT4 (Thyroxin free)', unit: 'ng/dL' }),
      labCatalog,
      labUnits
    );
    expect(res.candidates[0]?.loinc).toBe('3024-7');
    expect(res.confident).toBe(true);
  });

  it('resolves the British "Oestradiol" to Estradiol, pg/mL agreeing with curated pg/mL', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', analysis: 'Oestradiol', unit: 'pg/ml' }),
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
      createResult({ loinc: '', analysis: 'FT4 (Thyroxin free)', unit: 'ng/L' }),
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
        displayName: 'TNF-alpha',
        lang: {},
      },
      {
        loinc: '5964-2',
        longCommonName: 'Prothrombin time (PT) actual/normal in Platelet poor plasma by Coagulation assay',
        displayName: 'Prothrombin Time (PT)',
        lang: {},
      },
      {
        loinc: '3289-6',
        longCommonName: 'Coagulation factor II activity actual/normal in Platelet poor plasma',
        displayName: 'Factor II Activity',
        lang: {},
      },
      {
        loinc: '41770-1',
        longCommonName: 'Free androgen index in Serum or Plasma',
        displayName: 'Free Androgen Index (FAI)',
        lang: {},
      },
      {
        loinc: '47690-5',
        longCommonName: 'Insulin resistance index in Serum or Plasma',
        displayName: 'HOMA-IR Index',
        lang: {},
      },
    ];
    const res = resolveLoinc(
      createResult({ loinc: '', analysis: 'Risk Factor Index', unit: '' }),
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
        displayName: 'RDW-SD',
        lang: {},
      },
    ];
    const res = resolveLoinc(
      createResult({ loinc: '', analysis: 'RDW-SD', unit: 'fl' }),
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

  // Real case: the token "insulin" from "Insulin-like growth factor"
  // corroborated a wrong printed IGF-1 code on an Insulin row.
  it('demotes a printed IGF-1 code on an "Insulin total" µU/mL row', () => {
    const igfCatalog: Analysis[] = [
      {
        loinc: '2484-4',
        longCommonName: 'Insulin-like growth factor 1 [Mass/volume] in Serum or Plasma',
        displayName: 'IGF-1 (Somatomedin C)',
        lang: {},
      },
      {
        loinc: '20448-7',
        longCommonName: 'Insulin [Units/volume] in Serum or Plasma',
        displayName: 'Insulin',
        lang: {},
      },
    ];
    const [res] = crossCheckLocal(
      [createResult({ loinc: '2484-4', analysis: 'Insulin total', unit: 'µU/mL' })],
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
        displayName: 'Hemoglobin (HGB)',
        lang: {},
      },
    ];
    const [res] = crossCheckLocal(
      [createResult({ loinc: '718-7', analysis: 'Haemoglobin (Hb)', unit: 'g/dL' })],
      hgbCatalog,
      { '718-7': 'g/dL' }
    );
    expect(res?.status).toBe('match');
    expect(res?.loincName).toBe('Hemoglobin (HGB)');
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

describe('unitAllowed', () => {
  it('returns undefined for a code with no known units', () => {
    expect(unitAllowed('9999999-9', 'mg/dL')).toBeUndefined();
  });

  it('accepts the curated primary unit', () => {
    expect(unitAllowed('1848-1', 'ng/dL')).toBe(true);
  });

  it('accepts an ALLOWED_UNITS extra across spellings', () => {
    expect(unitAllowed('1848-1', 'pg/ml')).toBe(true);
  });

  it('rejects a unit outside the set', () => {
    expect(unitAllowed('1848-1', 'nmol/L')).toBe(false);
  });

  it('accepts a Cyrillic spelling of an allowed unit', () => {
    expect(unitAllowed('2951-2', 'ммоль/л')).toBe(true);
    expect(unitAllowed('14682-9', 'мкмоль/л')).toBe(true);
    expect(unitAllowed('20448-7', 'мкМЕ/мл')).toBe(true);
    expect(unitAllowed('777-3', 'тыс/мкл')).toBe(true);
  });

  it('still rejects a Cyrillic unit that is genuinely wrong for the code', () => {
    expect(unitAllowed('2951-2', 'мг/дл')).toBe(false);
    expect(unitAllowed('14682-9', 'ммоль/л')).toBe(false);
  });

  it('accepts a count unit printed with superscripts and the micro sign', () => {
    expect(unitAllowed('6690-2', 'x10³/µL')).toBe(true);
    expect(unitAllowed('777-3', 'x10³/µL')).toBe(true);
    expect(unitAllowed('789-8', 'x10⁶/µL')).toBe(true);
  });

  it('still rejects a genuinely wrong unit for a count code', () => {
    expect(unitAllowed('6690-2', 'x10⁶/µL')).toBe(false);
    expect(unitAllowed('789-8', 'mg/dL')).toBe(false);
  });
});

describe('per-code allowed unit sets and alias collapsing', () => {
  // LOINC 1848-1's own example units list both ng/dL and pg/mL.
  const dhtCatalog: Analysis[] = [
    {
      loinc: '1848-1',
      longCommonName: 'Androstanolone (Dihydrotestosterone) [Mass/volume] in Serum or Plasma',
      displayName: 'Dihydrotestosterone (DHT)',
      lang: {},
    },
  ];

  it('treats a pg/mL DHT row as unit agreement for 1848-1', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', analysis: 'Dihydrotestosterone (DHT)', unit: 'pg/mL' }),
      dhtCatalog
    );
    expect(res.candidates[0]?.loinc).toBe('1848-1');
    expect(res.confident).toBe(true);
  });

  it('treats a ng/dL DHT row as unit agreement for 1848-1', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', analysis: 'Dihydrotestosterone (DHT)', unit: 'ng/dL' }),
      dhtCatalog
    );
    expect(res.candidates[0]?.loinc).toBe('1848-1');
    expect(res.confident).toBe(true);
  });

  const glucoseCatalog: Analysis[] = [
    {
      loinc: '2339-0',
      longCommonName: 'Glucose [Mass/volume] in Blood',
      displayName: 'Glucose Serum',
      lang: {},
    },
    {
      loinc: '2345-7',
      longCommonName: 'Glucose [Mass/volume] in Serum or Plasma',
      displayName: 'Glucose (Serum/Plasma)',
      lang: {},
    },
  ];

  it('collapses a primary and its same-scale alias into one confident primary candidate', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', analysis: 'Glucose, Fasting', unit: 'mg/dL' }),
      glucoseCatalog
    );
    expect(res.candidates.map((c) => c.loinc)).toEqual(['2339-0']);
    expect(res.confident).toBe(true);
  });

  it('counts a row printing the alias code of the derived analyte as a match', () => {
    const [res] = crossCheckLocal(
      [createResult({ loinc: '2345-7', analysis: 'Glucose, Fasting', unit: 'mg/dL' })],
      glucoseCatalog
    );
    expect(res?.status).toBe('match');
  });

  // The row's unit picks the variant kept from an alias group: nmol/L is the
  // Moles/volume alias 13967-5, not the Mass/volume primary 2942-1.
  it('keeps the nmol/L alias code for an SHBG nmol/L row', () => {
    const shbgCatalog: Analysis[] = [
      {
        loinc: '2942-1',
        longCommonName: 'Sex hormone binding globulin [Mass/volume] in Serum or Plasma',
        displayName: 'SHBG',
        lang: {},
      },
      {
        loinc: '13967-5',
        longCommonName: 'Sex hormone binding globulin [Moles/volume] in Serum or Plasma',
        displayName: 'SHBG',
        lang: {},
      },
    ];
    const res = resolveLoinc(createResult({ loinc: '', analysis: 'SHBG', unit: 'nmol/L' }), shbgCatalog);
    expect(res.candidates.map((c) => c.loinc)).toEqual(['13967-5']);
    expect(res.confident).toBe(true);
  });

  // SUPPLEMENTARY_UNITS gives IGF-1 a unit, so "Insulin-like growth factor"'s
  // shared "insulin" token can't survive a µIU/mL row unpenalized.
  it('resolves "Insulin, Fasting" µIU/mL to Insulin alone, IGF-1 penalized out', () => {
    const insulinCatalog: Analysis[] = [
      {
        loinc: '20448-7',
        longCommonName: 'Insulin [Units/volume] in Serum or Plasma',
        displayName: 'Insulin',
        lang: {},
      },
      {
        loinc: '2484-4',
        longCommonName: 'Insulin-like growth factor 1 [Mass/volume] in Serum or Plasma',
        displayName: 'IGF-1 (Somatomedin C)',
        lang: {},
      },
    ];
    const res = resolveLoinc(
      createResult({ loinc: '', analysis: 'Insulin, Fasting', unit: 'µIU/mL' }),
      insulinCatalog
    );
    expect(res.candidates.map((c) => c.loinc)).toEqual(['20448-7']);
    expect(res.confident).toBe(true);
  });
});
