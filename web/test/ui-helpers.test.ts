import { describe, it, expect, vi } from 'vitest';
import {
  cellBg,
  formatMonthYear,
  greenRangeOf,
  loadAnalysisSettings,
  popupPosition,
  pressable,
  visibleDatesOf,
} from '../src/components/conditions/ui';
import { INDEX_DEFS } from '../src/data/computedIndices';

describe('formatMonthYear', () => {
  it('renders "Mon YY"', () => {
    expect(formatMonthYear('2026-08-25')).toBe('Aug 26');
    expect(formatMonthYear('2024-12-01')).toBe('Dec 24');
  });
});

describe('greenRangeOf', () => {
  it('lower-is-better indices get "< cut0"', () => {
    const homair = INDEX_DEFS.find((d) => d.key === 'homair')!;
    expect(greenRangeOf(homair)).toBe('< 2');
  });

  it('higher-is-better indices get "> cut0" with the unit appended', () => {
    const cft = INDEX_DEFS.find((d) => d.key === 'cft')!;
    expect(greenRangeOf(cft)).toBe('> 100 pg/mL');
  });
});

describe('cellBg', () => {
  it('no reference → transparent (selection blue when selected)', () => {
    expect(cellBg(false, false, false)).toBe('transparent');
    expect(cellBg(false, false, true)).toBe('#eaf3fb');
  });

  it('in range → green family; out of range → red family', () => {
    expect(cellBg(true, false, false)).toBe('#e6f4ea');
    expect(cellBg(true, true, false)).toBe('#fdecea');
    expect(cellBg(true, false, true)).toBe('#dbecf0');
    expect(cellBg(true, true, true)).toBe('#e6e8f0');
  });
});

describe('visibleDatesOf', () => {
  const dates = ['2026-03-01', '2026-02-01', '2026-01-01'];

  it('keeps all dates newest-first by default', () => {
    expect(visibleDatesOf(dates, 'all', 'desc')).toEqual(dates);
  });

  it('applies the sampling limit before ordering', () => {
    expect(visibleDatesOf(dates, 2, 'desc')).toEqual(['2026-03-01', '2026-02-01']);
    expect(visibleDatesOf(dates, 2, 'asc')).toEqual(['2026-02-01', '2026-03-01']);
  });
});

describe('pressable', () => {
  it('wires click and keyboard activation to the same handler', () => {
    const handler = vi.fn();
    const props = pressable(handler);
    expect(props.role).toBe('button');
    expect(props.tabIndex).toBe(0);

    const el = {} as HTMLElement;
    props.onClick({ currentTarget: el });
    props.onKeyDown({ key: 'Enter', preventDefault: vi.fn(), currentTarget: el });
    props.onKeyDown({ key: ' ', preventDefault: vi.fn(), currentTarget: el });
    expect(handler).toHaveBeenCalledTimes(3);
  });

  it('ignores other keys', () => {
    const handler = vi.fn();
    pressable(handler).onKeyDown({ key: 'Escape', preventDefault: vi.fn(), currentTarget: {} as HTMLElement });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('popupPosition', () => {
  const rect = (partial: Partial<DOMRect>): DOMRect => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}), ...partial });

  it('anchors below the element when there is room', () => {
    vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 800 });
    const p = popupPosition(rect({ left: 400, width: 100, top: 100, bottom: 130 }), 260);
    expect(p.top).toBe(138);
    expect(p.bottom).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('flips above when the element is near the bottom', () => {
    vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 800 });
    const p = popupPosition(rect({ left: 400, width: 100, top: 700, bottom: 730 }), 260);
    expect(p.bottom).toBe(800 - 700 + 8);
    expect(p.top).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('clamps the left edge into the viewport', () => {
    vi.stubGlobal('window', { innerWidth: 300, innerHeight: 800 });
    const p = popupPosition(rect({ left: 0, width: 10, top: 10, bottom: 30 }), 260);
    expect(p.left).toBe(8);
    vi.unstubAllGlobals();
  });
});

describe('loadAnalysisSettings', () => {
  it('falls back to defaults when storage is unavailable', () => {
    // node environment: localStorage is undefined → the try/catch default path
    expect(loadAnalysisSettings()).toEqual({ unitSystem: 'si', sampleLimit: 'all', dateOrder: 'desc' });
  });
});
