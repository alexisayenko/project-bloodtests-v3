import { describe, it, expect } from 'vitest';
import {
  compareAnalytes,
  sortAnalytes,
  sortedUnique,
  type AnalyteSortValues,
} from '../src/components/conditions/analyteSort';

function row(values: Partial<AnalyteSortValues> & { loinc: string }): AnalyteSortValues {
  return { name: undefined, specimen: undefined, unit: undefined, lastTested: undefined, ...values };
}

const order = (rows: AnalyteSortValues[], key: Parameters<typeof compareAnalytes>[2], direction: 'asc' | 'desc') =>
  sortAnalytes(rows, (r) => r, key, direction).map((r) => r.loinc);

describe('LOINC code order', () => {
  const codes = [row({ loinc: '14913-8' }), row({ loinc: '2986-8' }), row({ loinc: '718-7' }), row({ loinc: '1988-5' })];

  it('ranks the number before the hyphen numerically, not as a string', () => {
    expect(order(codes, 'loinc', 'asc')).toEqual(['718-7', '1988-5', '2986-8', '14913-8']);
  });

  it('reverses on descending', () => {
    expect(order(codes, 'loinc', 'desc')).toEqual(['14913-8', '2986-8', '1988-5', '718-7']);
  });

  it('falls back to the check digit when the numbers match', () => {
    expect(order([row({ loinc: '2345-9' }), row({ loinc: '2345-7' })], 'loinc', 'asc')).toEqual(['2345-7', '2345-9']);
  });
});

describe('empty cells', () => {
  const rows = [
    row({ loinc: '3-1', specimen: 'Urine' }),
    row({ loinc: '1-1' }),
    row({ loinc: '4-1', specimen: 'Blood' }),
    row({ loinc: '2-1' }),
  ];

  it('puts absent values last when ascending', () => {
    expect(order(rows, 'specimen', 'asc')).toEqual(['4-1', '3-1', '1-1', '2-1']);
  });

  it('keeps absent values last when descending', () => {
    expect(order(rows, 'specimen', 'desc')).toEqual(['3-1', '4-1', '1-1', '2-1']);
  });

  it('orders two absent values by LOINC, in both directions', () => {
    expect(order(rows, 'specimen', 'asc').slice(2)).toEqual(['1-1', '2-1']);
    expect(order(rows, 'specimen', 'desc').slice(2)).toEqual(['1-1', '2-1']);
  });

  it('treats an empty string as absent', () => {
    expect(order([row({ loinc: '1-1', unit: '' }), row({ loinc: '2-1', unit: 'g/L' })], 'unit', 'asc')).toEqual([
      '2-1',
      '1-1',
    ]);
  });
});

describe('text columns', () => {
  const rows = [
    row({ loinc: '10-1', name: 'Ferritin [Mass/volume] in Serum or Plasma', specimen: 'Serum or Plasma' }),
    row({ loinc: '2-1', name: 'Albumin [Mass/volume] in Serum or Plasma', specimen: 'Serum or Plasma' }),
    row({ loinc: '30-1', name: 'Hemoglobin [Mass/volume] in Blood', specimen: 'Blood' }),
  ];

  it('sorts alphabetically both ways', () => {
    expect(order(rows, 'name', 'asc')).toEqual(['2-1', '10-1', '30-1']);
    expect(order(rows, 'name', 'desc')).toEqual(['30-1', '10-1', '2-1']);
  });

  it('breaks ties by LOINC regardless of direction', () => {
    expect(order(rows, 'specimen', 'asc')).toEqual(['30-1', '2-1', '10-1']);
    expect(order(rows, 'specimen', 'desc')).toEqual(['2-1', '10-1', '30-1']);
  });

  it('leaves the input array untouched', () => {
    const input = [...rows];
    sortAnalytes(input, (r) => r, 'name', 'desc');
    expect(input.map((r) => r.loinc)).toEqual(['10-1', '2-1', '30-1']);
  });
});

describe('last tested', () => {
  it('ranks by ISO date, oldest first when ascending', () => {
    const rows = [
      row({ loinc: '1-1', lastTested: '2025-11-03' }),
      row({ loinc: '2-1', lastTested: '2026-02-10' }),
      row({ loinc: '3-1' }),
      row({ loinc: '4-1', lastTested: '2024-12-31' }),
    ];
    expect(order(rows, 'lastTested', 'asc')).toEqual(['4-1', '1-1', '2-1', '3-1']);
    expect(order(rows, 'lastTested', 'desc')).toEqual(['2-1', '1-1', '4-1', '3-1']);
  });
});

describe('compareAnalytes', () => {
  it('is zero only for the same row', () => {
    const a = row({ loinc: '1-1', unit: 'g/L' });
    expect(compareAnalytes(a, a, 'unit', 'asc')).toBe(0);
    expect(compareAnalytes(a, row({ loinc: '2-1', unit: 'g/L' }), 'unit', 'asc')).toBeLessThan(0);
  });

  it('ranks a present cell above an absent one, and two absent ones by LOINC, either way round', () => {
    const present = row({ loinc: '9-1', unit: 'g/L' });
    const absent = row({ loinc: '1-1' });
    const alsoAbsent = row({ loinc: '2-1' });
    for (const direction of ['asc', 'desc'] as const) {
      expect(compareAnalytes(present, absent, 'unit', direction)).toBe(-1);
      expect(compareAnalytes(absent, present, 'unit', direction)).toBe(1);
      expect(compareAnalytes(absent, alsoAbsent, 'unit', direction)).toBeLessThan(0);
      expect(compareAnalytes(alsoAbsent, absent, 'unit', direction)).toBeGreaterThan(0);
      expect(compareAnalytes(absent, absent, 'unit', direction)).toBe(0);
    }
  });
});

describe('sortedUnique', () => {
  it('is empty for no values', () => {
    expect(sortedUnique([])).toEqual([]);
  });

  it('drops duplicates and orders ISO dates chronologically', () => {
    expect(sortedUnique(['2026-09-08', '2025-01-15', '2026-09-08', '2025-12-01'])).toEqual([
      '2025-01-15',
      '2025-12-01',
      '2026-09-08',
    ]);
  });

  it('orders by code unit, as the default sort does, and leaves its input untouched', () => {
    const input = ['b', 'B', 'a', 'Z', '10', '9', 'é', 'e', 'a'];
    const before = [...input];
    expect(sortedUnique(input)).toEqual(['10', '9', 'B', 'Z', 'a', 'b', 'e', 'é']);
    expect(input).toEqual(before);
  });
});
