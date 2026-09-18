import { describe, it, expect } from 'vitest';
import { MOLAR_MASS_FILE } from './dataFiles';
import { MOLAR_MASSES, massPerMolarUnit, molarMassFromFormula, molarPerMassUnit } from '../src/data/molarMasses';
import { compileSchema, schemaErrors } from './helpers/schema';

const { validate, subschema } = compileSchema('molar-masses-1.schema.json');

describe('molar masses conform to molar-masses-1.schema.json', () => {
  it('molar-masses.json is a valid molar-mass table', () => {
    expect(schemaErrors(validate, MOLAR_MASS_FILE)).toEqual([]);
  });

  it('rejects an entry with an unknown key, a bad formula, or a conventional basis with no note', () => {
    const validate = subschema('#/$defs/molarMass');
    const base = {
      id: 'glucose',
      name: 'Glucose',
      formula: 'C6H12O6',
      molarMassGPerMol: 180.156,
      basis: 'compound',
      sources: [
        {
          authority: 'PubChem',
          identifier: 'CID 5793',
          url: 'https://pubchem.ncbi.nlm.nih.gov/compound/5793',
          retrieved: '2026-09-08',
        },
      ],
    };
    expect(validate(base)).toBe(true);
    expect(validate({ ...base, formulaa: 'C6H12O6' })).toBe(false);
    expect(validate({ ...base, formula: '6C12H6O' })).toBe(false);
    expect(validate({ ...base, id: 'Glucose' })).toBe(false);
    expect(validate({ ...base, molarMassGPerMol: 0 })).toBe(false);
    expect(validate({ ...base, basis: 'conventional' })).toBe(false);
    expect(validate({ ...base, basis: 'conventional', note: 'why' })).toBe(true);
    expect(validate({ ...base, sources: [] })).toBe(false);
  });
});

describe('molar masses are internally consistent', () => {
  it('no id is listed twice', () => {
    const ids = MOLAR_MASSES.map((m) => m.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('every tabulated mass is reproducible from its formula and the atomic weights', () => {
    for (const entry of MOLAR_MASSES) {
      const recomputed = molarMassFromFormula(entry.formula);
      expect(recomputed, `${entry.id}: formula ${entry.formula} uses an untabulated element`).toBeDefined();
      expect(recomputed!, `${entry.id}: ${entry.formula}`).toBeCloseTo(entry.molarMassGPerMol, 5);
    }
  });

  it('every tabulated mass agrees with a cited source to within 0.05%', () => {
    for (const entry of MOLAR_MASSES) {
      const reported = entry.sources
        .map((s) => s.reportedMolarMassGPerMol)
        .filter((v): v is number => v !== undefined);
      if (entry.basis === 'conventional' && reported.length === 0) continue;
      expect(reported.length, `${entry.id} has no source reporting a mass to check against`).toBeGreaterThan(0);
      for (const value of reported) {
        const deviation = Math.abs(value - entry.molarMassGPerMol) / entry.molarMassGPerMol;
        expect(deviation, `${entry.id}: tabulated ${entry.molarMassGPerMol}, source ${value}`).toBeLessThan(5e-4);
      }
    }
  });

  it('a conventional mass says in its own note what the convention is', () => {
    for (const entry of MOLAR_MASSES.filter((m) => m.basis === 'conventional')) {
      expect(entry.note, `${entry.id} is conventional but unexplained`).toBeTruthy();
    }
  });


  it('derives the conversion factors the app actually uses', () => {
    // Spot-checks in both directions, on the four decimal prefixes in play.
    expect(massPerMolarUnit('cholesterol', 'mg/dL', 'mmol/L')).toBeCloseTo(38.6664, 4);
    expect(massPerMolarUnit('glucose', 'mg/dL', 'mmol/L')).toBeCloseTo(18.0156, 4);
    expect(massPerMolarUnit('creatinine', 'mg/dL', 'umol/L')).toBeCloseTo(0.011312, 6);
    expect(massPerMolarUnit('iron', 'ug/dL', 'umol/L')).toBeCloseTo(5.5845, 4);
    expect(molarPerMassUnit('testosterone', 'ng/dL', 'nmol/L')).toBeCloseTo(0.0346703, 7);
    expect(molarPerMassUnit('thyroxine', 'ng/dL', 'pmol/L')).toBeCloseTo(12.8721, 4);
    expect(molarPerMassUnit('triiodothyronine', 'pg/mL', 'pmol/L')).toBeCloseTo(1.5361516, 6);
  });

  it('refuses a unit it does not fully understand rather than guessing', () => {
    expect(() => massPerMolarUnit('glucose', 'mg/dL', 'mg/dL')).toThrow();
    expect(() => massPerMolarUnit('glucose', 'U/L', 'mmol/L')).toThrow();
    expect(() => massPerMolarUnit('glucose', 'mg', 'mmol/L')).toThrow();
    expect(() => massPerMolarUnit('glucose', 'mg/dL', 'mmol/kg')).toThrow();
    expect(() => massPerMolarUnit('unobtainium', 'mg/dL', 'mmol/L')).toThrow();
    expect(molarMassFromFormula('Xx2')).toBeUndefined();
    expect(molarMassFromFormula('h2o')).toBeUndefined();
  });
});
