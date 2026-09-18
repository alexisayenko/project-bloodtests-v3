import { describe, it, expect } from 'vitest';
import { LOINC_RE, latinPart, normalizeUnit, canonicalUnit, tokenOverlap } from '../src/data/loincCheck';
import { ALLOWED_UNITS, DEFAULT_UNITS } from '../src/data/analyteCatalog';

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

  // The resolver's unit agreement canonicalises both the printed unit and the catalog's own, so a
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

  it('is 0 when the only shared words are generic ones', () => {
    expect(tokenOverlap('Total Serum', 'Protein [Mass/volume] in Serum or Plasma, total')).toBe(0);
  });
});
