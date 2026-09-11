import { describe, it, expect } from 'vitest';
import {
  ATOMIC_WEIGHTS,
  concentrationRatio,
  massPerMolarUnit,
  molarMassFromFormula,
  molarPerMassUnit,
} from '../src/data/molarMasses';

describe('molarMassFromFormula', () => {
  const H = ATOMIC_WEIGHTS['H']!.value;
  const C = ATOMIC_WEIGHTS['C']!.value;
  const O = ATOMIC_WEIGHTS['O']!.value;

  it('sums symbols with and without a count', () => {
    expect(molarMassFromFormula('H2O')).toBeCloseTo(2 * H + O, 10);
    expect(molarMassFromFormula('C6H12O6')).toBeCloseTo(6 * C + 12 * H + 6 * O, 10);
    expect(molarMassFromFormula('O')).toBeCloseTo(O, 10);
  });

  it.each(['', 'h2o', '2H', 'H2O ', 'H2-O', 'Xx2'])('declines %j', (formula) => {
    expect(molarMassFromFormula(formula)).toBeUndefined();
  });
});

describe('concentrationRatio', () => {
  it.each([
    ['g/L', 'mg/dL', 100],
    ['mg/dL', 'g/L', 0.01],
    ['ng/mL', 'ng/dL', 100],
    ['mol/L', 'mmol/L', 1000],
    ['kg/L', 'g/L', 1000],
  ])('%s → %s is %s', (from, to, ratio) => {
    expect(concentrationRatio(from, to)).toBeCloseTo(ratio, 12);
  });

  it.each([
    ['mg', 'mg/dL'],
    ['mg/dL', 'mg'],
    ['mg', 'mg'],
    ['U/L', 'U/L'],
    ['mg/dL', 'U/L'],
    ['U/L', 'mg/dL'],
    ['mg/dL', 'mmol/L'],
    ['mmol/L', 'mg/dL'],
    ['mmg/L', 'g/L'],
    ['mg/kg', 'mg/L'],
    ['mg/dL/h', 'mg/dL'],
  ])('%s → %s is undefined', (from, to) => {
    expect(concentrationRatio(from, to)).toBeUndefined();
  });
});

describe('scale lookup behind the mass↔molar factors', () => {
  it('reads the base unit whatever the prefix', () => {
    expect(massPerMolarUnit('glucose', 'g/L', 'mol/L')).toBeCloseTo(molarPerMassUnit('glucose', 'g/L', 'mol/L') ** -1, 10);
    expect(massPerMolarUnit('glucose', 'mg/dL', 'mmol/L')).toBeCloseTo(18.0156, 4);
  });

  it('throws when a unit is of the wrong kind or not a concentration', () => {
    expect(() => massPerMolarUnit('glucose', 'mmol/L', 'mmol/L')).toThrow(/mass concentration/);
    expect(() => molarPerMassUnit('glucose', 'mg/dL', 'mg/dL')).toThrow(/molar concentration/);
    expect(() => massPerMolarUnit('glucose', 'kat/L', 'mmol/L')).toThrow(/mass concentration/);
    expect(() => massPerMolarUnit('glucose', 'mg/dL', 'mmol')).toThrow(/molar concentration/);
  });
});
