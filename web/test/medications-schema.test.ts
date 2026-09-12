import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { addCompound, addRow, emptyMedications, toggleMonth, updateCompound, updateRow, type Medications } from '../src/data/medications';

// Documentation only, mirroring envelope-schema.test.ts: this checks the
// published schema is well-formed and agrees with what medications.ts
// actually produces. It is a smoke test, not an enforcement gate — the
// lenient hand-written parser in medications.ts stays the real gatekeeper
// for user imports, and nothing here wires ajv into that path.
const schema = JSON.parse(
  readFileSync(new URL('../public/schema/medications-1.schema.json', import.meta.url), 'utf8')
) as object;

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

function errorsFor(value: unknown): string[] {
  validate(value);
  return (validate.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`);
}

describe('published JSON Schema — medications-1.schema.json', () => {
  it('is a valid draft 2020-12 schema with the published $id', () => {
    expect((schema as { $id: string }).$id).toBe('https://blood.isayenko.net/schema/medications-1.schema.json');
    expect(typeof validate).toBe('function');
  });

  it('accepts emptyMedications()', () => {
    expect(errorsFor(emptyMedications(2026))).toEqual([]);
  });

  it('accepts a row carrying a brand, notes and some months', () => {
    let meds = addRow(emptyMedications(2026), 'row-1');
    meds = updateRow(meds, 'row-1', { brand: 'Levothyroxine', notes: 'morning' });
    meds = toggleMonth(meds, 'row-1', '2026-01');
    meds = toggleMonth(meds, 'row-1', '2026-03');

    expect(errorsFor(meds)).toEqual([]);
  });

  it('accepts a row whose compounds break out a combo brand', () => {
    let meds = addRow(emptyMedications(2026), 'row-1');
    meds = updateRow(meds, 'row-1', { brand: 'Вальсакор Н80' });
    meds = addCompound(meds, 'row-1');
    meds = updateCompound(meds, 'row-1', 0, { name: 'valsartan', dose: '80mg' });
    meds = addCompound(meds, 'row-1');
    meds = updateCompound(meds, 'row-1', 1, { name: 'Hydrochlorothiazide', dose: '12.5mg' });

    expect(errorsFor(meds)).toEqual([]);
  });

  it('accepts a hand-built example with empty compounds/notes and no months yet', () => {
    const meds: Medications = {
      years: [2025, 2026],
      rows: [{ id: 'row-2', brand: 'Vitamin D', compounds: [], notes: '', months: [] }],
    };

    expect(errorsFor(meds)).toEqual([]);
  });

  it('rejects a row with an empty id', () => {
    const meds: Medications = { years: [2026], rows: [{ id: '', brand: 'X', compounds: [], notes: '', months: [] }] };
    expect(errorsFor(meds)).not.toEqual([]);
  });

  it('rejects a month key that is not ISO YYYY-MM', () => {
    const meds: Medications = {
      years: [2026],
      rows: [{ id: 'row-3', brand: 'X', compounds: [], notes: '', months: ['2026-1'] }],
    };
    expect(errorsFor(meds)).not.toEqual([]);
  });

  it('rejects a row still in the retired name/dosage shape', () => {
    const meds = { years: [2026], rows: [{ id: 'row-4', name: 'X', dosage: '', months: [] }] };
    expect(errorsFor(meds)).not.toEqual([]);
  });

  it('rejects an unknown top-level property', () => {
    expect(errorsFor({ ...emptyMedications(2026), lab: 'esculab' })).not.toEqual([]);
  });

  it('rejects a year outside 1000-9999', () => {
    expect(errorsFor({ years: [999], rows: [] })).not.toEqual([]);
    expect(errorsFor({ years: [10000], rows: [] })).not.toEqual([]);
  });
});
