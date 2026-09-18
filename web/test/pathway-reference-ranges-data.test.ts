import { describe, it, expect } from 'vitest';
import { PATHWAY_RANGE_FILE } from './dataFiles';
import {
  PATHWAY_RANGE_MARKERS,
  PATHWAY_RANGE_SOURCES,
  PATHWAY_RANGE_SOURCE_BY_ID,
  convertConcentration,
  rangeStatus,
  rangesInUnit,
} from '../src/data/pathwayReferenceRanges';
import { ANALYTE_BY_LOINC, DEFAULT_UNITS } from '../src/data/analyteCatalog';
import { MOLAR_MASS_BY_ID, molarPerMassUnit } from '../src/data/molarMasses';
import { compileSchema, schemaErrors } from './helpers/schema';

const { validate, subschema } = compileSchema('pathway-reference-ranges-1.schema.json');

describe('pathway reference ranges conform to pathway-reference-ranges-1.schema.json', () => {
  it('pathway-reference-ranges.json is a valid range table', () => {
    expect(schemaErrors(validate, PATHWAY_RANGE_FILE)).toEqual([]);
  });

  it('rejects a range with an unknown key, no bound, or no source', () => {
    const validate = subschema('#/$defs/range');
    const base = { population: 'Adult men', low: 1, high: 2, unit: 'IU/L', sources: ['a'] };
    expect(validate(base)).toBe(true);
    expect(validate({ ...base, hgih: 2 })).toBe(false);
    expect(validate({ population: 'Adult men', unit: 'IU/L', sources: ['a'] })).toBe(false);
    expect(validate({ ...base, sources: [] })).toBe(false);
  });
});

describe('pathway reference ranges are internally consistent', () => {
  it('no marker or source id is listed twice', () => {
    const markers = PATHWAY_RANGE_MARKERS.map((m) => m.id);
    const sources = PATHWAY_RANGE_SOURCES.map((s) => s.id);
    expect(markers).toHaveLength(new Set(markers).size);
    expect(sources).toHaveLength(new Set(sources).size);
  });

  it('every cited source exists and every source is cited', () => {
    const cited = new Set(PATHWAY_RANGE_MARKERS.flatMap((m) => m.ranges.flatMap((r) => r.sources)));
    for (const id of cited) expect(PATHWAY_RANGE_SOURCE_BY_ID[id], `unknown source ${id}`).toBeDefined();
    for (const s of PATHWAY_RANGE_SOURCES) expect(cited.has(s.id), `${s.id} is never cited`).toBe(true);
  });

  it('every code is catalogued and every molar mass is tabulated', () => {
    for (const m of PATHWAY_RANGE_MARKERS) {
      for (const loinc of m.loincs) expect(ANALYTE_BY_LOINC[loinc], `${m.id}: ${loinc}`).toBeDefined();
      if (m.molarMass) expect(MOLAR_MASS_BY_ID[m.molarMass], `${m.id}: ${m.molarMass}`).toBeDefined();
    }
  });

  it('every range is ordered and places on the catalog unit of one of its codes', () => {
    for (const m of PATHWAY_RANGE_MARKERS) {
      for (const r of m.ranges) {
        if (r.low != null && r.high != null) expect(r.low, `${m.id}: ${r.population}`).toBeLessThan(r.high);
      }
      const populations = [...new Set(m.ranges.map((r) => r.population))];
      for (const population of populations) {
        const placesSomewhere = m.loincs.some((loinc) =>
          rangesInUnit(m, DEFAULT_UNITS[loinc]).some((r) => r.population === population && r.placed)
        );
        expect([m.id, population, placesSomewhere]).toEqual([m.id, population, true]);
      }
    }
  });

  it('converts only through derived factors and refuses what it cannot place', () => {
    expect(convertConcentration(1.7, 'IU/L', 'mIU/mL')).toBe(1.7);
    expect(convertConcentration(35, 'g/L', 'g/dL')).toBeCloseTo(3.5, 10);
    expect(convertConcentration(159, 'pmol/L', 'pg/mL', 'estradiol')).toBeCloseTo(159 * 0.272388, 6);
    expect(convertConcentration(264, 'ng/dL', 'nmol/L', 'testosterone')).toBeCloseTo(264 * molarPerMassUnit('testosterone', 'ng/dL', 'nmol/L'), 10);
    expect(convertConcentration(159, 'pmol/L', 'pg/mL')).toBeUndefined();
    expect(convertConcentration(1, 'IU/L', 'g/L')).toBeUndefined();
  });

  it('keeps a population on the source’s own figures when its unit cannot be reached, and rates a value against every age row', () => {
    const dht = PATHWAY_RANGE_MARKERS.find((m) => m.id === 'dht')!;
    expect(rangesInUnit(dht, 'nmol/L').map((r) => [r.low, r.high, r.unit, r.placed])).toEqual([[0.47, 2.65, 'nmol/L', true]]);
    expect(rangesInUnit(dht, 'U/L').every((r) => !r.placed && r.unit === 'ng/dL')).toBe(true);
    const shbg = rangesInUnit(PATHWAY_RANGE_MARKERS.find((m) => m.id === 'shbg')!, 'nmol/L');
    expect(rangeStatus(30, shbg)).toBe('ok');
    expect(rangeStatus(60, shbg)).toBe('warn');
    expect(rangeStatus(100, shbg)).toBe('bad');
    expect(rangeStatus(30, rangesInUnit(dht, 'U/L'))).toBeUndefined();
  });
});
