import { describe, it, expect } from 'vitest';
import { LABORATORY_FILE, PANELS } from './dataFiles';
import { LABORATORIES, LABORATORY_BY_ID } from '../src/data/labPricing';
import { ANALYTE_BY_LOINC } from '../src/data/analyteCatalog';
import { compileSchema, schemaErrors } from './helpers/schema';

const { validate, subschema } = compileSchema('laboratories-1.schema.json');

describe('laboratories conform to laboratories-1.schema.json', () => {
  it('laboratories.json is a valid laboratory registry', () => {
    expect(schemaErrors(validate, LABORATORY_FILE)).toEqual([]);
  });

  it('rejects a price line with an unknown key, a non-LOINC code, no codes or a non-positive price', () => {
    const validate = subschema('#/$defs/priceLine');
    const base = { label: 'TC', price: 167, covers: ['2093-3'] };
    expect(validate(base)).toBe(true);
    expect(validate({ ...base, prce: 167 })).toBe(false);
    expect(validate({ ...base, covers: ['900101'] })).toBe(false);
    expect(validate({ ...base, covers: [] })).toBe(false);
    expect(validate({ ...base, price: 0 })).toBe(false);
    expect(validate({ ...base, price: -1 })).toBe(false);
  });
});

describe('laboratories are internally consistent', () => {
  it('no laboratory id is listed twice', () => {
    const ids = LABORATORIES.map((lab) => lab.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('no label is listed twice within a laboratory', () => {
    for (const lab of LABORATORIES) {
      const labels = lab.prices.map((line) => line.label);
      expect(labels, lab.id).toHaveLength(new Set(labels).size);
    }
  });

  it('every price is positive', () => {
    const wrong = LABORATORIES.flatMap((lab) =>
      lab.prices.filter((line) => !(line.price > 0)).map((line) => `${lab.id} ${line.label}: ${line.price}`)
    );
    expect(wrong).toEqual([]);
  });

  it('every covered code is in the catalog', () => {
    const unknown = LABORATORIES.flatMap((lab) =>
      lab.prices.flatMap((line) =>
        line.covers.filter((code) => !ANALYTE_BY_LOINC[code]).map((code) => `${lab.id} ${line.label}: ${code}`)
      )
    );
    expect(unknown).toEqual([]);
  });

  it('a bundle naming a laboratory group covers exactly that group', () => {
    for (const lab of LABORATORIES) {
      for (const line of lab.prices.filter((l) => l.panelId)) {
        const group = PANELS.find((p) => p.id === line.panelId);
        expect(group, `${lab.id} ${line.label} names unknown group ${line.panelId}`).toBeDefined();
        const codes = group!.loincs ?? group!.sections!.flatMap((s) => s.loincs);
        expect([...line.covers].sort(), `${lab.id} ${line.label}`).toEqual([...codes].sort());
      }
    }
  });

  it("prices Esculab's full blood count as the fbc group", () => {
    expect(LABORATORY_BY_ID.esculab?.prices.find((line) => line.label === 'FBC')?.panelId).toBe('fbc');
  });
});
