import { describe, it, expect } from 'vitest';
import {
  toLatinUnit,
  toUcum,
  dimensionOf,
  checkCodeUnit,
  normalizeObservationUnit,
  convertValue,
  canonicalUnitFor,
} from '../src/data/unitNormalization';
import { MASS_MOLAR_SIBLINGS } from '../src/data/massMolarSiblings';

describe('toLatinUnit', () => {
  it('maps the Cyrillic units the real dataset prints', () => {
    const cases: [string, string][] = [
      ['ммоль/л', 'mmol/L'],
      ['мкмоль/л', 'umol/L'],
      ['нмоль/л', 'nmol/L'],
      ['пмоль/л', 'pmol/L'],
      ['МЕ/мл', 'IU/mL'],
      ['МЕ/л', 'IU/L'],
      ['мкМЕ/мл', 'uIU/mL'],
      ['мМЕ/л', 'mIU/L'],
      ['г/л', 'g/L'],
      ['г/дл', 'g/dL'],
      ['мг/дл', 'mg/dL'],
      ['ед/л', 'U/L'],
      ['Ед/л', 'U/L'],
      ['мкг/л', 'ug/L'],
      ['мкг/дл', 'ug/dL'],
      ['нг/мл', 'ng/mL'],
      ['пг/мл', 'pg/mL'],
      ['фл', 'fL'],
      ['пг', 'pg'],
      ['мм/ч', 'mm/h'],
      ['%', '%'],
    ];
    for (const [printed, latin] of cases) {
      expect([printed, toLatinUnit(printed)]).toEqual([printed, latin]);
    }
  });

  it('handles superscript, caret and star exponents with either denominator', () => {
    expect(toLatinUnit('×10⁹/л')).toBe('10^9/L');
    expect(toLatinUnit('10^9/л')).toBe('10^9/L');
    expect(toLatinUnit('10*9/L')).toBe('10^9/L');
    expect(toLatinUnit('x10^3/uL')).toBe('10^3/uL');
    expect(toLatinUnit('×10¹²/л')).toBe('10^12/L');
    expect(toLatinUnit('тыс/мкл')).toBe('10^3/uL');
  });

  it('is case- and spacing-tolerant and folds micro-sign variants', () => {
    expect(toLatinUnit('ММОЛЬ/Л')).toBe('mmol/L');
    expect(toLatinUnit(' ммоль / л ')).toBe('mmol/L');
    expect(toLatinUnit('µg/dL')).toBe('ug/dL');
    expect(toLatinUnit('μmol/L')).toBe('umol/L');
    expect(toLatinUnit('mcg/dL')).toBe('ug/dL');
    expect(toLatinUnit('MMOL/L')).toBe('mmol/L');
    expect(toLatinUnit('fL?')).toBe('fL');
  });

  it('reads the Ukrainian МО international-unit family as the IU spellings', () => {
    const cases: [string, string][] = [
      ['мкМО/мл', 'uIU/mL'],
      ['МО/мл', 'IU/mL'],
      ['МО/л', 'IU/L'],
      ['мМО/л', 'mIU/L'],
      ['кМО/л', 'kIU/L'],
    ];
    for (const [printed, latin] of cases) {
      expect([printed, toLatinUnit(printed)]).toEqual([printed, latin]);
    }
  });

  it('returns undefined for anything it does not know, rather than guessing', () => {
    for (const unknown of ['', '   ', 'попугаев/л', 'мкмоль/попугай', 'furlongs/fortnight', 'Positive/Negative', 'mmol/']) {
      expect([unknown, toLatinUnit(unknown)]).toEqual([unknown, undefined]);
    }
  });
});

describe('toUcum', () => {
  it('maps Latin units to their UCUM code', () => {
    const cases: [string, string][] = [
      ['mmol/L', 'mmol/L'],
      ['umol/L', 'umol/L'],
      ['nmol/L', 'nmol/L'],
      ['mIU/L', 'm[IU]/L'],
      ['IU/mL', '[IU]/mL'],
      ['uIU/mL', 'u[IU]/mL'],
      ['g/L', 'g/L'],
      ['U/L', 'U/L'],
      ['10^9/L', '10*9/L'],
      ['x10^3/uL', '10*3/uL'],
      ['fL', 'fL'],
      ['pg', 'pg'],
      ['ug/L', 'ug/L'],
      ['ng/mL', 'ng/mL'],
      ['mg/dL', 'mg/dL'],
      ['%', '%'],
      ['mmol/mol', 'mmol/mol'],
      ['mm/hr', 'mm/h'],
      ['sec', 's'],
      ['ratio', '{ratio}'],
      ['mL/min/1.73m2', 'mL/min/{1.73_m2}'],
    ];
    for (const [latin, ucum] of cases) {
      expect([latin, toUcum(latin)]).toEqual([latin, ucum]);
    }
  });

  it('returns undefined for units outside the curated table', () => {
    for (const unknown of ['', 'bananas/L', 'mmol/bananas', 'Positive/Negative']) {
      expect([unknown, toUcum(unknown)]).toEqual([unknown, undefined]);
    }
  });
});

describe('dimensionOf', () => {
  it('reads dimensions from UCUM, Latin and printed spellings alike', () => {
    expect(dimensionOf('mmol/L')).toBe('substance/volume');
    expect(dimensionOf('ммоль/л')).toBe('substance/volume');
    expect(dimensionOf('mg/dL')).toBe('mass/volume');
    expect(dimensionOf('m[IU]/L')).toBe('arbitrary/volume');
    expect(dimensionOf('U/L')).toBe('arbitrary/volume');
    expect(dimensionOf('10*9/L')).toBe('count/volume');
    expect(dimensionOf('fL')).toBe('volume');
    expect(dimensionOf('pg')).toBe('mass');
    expect(dimensionOf('%')).toBe('dimensionless');
    expect(dimensionOf('mmol/mol')).toBe('dimensionless');
    expect(dimensionOf('mL/min/{1.73_m2}')).toBe('clearance');
    expect(dimensionOf('Positive/Negative')).toBeUndefined();
  });
});

describe('checkCodeUnit', () => {
  it('flags a molar unit under a mass-concentration code and names the sibling', () => {
    const check = checkCodeUnit('2093-3', 'mmol/L');
    expect(check.kind).toBe('dimension-mismatch');
    if (check.kind !== 'dimension-mismatch') return;
    expect(check.expected).toBe('mg/dL');
    expect(check.suggestedLoinc).toBe('14647-2');
    expect(check.note).toContain('change the code, not the value');
  });

  it('accepts the unit the code actually expects', () => {
    expect(checkCodeUnit('2093-3', 'mg/dL')).toEqual({ kind: 'ok' });
    expect(checkCodeUnit('14647-2', 'mmol/L')).toEqual({ kind: 'ok' });
  });

  it('suggests the mass sibling for a mass unit under a molar code', () => {
    const check = checkCodeUnit('14682-9', 'mg/dL');
    expect(check.kind).toBe('dimension-mismatch');
    if (check.kind !== 'dimension-mismatch') return;
    expect(check.suggestedLoinc).toBe('2160-0');
  });

  it('treats a different scale of the same dimension as ok', () => {
    expect(checkCodeUnit('11580-8', 'u[IU]/mL')).toEqual({ kind: 'ok' });
    expect(checkCodeUnit('1742-6', '[IU]/L')).toEqual({ kind: 'ok' });
    expect(checkCodeUnit('2885-2', 'g/L')).toEqual({ kind: 'ok' });
    expect(checkCodeUnit('6690-2', '10*9/L')).toEqual({ kind: 'ok' });
    expect(checkCodeUnit('4548-4', 'mmol/mol')).toEqual({ kind: 'ok' });
  });

  it('reports an unknown code and an unknown unit separately', () => {
    expect(checkCodeUnit('99999-9', 'mmol/L')).toEqual({ kind: 'unknown-code' });
    expect(checkCodeUnit('2093-3', 'бананы/л')).toEqual({ kind: 'unknown-unit' });
  });

  it('stays quiet for codes whose expected value is not a measurement', () => {
    expect(checkCodeUnit('5195-3', 'mg/dL')).toEqual({ kind: 'ok' });
  });

  it('accepts every molar sibling code paired with its own molar unit', () => {
    for (const pair of MASS_MOLAR_SIBLINGS) {
      expect([pair.molar.loinc, checkCodeUnit(pair.molar.loinc, pair.molar.unit)]).toEqual([
        pair.molar.loinc,
        { kind: 'ok' },
      ]);
    }
  });

  it('no longer treats ESR, the Quick prothrombin ratio and thrombin time as unknown codes', () => {
    expect(checkCodeUnit('30341-2', 'mm/h')).toEqual({ kind: 'ok' });
    expect(checkCodeUnit('5894-1', '%')).toEqual({ kind: 'ok' });
    expect(checkCodeUnit('3243-3', 's')).toEqual({ kind: 'ok' });
  });
});

describe('normalizeObservationUnit', () => {
  it('returns the printed, Latin, UCUM and check in one result', () => {
    const result = normalizeObservationUnit({ loinc: '2160-0', unit: 'мкмоль/л' });
    expect(result.printedUnit).toBe('мкмоль/л');
    expect(result.latinUnit).toBe('umol/L');
    expect(result.ucumUnit).toBe('umol/L');
    expect(result.check.kind).toBe('dimension-mismatch');
    expect(result.message).toContain('14682-9');
  });

  it('reports an unrecognized printed unit without guessing', () => {
    const result = normalizeObservationUnit({ loinc: '2160-0', unit: 'попугаев/л' });
    expect(result.latinUnit).toBeUndefined();
    expect(result.ucumUnit).toBeUndefined();
    expect(result.check).toEqual({ kind: 'unknown-unit' });
    expect(result.message).toContain('left exactly as printed');
  });

  it('never mutates its argument', () => {
    const input = Object.freeze({ loinc: '2093-3', unit: 'ммоль/л' });
    const before = JSON.stringify(input);
    normalizeObservationUnit(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(input.unit).toBe('ммоль/л');
  });

  it('never converts a value — 6.9 mmol/L stays 6.9 and the remedy is the code', () => {
    const observation = { loinc: '2093-3', unit: 'ммоль/л', value: 6.9 };
    const result = normalizeObservationUnit(observation);
    expect(Object.keys(result).sort()).toEqual(['check', 'latinUnit', 'message', 'printedUnit', 'ucumUnit']);
    expect(JSON.stringify(result)).not.toMatch(/6\.9|267/);
    expect(observation.value).toBe(6.9);
    if (result.check.kind !== 'dimension-mismatch') throw new Error('expected a dimension mismatch');
    expect(result.check.suggestedLoinc).toBe('14647-2');
  });
});

describe('convertValue', () => {
  it('converts cholesterol 6.9 mmol/L to ~267 mg/dL (MASS_MOLAR_SIBLINGS molar mass 386.65 g/mol, i.e. the conventional 38.67 mg/dL per mmol/L)', () => {
    const converted = convertValue(6.9, 'mmol/L', 'mg/dL', '2093-3');
    expect(converted?.unit).toBe('mg/dL');
    expect(converted?.value).toBeCloseTo(266.8, 0);
  });

  it('converts back the other way across the mass/molar divide', () => {
    const converted = convertValue(267, 'mg/dL', 'mmol/L', '14647-2');
    expect(converted?.value).toBeCloseTo(6.9, 1);
  });

  it('round-trips a scale-only pair within tolerance', () => {
    const toMgdl = convertValue(42, 'g/L', 'mg/dL', '1751-7');
    expect(toMgdl?.value).toBeCloseTo(4200, 6);
    expect(convertValue(toMgdl!.value, 'mg/dL', 'g/L', '1751-7')?.value).toBeCloseTo(42, 9);

    const toNgml = convertValue(3.2, 'ug/L', 'ng/mL', '17838-4');
    expect(toNgml?.value).toBeCloseTo(3.2, 9);
    expect(convertValue(toNgml!.value, 'ng/mL', 'ug/L', '17838-4')?.value).toBeCloseTo(3.2, 9);
  });

  it('returns undefined for an unknown pair rather than inventing a factor', () => {
    // No sibling entry, so no molar mass for this analyte.
    expect(convertValue(1, 'mmol/L', 'mg/dL', '99999-9')).toBeUndefined();
    // Different quantities entirely.
    expect(convertValue(1, 'mg/dL', 'U/L', '2093-3')).toBeUndefined();
    // Units with no defined magnitude.
    expect(convertValue(5.4, '%', 'mmol/mol', '4548-4')).toBeUndefined();
    expect(convertValue(6.2, '10*9/L', '10*3/uL', '6690-2')).toBeUndefined();
    expect(convertValue(1, 'mmol/L', 'бананы/л', '2093-3')).toBeUndefined();
    expect(convertValue(Number.NaN, 'mmol/L', 'mg/dL', '2093-3')).toBeUndefined();
  });

  it('refuses look-alike dimensionless pairs measuring different things', () => {
    expect(convertValue(36, 'mmol/mol', 'mg/g', '4548-4')).toBeUndefined();
  });
});

describe('canonicalUnitFor', () => {
  it('gives the curated reference unit in UCUM', () => {
    expect(canonicalUnitFor('2093-3')).toBe('mg/dL');
    expect(canonicalUnitFor('2191-5')).toBe('ug/dL');
    expect(canonicalUnitFor('11580-8')).toBe('m[IU]/L');
    expect(canonicalUnitFor('14913-8')).toBe('nmol/L');
  });

  it('falls back to the sibling table for the molar twins', () => {
    expect(canonicalUnitFor('14647-2')).toBe('mmol/L');
    expect(canonicalUnitFor('14682-9')).toBe('umol/L');
  });

  it('is undefined for a code the project has no unit for', () => {
    expect(canonicalUnitFor('99999-9')).toBeUndefined();
  });
});

describe('normalizeObservationUnit — derived canonical form', () => {
  it('derives the canonical value beside the untouched printed pair', () => {
    const result = normalizeObservationUnit({ loinc: '1848-1', unit: 'pg/mL', value: 500 });
    expect(result.printedUnit).toBe('pg/mL');
    expect(result.ucumUnit).toBe('pg/mL');
    expect(result.check).toEqual({ kind: 'ok' });
    expect(result.canonical?.unit).toBe('ng/dL');
    expect(result.canonical?.value).toBeCloseTo(50, 9);
  });

  it('reads a Cyrillic printed unit through to the canonical scale', () => {
    const result = normalizeObservationUnit({ loinc: '11580-8', unit: 'мкМЕ/мл', value: 2.1 });
    expect(result.ucumUnit).toBe('u[IU]/mL');
    expect(result.canonical?.unit).toBe('m[IU]/L');
    expect(result.canonical?.value).toBeCloseTo(2.1, 9);
  });

  it('omits the canonical form when the conversion is unknown', () => {
    // % has no defined magnitude.
    expect(normalizeObservationUnit({ loinc: '4548-4', unit: '%', value: 5.4 }).canonical).toBeUndefined();
    // The project knows no unit for this code.
    expect(normalizeObservationUnit({ loinc: '99999-9', unit: 'mmol/L', value: 6.9 }).canonical).toBeUndefined();
    // Nothing to convert without a value.
    expect(normalizeObservationUnit({ loinc: '2093-3', unit: 'mg/dL' }).canonical).toBeUndefined();
  });

  it('omits the canonical form for a code/unit mismatch — the remedy stays the sibling code', () => {
    const result = normalizeObservationUnit({ loinc: '2093-3', unit: 'ммоль/л', value: 6.9 });
    expect(result.canonical).toBeUndefined();
    if (result.check.kind !== 'dimension-mismatch') throw new Error('expected a dimension mismatch');
    expect(result.check.suggestedLoinc).toBe('14647-2');
  });

  it('still does not mutate its argument when it derives a canonical form', () => {
    const input = Object.freeze({ loinc: '1848-1', unit: 'pg/mL', value: 500 });
    const before = JSON.stringify(input);
    const result = normalizeObservationUnit(input);
    expect(result.canonical?.value).toBeCloseTo(50, 9);
    expect(JSON.stringify(input)).toBe(before);
    expect(input.value).toBe(500);
    expect(input.unit).toBe('pg/mL');
  });
});

describe('MASS_MOLAR_SIBLINGS', () => {
  it('pairs a mass/volume code with a moles/volume code and carries a factor', () => {
    for (const pair of MASS_MOLAR_SIBLINGS) {
      expect([pair.analyte, dimensionOf(pair.mass.unit)]).toEqual([pair.analyte, 'mass/volume']);
      expect([pair.analyte, dimensionOf(pair.molar.unit)]).toEqual([pair.analyte, 'substance/volume']);
      expect(pair.mass.longCommonName).toContain('[Mass/volume]');
      expect(pair.molar.longCommonName).toContain('[Moles/volume]');
      expect(pair.massPerMolarUnit).toBeGreaterThan(0);
    }
  });

  it('lists every code exactly once', () => {
    const codes = MASS_MOLAR_SIBLINGS.flatMap((pair) => [pair.mass.loinc, pair.molar.loinc]);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
