import { describe, it, expect } from 'vitest';
import { parseUploadedResults, UploadParseError } from '../src/data/parseUpload';

describe('parseUploadedResults — flat entries', () => {
  it('groups rows into sessions by (date, place), newest first', () => {
    const groups = parseUploadedResults([
      { date: '2026-01-10', place: 'Lab A', loinc: '718-7', value: 14.2, unit: 'g/dL' },
      { date: '2026-01-10', place: 'Lab A', loinc: '2339-0', value: 95, unit: 'mg/dL' },
      { date: '2025-06-01', place: 'Lab B', loinc: '718-7', value: 13.9, unit: 'g/dL' },
    ]);
    expect(groups.map((g) => g.file)).toEqual(['2026-01-10__lab-a', '2025-06-01__lab-b']);
    expect(groups[0]!.itemCount).toBe(2);
    expect(groups[1]!.items[0]!.value).toBe(13.9);
  });

  it('defaults a missing place and skips undated rows', () => {
    const groups = parseUploadedResults([
      { date: '2026-01-10', loinc: '718-7', value: 14 },
      { loinc: '2339-0', value: 95, date: '' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.place).toBe('Unknown Lab');
  });

  it('coerces numeric strings and keeps rawValue', () => {
    const [g] = parseUploadedResults([
      { date: '2026-01-10', loinc: '718-7', value: '14.2', rawValue: '<14.2', refMin: '13', refMax: '17' },
    ]);
    expect(g!.items[0]).toMatchObject({ value: 14.2, rawValue: '<14.2', refMin: 13, refMax: 17 });
  });
});

describe('parseUploadedResults — grouped sessions', () => {
  it('uses sessions as-is, sorted newest first', () => {
    const groups = parseUploadedResults([
      { date: '2025-01-01', place: 'A', items: [{ loinc: '718-7', value: 14 }] },
      { date: '2026-01-01', place: 'B', items: [] },
    ]);
    expect(groups.map((g) => g.date)).toEqual(['2026-01-01', '2025-01-01']);
    expect(groups[1]!.items[0]!.loinc).toBe('718-7');
  });

  it('slugifies the place into a stable session id', () => {
    const [g] = parseUploadedResults([{ date: '2026-01-01', place: 'Клиника / Downtown №3', items: [] }]);
    expect(g!.file).toBe('2026-01-01__downtown-3');
  });
});

describe('parseUploadedResults — rejects', () => {
  it('empty array', () => {
    expect(() => parseUploadedResults([])).toThrow(UploadParseError);
  });

  it('unrecognized shape', () => {
    expect(() => parseUploadedResults([{ foo: 'bar' }])).toThrow(UploadParseError);
  });

  it('entries with no usable dates', () => {
    expect(() => parseUploadedResults([{ date: null, loinc: '718-7' }])).toThrow(UploadParseError);
  });
});
