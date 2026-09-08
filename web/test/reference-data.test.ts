import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import { ANALYSES, MOLAR_MASS_FILE, MONITORING_PANELS, PANELS } from './dataFiles';
import { ALIAS_TO_PRIMARY, ANALYTE_BY_LOINC, DEFAULT_UNITS, SHORT_LABELS } from '../src/data/analyteCatalog';
import {
  MOLAR_MASSES,
  MOLAR_MASS_BY_ID,
  massPerMolarUnit,
  molarMassFromFormula,
  molarPerMassUnit,
} from '../src/data/molarMasses';
import { MASS_MOLAR_SIBLINGS } from '../src/data/massMolarSiblings';

const SCHEMA_ID = 'https://blood.isayenko.net/schema/analytes-1.schema.json';
const MOLAR_SCHEMA_ID = 'https://blood.isayenko.net/schema/molar-masses-1.schema.json';

function loadSchema(name: string): object {
  return JSON.parse(readFileSync(new URL(`../public/schema/${name}`, import.meta.url), 'utf8')) as object;
}

const ajv = new Ajv2020({ allErrors: true });
ajv.addSchema(loadSchema('analytes-1.schema.json'));
ajv.addSchema(loadSchema('molar-masses-1.schema.json'));

function validator(pointer: string): ValidateFunction {
  const compiled = ajv.getSchema(`${SCHEMA_ID}${pointer}`);
  if (!compiled) throw new Error(`no subschema at ${pointer}`);
  return compiled;
}

function errorsIn(validate: ValidateFunction, value: unknown): string[] {
  validate(value);
  return (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`);
}

describe('reference data conforms to analytes-1.schema.json', () => {
  it('analyses.json is a valid analyte catalog', () => {
    expect(errorsIn(validator(''), ANALYSES)).toEqual([]);
  });

  it('panels.json entries are valid laboratory groups', () => {
    const validate = validator('#/$defs/labPanel');
    expect(PANELS.flatMap((p) => errorsIn(validate, p).map((e) => `${p.id}: ${e}`))).toEqual([]);
  });

  it('monitoring-panels.json entries are valid panel compositions', () => {
    const validate = validator('#/$defs/monitoringPanel');
    expect(MONITORING_PANELS.flatMap((p) => errorsIn(validate, p).map((e) => `${p.name}: ${e}`))).toEqual([]);
  });

  it('rejects an entry with an unknown key or a badge label lacking a unit', () => {
    const validate = validator('#/$defs/analyte');
    const base = { loinc: '1-8', longCommonName: 'x', displayName: 'x', lang: { 'ru-RU': 'x' } };
    expect(validate(base)).toBe(true);
    expect(validate({ ...base, shortt: 'T' })).toBe(false);
    expect(validate({ ...base, short: 'T' })).toBe(false);
    expect(validate({ ...base, loinc: '900101' })).toBe(false);
    expect(validate({ ...base, aliasOf: '2-6' })).toBe(false);
  });
});

describe('reference data is internally consistent', () => {
  it('no LOINC is listed twice in the catalog', () => {
    const codes = ANALYSES.map((a) => a.loinc);
    expect(codes).toHaveLength(new Set(codes).size);
  });

  it('every aliasOf names a catalog entry that is not itself an alias', () => {
    for (const [alias, primary] of Object.entries(ALIAS_TO_PRIMARY)) {
      expect(ANALYTE_BY_LOINC[primary], `${alias} points at unknown ${primary}`).toBeDefined();
      expect(ANALYTE_BY_LOINC[primary]!.aliasOf, `${primary} is itself an alias`).toBeUndefined();
    }
  });

  it('every badge label comes with the unit its range checks use', () => {
    for (const loinc of Object.keys(SHORT_LABELS)) {
      expect(DEFAULT_UNITS[loinc], `${loinc} has a short label but no unit`).toBeTruthy();
    }
  });

  it('every Monitoring Panel resolves against the laboratory groups', () => {
    const groupIds = new Set(PANELS.map((p) => p.id));
    for (const def of MONITORING_PANELS) {
      for (const id of [...(def.panelId ? [def.panelId] : []), ...(def.panelIds ?? [])]) {
        expect(groupIds.has(id), `${def.name} refers to unknown group ${id}`).toBe(true);
      }
    }
  });

  it('Monitoring Panel names are unique', () => {
    const names = MONITORING_PANELS.map((p) => p.name);
    expect(names).toHaveLength(new Set(names).size);
  });
});

describe('molar masses conform to molar-masses-1.schema.json', () => {
  it('molar-masses.json is a valid molar-mass table', () => {
    const validate = ajv.getSchema(MOLAR_SCHEMA_ID)!;
    expect(errorsIn(validate, MOLAR_MASS_FILE)).toEqual([]);
  });

  it('rejects an entry with an unknown key, a bad formula, or a conventional basis with no note', () => {
    const validate = ajv.getSchema(`${MOLAR_SCHEMA_ID}#/$defs/molarMass`)!;
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

  it('every mass/molar sibling pair names a tabulated molar mass', () => {
    for (const pair of MASS_MOLAR_SIBLINGS) {
      expect(MOLAR_MASS_BY_ID[pair.molarMass], `${pair.analyte} → unknown ${pair.molarMass}`).toBeDefined();
      expect(pair.molarMassGPerMol).toBe(MOLAR_MASS_BY_ID[pair.molarMass]!.molarMassGPerMol);
    }
  });

  it('folds a catalogued molar sibling into its mass code rather than beside it', () => {
    for (const pair of MASS_MOLAR_SIBLINGS) {
      if (!ANALYTE_BY_LOINC[pair.molar.loinc] || !ANALYTE_BY_LOINC[pair.mass.loinc]) continue;
      const primary = ALIAS_TO_PRIMARY[pair.molar.loinc] ?? pair.molar.loinc;
      const massPrimary = ALIAS_TO_PRIMARY[pair.mass.loinc] ?? pair.mass.loinc;
      expect([pair.analyte, primary]).toEqual([pair.analyte, massPrimary]);
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
