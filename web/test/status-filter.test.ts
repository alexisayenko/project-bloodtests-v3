import { describe, it, expect } from 'vitest';
import {
  FILTER_TONES,
  countTones,
  filterByTone,
  isToneFilterActive,
  markerCountLabel,
  toggleTone,
  type Toned,
} from '../src/components/conditions/statusFilter';
import type { StatusTone } from '../src/components/primitives/tones';

const chips: Toned<string>[] = [
  { item: 'ALT', tone: 'ok' },
  { item: 'AST', tone: 'bad' },
  { item: 'GGT', tone: 'warn' },
  { item: 'ALP', tone: 'none' },
  { item: 'FIB-4', tone: 'ok' },
];

function subsets(): StatusTone[][] {
  return Array.from({ length: 1 << FILTER_TONES.length }, (_, mask) => FILTER_TONES.filter((_, i) => mask & (1 << i)));
}

describe('countTones', () => {
  it('counts every chip once per occurrence, zero for absent tones', () => {
    expect(countTones(['ok', 'ok', 'bad', 'warn', 'ok'])).toEqual({ ok: 3, warn: 1, bad: 1, none: 0 });
  });

  it('is all zeros for no chips', () => {
    expect(countTones([])).toEqual({ ok: 0, warn: 0, bad: 0, none: 0 });
  });
});

describe('toggleTone', () => {
  it('removes an active tone and adds an inactive one without mutating the input', () => {
    const active = new Set<StatusTone>(['ok', 'bad']);
    expect([...toggleTone(active, 'ok')]).toEqual(['bad']);
    expect(toggleTone(active, 'none').has('none')).toBe(true);
    expect([...active]).toEqual(['ok', 'bad']);
  });
});

describe('isToneFilterActive', () => {
  it('is false only when every status is on', () => {
    for (const subset of subsets()) {
      expect(isToneFilterActive(new Set(subset))).toBe(subset.length !== FILTER_TONES.length);
    }
  });
});

describe('filterByTone', () => {
  it('keeps exactly the chips of enabled statuses, in order, for every combination', () => {
    for (const subset of subsets()) {
      const active = new Set(subset);
      expect(filterByTone(chips, active)).toEqual(chips.filter((c) => subset.includes(c.tone)));
    }
  });

  it('borderline and out of range alone keep only those chips', () => {
    expect(filterByTone(chips, new Set<StatusTone>(['warn', 'bad'])).map((c) => c.item)).toEqual(['AST', 'GGT']);
  });

  it('visible chips across the enabled statuses sum to their counts', () => {
    const counts = countTones(chips.map((c) => c.tone));
    for (const subset of subsets()) {
      const visible = filterByTone(chips, new Set(subset)).length;
      expect(visible).toBe(subset.reduce((sum, tone) => sum + counts[tone], 0));
    }
  });
});

describe('markerCountLabel', () => {
  it('reads "N markers" unfiltered and "N of M markers" filtered', () => {
    expect(markerCountLabel(8, 8, false)).toBe('8 markers');
    expect(markerCountLabel(2, 8, true)).toBe('2 of 8 markers');
    expect(markerCountLabel(0, 8, true)).toBe('0 of 8 markers');
  });
});
