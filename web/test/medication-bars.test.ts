import { describe, it, expect } from 'vitest';
import { buildMedicationBars } from '../src/components/conditions/medicationBars';
import type { MedicationRow } from '../src/data/medications';

function row(overrides: Partial<MedicationRow>): MedicationRow {
  return { id: 'r', brand: 'Metformin', compounds: [], notes: '', months: [], ...overrides };
}

const colorOf = (i: number) => `color-${i}`;

describe('buildMedicationBars', () => {
  it('spans one contiguous run of months as a single bar', () => {
    const bars = buildMedicationBars([row({ months: ['2024-01', '2024-02', '2024-03'] })], colorOf);
    expect(bars).toHaveLength(1);
    expect(bars[0]!.id).toBe('r:0');
    expect(bars[0]!.brand).toBe('Metformin');
    expect(bars[0]!.color).toBe('color-0');
    expect(new Date(bars[0]!.startTs * 1000).toISOString()).toBe('2024-01-01T00:00:00.000Z');
    // end is exclusive -- the start of the month AFTER the last taken one
    expect(new Date(bars[0]!.endTs * 1000).toISOString()).toBe('2024-04-01T00:00:00.000Z');
  });

  it('splits a gap in taken months into separate bars', () => {
    const bars = buildMedicationBars([row({ months: ['2024-01', '2024-02', '2024-06'] })], colorOf);
    expect(bars).toHaveLength(2);
    expect(new Date(bars[0]!.startTs * 1000).toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(new Date(bars[0]!.endTs * 1000).toISOString()).toBe('2024-03-01T00:00:00.000Z');
    expect(new Date(bars[1]!.startTs * 1000).toISOString()).toBe('2024-06-01T00:00:00.000Z');
    expect(new Date(bars[1]!.endTs * 1000).toISOString()).toBe('2024-07-01T00:00:00.000Z');
  });

  it('spans a year boundary as one contiguous run', () => {
    const bars = buildMedicationBars([row({ months: ['2023-12', '2024-01'] })], colorOf);
    expect(bars).toHaveLength(1);
    expect(new Date(bars[0]!.startTs * 1000).toISOString()).toBe('2023-12-01T00:00:00.000Z');
    expect(new Date(bars[0]!.endTs * 1000).toISOString()).toBe('2024-02-01T00:00:00.000Z');
  });

  it('joins compound name+dose pairs into the detail string', () => {
    const bars = buildMedicationBars(
      [row({ months: ['2024-01'], compounds: [{ name: 'valsartan', dose: '80mg' }, { name: 'amlodipine', dose: '5mg' }] })],
      colorOf
    );
    expect(bars[0]!.detail).toBe('valsartan 80mg, amlodipine 5mg');
  });

  it('drops rows with no name or no taken months, and never spends a color slot on them', () => {
    const bars = buildMedicationBars(
      [
        row({ id: 'a', brand: '  ', months: ['2024-01'] }),
        row({ id: 'b', brand: 'Metformin', months: [] }),
        row({ id: 'c', brand: 'Vitamin D', months: ['2024-01'] }),
      ],
      colorOf
    );
    expect(bars).toHaveLength(1);
    expect(bars[0]!.brand).toBe('Vitamin D');
    expect(bars[0]!.color).toBe('color-0');
  });

  it('assigns colors by position among rows that actually produce a bar', () => {
    const bars = buildMedicationBars(
      [row({ id: 'a', brand: 'A', months: ['2024-01'] }), row({ id: 'b', brand: 'B', months: ['2024-02'] })],
      colorOf
    );
    expect(bars.map((b) => b.color)).toEqual(['color-0', 'color-1']);
  });

  it('sorts unordered months before deriving runs', () => {
    const bars = buildMedicationBars([row({ months: ['2024-03', '2024-01', '2024-02'] })], colorOf);
    expect(bars).toHaveLength(1);
    expect(new Date(bars[0]!.startTs * 1000).toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(new Date(bars[0]!.endTs * 1000).toISOString()).toBe('2024-04-01T00:00:00.000Z');
  });
});
