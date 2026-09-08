import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020';
import { ANALYSES, MONITORING_PANELS, PANELS } from './dataFiles';
import { ALIAS_TO_PRIMARY, ANALYTE_BY_LOINC, DEFAULT_UNITS, SHORT_LABELS } from '../src/data/analyteCatalog';

const SCHEMA_ID = 'https://blood.isayenko.net/schema/analytes-1.schema.json';

const schema = JSON.parse(
  readFileSync(new URL('../public/schema/analytes-1.schema.json', import.meta.url), 'utf8')
) as object;

const ajv = new Ajv2020({ allErrors: true });
ajv.addSchema(schema);

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
