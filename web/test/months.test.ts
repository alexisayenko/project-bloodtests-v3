import { describe, it, expect } from 'vitest';
import {
  MONTH_LABELS,
  formatMonthFullYear,
  formatMonthYear,
  isMonthKey,
  monthKey,
  monthKeyOf,
} from '../src/data/months';

describe('month keys', () => {
  it('builds ISO YYYY-MM keys from a zero-based month', () => {
    expect(monthKey(2026, 0)).toBe('2026-01');
    expect(monthKey(2026, 11)).toBe('2026-12');
    expect(monthKeyOf(new Date(2027, 2, 31))).toBe('2027-03');
  });

  it('accepts only a well-formed calendar month', () => {
    expect(isMonthKey('2026-01')).toBe(true);
    expect(isMonthKey('2026-12')).toBe(true);
    for (const bad of ['2026-00', '2026-13', '2026-1', '26-01', '2026-01-05', '', 202601, null, undefined]) {
      expect(isMonthKey(bad)).toBe(false);
    }
  });
});

describe('month labels', () => {
  it('matches the en-US short month names', () => {
    const intl = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleDateString('en-US', { month: 'short' }));
    expect([...MONTH_LABELS]).toEqual(intl);
  });

  it('renders a date or month as "Mon YY"', () => {
    expect(formatMonthYear('2026-08-25')).toBe('Aug 26');
    expect(formatMonthYear('2024-12-01')).toBe('Dec 24');
    expect(formatMonthYear('2027-01')).toBe('Jan 27');
  });

  it('renders a month as "Mon YYYY"', () => {
    expect(formatMonthFullYear('2027-03')).toBe('Mar 2027');
    expect(formatMonthFullYear('2026-09-10')).toBe('Sep 2026');
  });
});
