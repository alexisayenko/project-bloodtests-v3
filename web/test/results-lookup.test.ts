import { describe, it, expect } from 'vitest';
import { getLatest, getStatus, hasReference, latestEntryByLoinc, nearestEntryTo, type LatestByLoinc, type ResultEntry } from '../src/components/conditions/resultsLookup';
import type { Result } from '../src/types';
import { makeEntry, makeResult as result } from './helpers/fixtures';

describe('resultsLookup', () => {
  const latest: LatestByLoinc = {
    '14913-8': { result: result({ value: 17, refMin: 10, refMax: 30 }), date: '2026-01-01' },
    '2986-8': { result: result({ value: 5, refMin: 3, refMax: 9 }), date: '2026-06-01' },
    '718-7': { result: result({ value: 20, refMin: 13, refMax: 17 }), date: '2025-01-01' },
    '1992-7': { result: result({ value: 2 }), date: '2025-01-01' },
  };

  it('getLatest picks the newest across a badge and its aliases', () => {
    expect(getLatest(latest, ['14913-8', '2986-8'])!.date).toBe('2026-06-01');
  });

  it('getStatus: never / in-range / out-of-range / unknown', () => {
    expect(getStatus(latest, ['nope'])).toBe('never');
    expect(getStatus(latest, ['14913-8'])).toBe('in-range');
    expect(getStatus(latest, ['718-7'])).toBe('out-of-range');
    expect(getStatus(latest, ['1992-7'])).toBe('unknown');
  });

  it('hasReference needs a value plus at least one bound', () => {
    expect(hasReference(result({ value: 1, refMin: 0 }))).toBe(true);
    expect(hasReference(result({ value: 1 }))).toBe(false);
    expect(hasReference(result({ refMin: 0 }))).toBe(false);
  });
});

const entry = (loinc: string, date: string, partial: Partial<Result>): ResultEntry => makeEntry({ loinc, date, place: 'lab', result: partial });

describe('latestEntryByLoinc', () => {
  const entries: ResultEntry[] = [
    entry('5778-6', '2026-01-01', { value: 1 }),
    entry('5778-6', '2026-03-01', { rawValue: 'negative' }),
    entry('5778-6', '2026-05-01', {}),
    entry('718-7', '2026-02-01', { value: 140 }),
    entry('718-7', '2026-02-01', { value: 150 }),
    entry('718-7', '2025-01-01', { value: 130 }),
    entry('2345-7', '2026-04-01', { rawValue: 'hemolyzed' }),
  ];

  it('numericOnly off: a text-only result counts, a blank draw never does', () => {
    const map = latestEntryByLoinc(entries, { numericOnly: false });
    expect(map['5778-6']!.date).toBe('2026-03-01');
    expect(map['2345-7']!.result.rawValue).toBe('hemolyzed');
    expect(latestEntryByLoinc(entries)).toEqual(map);
  });

  it('numericOnly on: only a numeric value counts', () => {
    const map = latestEntryByLoinc(entries, { numericOnly: true });
    expect(map['5778-6']!.date).toBe('2026-01-01');
    expect(map['2345-7']).toBeUndefined();
  });

  it('keeps the first entry on a date tie and ignores older ones, in both modes', () => {
    for (const numericOnly of [true, false]) {
      expect(latestEntryByLoinc(entries, { numericOnly })['718-7']!.result.value).toBe(140);
    }
  });
});

describe('nearestEntryTo', () => {
  const ALB = ['1751-7', '61151-7'];
  const nearest = (entries: ResultEntry[], date: string) => nearestEntryTo(entries, ALB, date, { numericOnly: true });

  it('finds a reading before the date when only earlier ones exist', () => {
    const entries = [entry('1751-7', '2025-01-01', { value: 1 }), entry('1751-7', '2025-06-01', { value: 2 })];
    expect(nearest(entries, '2026-01-01')!.date).toBe('2025-06-01');
  });

  it('finds a reading after the date when only later ones exist', () => {
    const entries = [entry('1751-7', '2027-01-01', { value: 1 }), entry('61151-7', '2026-03-01', { value: 2 })];
    expect(nearest(entries, '2026-01-01')!.date).toBe('2026-03-01');
  });

  it('picks the closer side when readings exist on both', () => {
    const entries = [entry('1751-7', '2025-10-01', { value: 1 }), entry('1751-7', '2026-02-01', { value: 2 })];
    expect(nearest(entries, '2026-01-01')!.date).toBe('2026-02-01');
  });

  it('breaks an equal distance toward the earlier reading, whatever the input order', () => {
    const later = entry('1751-7', '2026-01-11', { value: 2 });
    const earlier = entry('1751-7', '2025-12-22', { value: 1 });
    expect(nearest([later, earlier], '2026-01-01')!.date).toBe('2025-12-22');
    expect(nearest([earlier, later], '2026-01-01')!.date).toBe('2025-12-22');
  });

  it('excludes the selected date itself, other codes and blank or text-only draws', () => {
    const entries = [
      entry('1751-7', '2026-01-01', { value: 1 }),
      entry('718-7', '2026-01-02', { value: 140 }),
      entry('1751-7', '2026-01-03', { rawValue: 'hemolyzed' }),
      entry('1751-7', '2026-01-04', {}),
      entry('1751-7', '2026-03-01', { value: 2 }),
    ];
    expect(nearest(entries, '2026-01-01')!.date).toBe('2026-03-01');
    expect(nearestEntryTo(entries, ALB, '2026-01-01')!.date).toBe('2026-01-03');
  });

  it('returns null when nothing qualifies', () => {
    expect(nearest([], '2026-01-01')).toBeNull();
    expect(nearest([entry('1751-7', '2026-01-01', { value: 1 })], '2026-01-01')).toBeNull();
  });
});
