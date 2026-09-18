import { describe, it, expect } from 'vitest';
import { resolveLoinc, crossCheckLocal } from '../src/data/loincCheck';
import { ANALYTES } from '../src/data/analyteCatalog';
import type { Analysis, Result } from '../src/types';
import { makeResult } from './helpers/fixtures';

const createResult = (overrides?: Partial<Result>): Result =>
  makeResult({ loinc: '2345-7', rawName: 'Glucose', value: 90, rawValue: '90', unit: 'mg/dL', refMin: 70, refMax: 100, ...overrides });

describe('cross-check against the real catalog', () => {
  const codes = (rawName: string, unit: string) =>
    resolveLoinc(createResult({ loinc: '', rawName, unit }), ANALYTES).candidates.map((c) => c.loinc);

  it('rules out HbA1c, whose % is another quantity, for a hemoglobin row in g/L', () => {
    expect(codes('Гемоглобин', 'г/л')).toEqual(['718-7']);
    const latin = codes('Hemoglobin', 'g/L');
    expect(latin[0]).toBe('718-7');
    expect(latin).not.toContain('4548-4');
    expect(latin).not.toContain('59261-8');
  });

  it('reads "общий" as total: "Холестерин общий" in mmol/L is total cholesterol alone', () => {
    expect(codes('Холестерин общий', 'ммоль/л')).toEqual(['14647-2']);
    expect(codes('Общий холестерин', 'mmol/L')).toEqual(['14647-2']);
  });

  it('still resolves the HDL and LDL qualifiers to their own fractions', () => {
    expect(codes('Холестерин ЛПВП', 'ммоль/л')[0]).toBe('14646-4');
    expect(codes('Холестерин ЛПНП', 'ммоль/л')[0]).toBe('22748-8');
    expect(codes('ЛПНП', 'ммоль/л')[0]).toBe('22748-8');
  });

  it('fills an uncoded "Холестерин общий" automatically, and resolves a bare "Холестерин" as before', () => {
    const [total, bare] = crossCheckLocal(
      [
        createResult({ loinc: '', rawName: 'Холестерин общий', unit: 'ммоль/л' }),
        createResult({ loinc: '', rawName: 'Холестерин', unit: 'ммоль/л' }),
      ],
      ANALYTES
    );
    expect(total).toMatchObject({ status: 'no-code', confident: true });
    expect(total?.suggestions?.map((s) => s.loinc)).toEqual(['14647-2']);
    expect(bare).toMatchObject({ status: 'no-code', confident: true });
    expect(bare?.suggestions?.map((s) => s.loinc)).toEqual(['14647-2', '14646-4', '22748-8']);
  });

  it('reads a total qualifier beside calcium and testosterone as the total, not the fraction', () => {
    expect(codes('Кальций общий', 'ммоль/л')).toEqual(['2000-8']);
    expect(codes('Тестостерон общий', 'нмоль/л')).toEqual(['14913-8']);
    expect(codes('Кальций ионизированный', 'ммоль/л')[0]).toBe('1994-3');
  });

  it('reads "Folic Acid" as folate, never as uric acid, while uric acid stays urate', () => {
    for (const printed of ['Folic Acid', 'Folate']) {
      const res = resolveLoinc(createResult({ loinc: '', rawName: printed, unit: 'ng/mL' }), ANALYTES);
      expect(res.candidates.map((c) => c.loinc)).toEqual(['2284-8']);
      expect(res.confident).toBe(true);
    }
    expect(codes('Folic Acid', '')).toEqual(['2284-8']);
    expect(codes('Uric Acid', 'mg/dL')).toEqual(['3084-1']);
    expect(codes('Uric Acid', 'umol/L')).toEqual(['14933-6']);
    expect(codes('Мочевая кислота', 'мкмоль/л')).toEqual(['14933-6']);
  });

  it('reads a Cyrillic folic acid as folate, while uric acid stays urate and other acids gain nothing', () => {
    for (const printed of ['Фолиевая кислота', 'Фолієва кислота', 'Витамин B9 (фолиевая кислота)']) {
      const res = resolveLoinc(createResult({ loinc: '', rawName: printed, unit: 'нг/мл' }), ANALYTES);
      expect(res.candidates.map((c) => c.loinc)).toEqual(['2284-8']);
      expect(res.confident).toBe(true);
    }
    expect(codes('Мочевая кислота', 'мг/дл')).toEqual(['3084-1']);
    expect(codes('Сечова кислота', 'мкмоль/л')).toEqual(['14933-6']);
    for (const printed of ['Аскорбиновая кислота', 'Молочная кислота', 'Вальпроевая кислота', 'Вальпроєва кислота']) {
      expect(codes(printed, '')).toEqual([]);
    }
  });

  it('lets no generic word make a suggestion on its own, while one still settles between siblings', () => {
    for (const printed of ['Acid', 'Total', 'Serum', 'Blood Count', 'Ascorbic Acid', 'Total IgE']) {
      expect(codes(printed, '')).toEqual([]);
    }
    expect(codes('Glucose (Whole Blood)', 'mmol/L')).toEqual(['15074-8']);
  });

  it('agrees, offering nothing, when the printed code is already the best derivation', () => {
    const [cholesterol, hemoglobin] = crossCheckLocal(
      [
        createResult({ loinc: '14647-2', rawName: 'Холестерин общий', unit: 'ммоль/л' }),
        createResult({ loinc: '718-7', rawName: 'Гемоглобин', unit: 'г/л' }),
      ],
      ANALYTES
    );
    expect(cholesterol).toMatchObject({ status: 'match', resolvedName: 'Total Cholesterol' });
    expect(cholesterol?.suggestions).toBeUndefined();
    expect(hemoglobin).toMatchObject({ status: 'match', resolvedName: 'Hemoglobin' });
    expect(hemoglobin?.suggestions).toBeUndefined();
  });

  // Units that rule every candidate out, so the name comparison alone decides.
  it('matches a code by its translated or badge name, and still flags a name that is neither', () => {
    const [translated, badge, unrelated] = crossCheckLocal(
      [
        createResult({ loinc: '718-7', rawName: 'ГЕМОГЛОБИН:', unit: 'ммоль/л' }),
        createResult({ loinc: '718-7', rawName: 'Hb', unit: '' }),
        createResult({ loinc: '718-7', rawName: 'Лактатдегидрогеназа', unit: 'г/л' }),
      ],
      ANALYTES
    );
    expect(translated?.status).toBe('match');
    expect(badge?.status).toBe('match');
    expect(unrelated?.status).toBe('mismatch');
    expect(unrelated?.derived).toBeUndefined();
  });
});

describe('per-code allowed unit sets and alias collapsing', () => {
  // LOINC 1848-1's own example units list both ng/dL and pg/mL.
  const dhtCatalog: Analysis[] = [
    {
      loinc: '1848-1',
      longCommonName: 'Androstanolone (Dihydrotestosterone) [Mass/volume] in Serum or Plasma',
      friendlyName: 'Dihydrotestosterone (DHT)',
      lang: {},
    },
  ];

  it('treats a pg/mL DHT row as unit agreement for 1848-1', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'Dihydrotestosterone (DHT)', unit: 'pg/mL' }),
      dhtCatalog
    );
    expect(res.candidates[0]?.loinc).toBe('1848-1');
    expect(res.confident).toBe(true);
  });

  it('treats a ng/dL DHT row as unit agreement for 1848-1', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'Dihydrotestosterone (DHT)', unit: 'ng/dL' }),
      dhtCatalog
    );
    expect(res.candidates[0]?.loinc).toBe('1848-1');
    expect(res.confident).toBe(true);
  });

  const glucoseCatalog: Analysis[] = [
    {
      loinc: '2339-0',
      longCommonName: 'Glucose [Mass/volume] in Blood',
      friendlyName: 'Glucose (Whole Blood)',
      lang: {},
    },
    {
      loinc: '2345-7',
      longCommonName: 'Glucose [Mass/volume] in Serum or Plasma',
      friendlyName: 'Glucose (Serum/Plasma)',
      lang: {},
    },
  ];

  it('collapses a primary and its same-scale alias into one confident primary candidate', () => {
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'Glucose, Fasting', unit: 'mg/dL' }),
      glucoseCatalog
    );
    expect(res.candidates.map((c) => c.loinc)).toEqual(['2345-7']);
    expect(res.confident).toBe(true);
  });

  it('counts a row printing the alias code of the derived analyte as a match', () => {
    const [res] = crossCheckLocal(
      [createResult({ loinc: '2339-0', rawName: 'Glucose, Fasting', unit: 'mg/dL' })],
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
        friendlyName: 'SHBG',
        lang: {},
      },
      {
        loinc: '13967-5',
        longCommonName: 'Sex hormone binding globulin [Moles/volume] in Serum or Plasma',
        friendlyName: 'SHBG',
        lang: {},
      },
    ];
    const res = resolveLoinc(createResult({ loinc: '', rawName: 'SHBG', unit: 'nmol/L' }), shbgCatalog);
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
        friendlyName: 'Insulin',
        lang: {},
      },
      {
        loinc: '2484-4',
        longCommonName: 'Insulin-like growth factor 1 [Mass/volume] in Serum or Plasma',
        friendlyName: 'IGF-1 (Somatomedin C)',
        lang: {},
      },
    ];
    const res = resolveLoinc(
      createResult({ loinc: '', rawName: 'Insulin, Fasting', unit: 'µIU/mL' }),
      insulinCatalog
    );
    expect(res.candidates.map((c) => c.loinc)).toEqual(['20448-7']);
    expect(res.confident).toBe(true);
  });
});
