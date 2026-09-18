import { describe, it, expect } from 'vitest';
import { MARTIN_HOPKINS_FILE } from './dataFiles';
import { MARTIN_HOPKINS_NON_HDL_BANDS, MARTIN_HOPKINS_ROWS, martinHopkinsFactor } from '../src/data/martinHopkinsLdl';
import { compileSchema, schemaErrors } from './helpers/schema';

const { validate, subschema } = compileSchema('martin-hopkins-ldl-table-1.schema.json');

describe('Martin-Hopkins LDL table conforms to martin-hopkins-ldl-table-1.schema.json', () => {
  it('martin-hopkins-ldl-table.json is a valid factor table', () => {
    expect(schemaErrors(validate, MARTIN_HOPKINS_FILE)).toEqual([]);
  });

  it('rejects a row or band with an unknown key or a non-positive bound', () => {
    const row = subschema('#/$defs/row');
    const baseRow = { trigLow: 7, trigHigh: 49, factors: [3.5, 3.4, 3.3, 3.3, 3.2, 3.1] };
    expect(row(baseRow)).toBe(true);
    expect(row({ ...baseRow, trigLoww: 7 })).toBe(false);
    expect(row({ ...baseRow, factors: [3.5, 3.4, 3.3, 3.3, 3.2] })).toBe(false);
    expect(row({ ...baseRow, trigHigh: 0 })).toBe(false);

    const band = subschema('#/$defs/band');
    expect(band({ high: 99 })).toBe(true);
    expect(band({ low: 220 })).toBe(true);
    expect(band({})).toBe(false);
  });
});

describe('Martin-Hopkins LDL table is internally consistent', () => {
  it('is 30 rows x 6 columns = 180 cells', () => {
    expect(MARTIN_HOPKINS_ROWS).toHaveLength(30);
    expect(MARTIN_HOPKINS_NON_HDL_BANDS).toHaveLength(6);
    for (const row of MARTIN_HOPKINS_ROWS) expect(row.factors).toHaveLength(6);
  });

  it('the triglyceride strata are contiguous from 7 to 13975, no gaps or overlaps', () => {
    expect(MARTIN_HOPKINS_ROWS[0]!.trigLow).toBe(7);
    expect(MARTIN_HOPKINS_ROWS.at(-1)!.trigHigh).toBe(13975);
    for (let i = 1; i < MARTIN_HOPKINS_ROWS.length; i++) {
      expect(MARTIN_HOPKINS_ROWS[i]!.trigLow, `row ${i}`).toBe(MARTIN_HOPKINS_ROWS[i - 1]!.trigHigh + 1);
    }
  });

  it('every row is non-increasing left to right (higher non-HDL-C never raises the factor)', () => {
    const bad: string[] = [];
    for (const row of MARTIN_HOPKINS_ROWS) {
      for (let c = 1; c < row.factors.length; c++) {
        if (row.factors[c]! > row.factors[c - 1]!) bad.push(`TG ${row.trigLow}-${row.trigHigh} col ${c}: ${row.factors[c - 1]} -> ${row.factors[c]}`);
      }
    }
    expect(bad).toEqual([]);
  });

  // Each column should trend upward as TG rises (the factor grows with
  // triglyceride load). A strict monotonicity assertion would be wrong: these
  // are strata medians and the source has exactly one genuine dip. Assert the
  // trend plus that single named exception, so a second dip -- a transcription
  // slip -- still fails the test.
  it('every column trends non-decreasing top to bottom, but for the one documented dip (TG 97-100, >=220 non-HDL-C: 4.4 -> 4.3)', () => {
    const dips: string[] = [];
    for (let c = 0; c < 6; c++) {
      for (let i = 1; i < MARTIN_HOPKINS_ROWS.length; i++) {
        const prev = MARTIN_HOPKINS_ROWS[i - 1]!;
        const cur = MARTIN_HOPKINS_ROWS[i]!;
        if (cur.factors[c]! < prev.factors[c]!) {
          dips.push(`col ${c}: TG ${prev.trigLow}-${prev.trigHigh} -> ${cur.trigLow}-${cur.trigHigh}: ${prev.factors[c]} -> ${cur.factors[c]}`);
        }
      }
    }
    expect(dips).toEqual(['col 5: TG 93-96 -> 97-100: 4.4 -> 4.3']);
  });

  it('values span the published 3.1-11.9 range', () => {
    const all = MARTIN_HOPKINS_ROWS.flatMap((r) => r.factors);
    expect(Math.min(...all)).toBe(3.1);
    expect(Math.max(...all)).toBe(11.9);
  });

  it('looks up known cells by (non-HDL-C, TG)', () => {
    expect(martinHopkinsFactor(150, 150)).toBe(5.7); // non-HDL 130-159, TG 147-154
    expect(martinHopkinsFactor(90, 30)).toBe(3.5); // non-HDL <100, TG 7-49
    expect(martinHopkinsFactor(500, 220)).toBe(5.3); // non-HDL >=220, TG 202-220
    expect(martinHopkinsFactor(150, 97)).toBe(4.8); // the documented dip's row, non-HDL 130-159
    expect(martinHopkinsFactor(500, 97)).toBe(4.3); // the documented dip's own cell
  });

  it('returns undefined outside the table\'s triglyceride range', () => {
    expect(martinHopkinsFactor(150, 6)).toBeUndefined();
    expect(martinHopkinsFactor(150, 13976)).toBeUndefined();
    expect(martinHopkinsFactor(150, 7)).toBeDefined();
    expect(martinHopkinsFactor(150, 13975)).toBeDefined();
  });
});
