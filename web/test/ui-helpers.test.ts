import { describe, it, expect, vi } from 'vitest';
import {
  buildRowCells,
  cellBg,
  formatFullDate,
  formatMonthYear,
  greenRangeOf,
  isCellArmed,
  loadAnalysisSettings,
  DEFAULT_ANALYSIS_SETTINGS,
  displayedResult,
  popupPosition,
  pressable,
  sharedUnit,
  visibleDatesOf,
} from '../src/components/conditions/ui';
import { ALSO_REFS, SHORT_LABELS } from '../src/data/analyteCatalog';
import type { Observation } from '../src/components/conditions/markers';
import type { ResultEntry } from '../src/components/conditions/resultsLookup';
import type { Result } from '../src/types';
import { INDEX_DEFS } from '../src/data/indexDefs';

describe('formatMonthYear', () => {
  it('renders "Mon YY"', () => {
    expect(formatMonthYear('2026-08-25')).toBe('Aug 26');
    expect(formatMonthYear('2024-12-01')).toBe('Dec 24');
  });
});

describe('formatFullDate', () => {
  it('renders "Mon D, YYYY"', () => {
    expect(formatFullDate('2026-08-25')).toBe('Aug 25, 2026');
    expect(formatFullDate('2024-12-01')).toBe('Dec 1, 2024');
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

describe('isCellArmed (two-step click-to-select-then-open)', () => {
  it('is false when nothing is selected', () => {
    expect(isCellArmed(null, '14913-8', '2026-01-01')).toBe(false);
  });

  it('is true only for the exact (loinc, date) that is selected', () => {
    const cell = { loinc: '14913-8', date: '2026-01-01' };
    expect(isCellArmed(cell, '14913-8', '2026-01-01')).toBe(true);
    expect(isCellArmed(cell, '14913-8', '2025-06-01')).toBe(false);
    expect(isCellArmed(cell, '2991-8', '2026-01-01')).toBe(false);
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
    expect(loadAnalysisSettings()).toEqual({ unitSystem: 'si', sampleLimit: 5, dateOrder: 'asc' });
  });

  it('gives a first-time visitor every default, sampleLimit included', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    expect(loadAnalysisSettings()).toEqual(DEFAULT_ANALYSIS_SETTINGS);
    expect(loadAnalysisSettings().sampleLimit).toBe(5);
    vi.unstubAllGlobals();
  });

  it('keeps a stored choice and fills only what is missing', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{"sampleLimit":"all"}', setItem: () => {} });
    expect(loadAnalysisSettings()).toEqual({ ...DEFAULT_ANALYSIS_SETTINGS, sampleLimit: 'all' });
    vi.unstubAllGlobals();
  });

  it('never hands out the shared defaults object', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    loadAnalysisSettings().sampleLimit = 'all';
    expect(DEFAULT_ANALYSIS_SETTINGS.sampleLimit).toBe(5);
    vi.unstubAllGlobals();
  });
});

/**
 * A unit-variant alias folds into its primary's row (VLDL-C's molar 25371-6
 * into mass 13458-5's), which is what the row model is for -- but the UNIT
 * LABEL has to keep following the reading, not the row. Pairing a printed
 * value with another code's unit is the mislabel ADR-0003 forbids: 0.98
 * ммоль/л must never read "0.98, mg/dL".
 */
function obs(loinc: string): Observation {
  return {
    short: SHORT_LABELS[loinc]?.short ?? loinc,
    full: loinc,
    longCommonName: '',
    loinc,
    unit: SHORT_LABELS[loinc]?.unit,
    also: ALSO_REFS[loinc],
  };
}

function reading(loinc: string, value: number, unit: string): Pick<Result, 'loinc' | 'value' | 'rawValue' | 'unit'> {
  return { loinc, value, rawValue: String(value), unit };
}

function entry(loinc: string, date: string, value: number, unit: string): ResultEntry {
  return {
    loinc,
    date,
    place: 'Lab',
    result: {
      loinc, analysis: '', symbol: '', section: '', value, rawValue: String(value), valueQualifier: '',
      unit, refText: '', refMin: null, refMax: null, method: '',
    },
  };
}

describe('displayedResult', () => {
  it('labels a molar alias reading with its own unit, not the mass primary\'s', () => {
    // VLDL-C: no SI/US conversion exists, so nothing may change the number.
    expect(displayedResult(undefined, reading('25371-6', 0.98, 'ммоль/л'), 'si')).toEqual({
      value: 0.98,
      rawValue: '0.98',
      unit: 'mmol/L',
      converted: false,
    });
  });

  it('falls back to the reading\'s OWN code unit when the lab printed none', () => {
    expect(displayedResult(undefined, reading('14933-6', 310, ''), 'us').unit).toBe('umol/L');
    expect(displayedResult(undefined, reading('3084-1', 5.2, ''), 'us').unit).toBe('mg/dL');
  });

  it('moves number and label together when a verified conversion applies', () => {
    const us = displayedResult('TC', reading('14647-2', 5.2, 'ммоль/л'), 'us');
    expect(us.unit).toBe('mg/dL');
    expect(us.value).toBeCloseTo(5.2 * 38.6664, 2);
    expect(us.converted).toBe(true);

    const si = displayedResult('TC', reading('2093-3', 200, 'mg/dL'), 'si');
    expect(si.unit).toBe('mmol/L');
    expect(si.value).toBeCloseTo(200 / 38.6664, 4);
  });

  it('keeps the printed unit when the SI/US target is unreachable', () => {
    // No TC rule for g/L: relabelling to mg/dL here would be the same mislabel.
    expect(displayedResult('TC', reading('2093-3', 2, 'g/L'), 'us')).toMatchObject({ value: 2, unit: 'g/L', converted: false });
  });
});

describe('sharedUnit', () => {
  it('is the common unit, or undefined when they disagree or there are none', () => {
    expect(sharedUnit(['mmol/L', 'mmol/L'])).toBe('mmol/L');
    expect(sharedUnit(['mg/dL', 'umol/L'])).toBeUndefined();
    expect(sharedUnit([])).toBeUndefined();
  });

  it('treats two spellings of the SAME unit as one scale', () => {
    // uIU/mL = 1e-6 IU / 1e-3 L = mIU/L exactly: one label, no conversion.
    expect(sharedUnit(['uIU/mL', 'mIU/L', 'mIU/L'], 'mIU/L')).toBe('mIU/L');
    expect(sharedUnit(['mg/L', 'ug/mL'])).toBe('mg/L');
    expect(sharedUnit(['ng/mL', 'ug/L', 'ug/L'])).toBe('ug/L');
  });

  it('still splits when the scales genuinely differ', () => {
    expect(sharedUnit(['mg/dL', 'mmol/L'], 'mmol/L')).toBeUndefined();
    expect(sharedUnit(['ug/dL', 'nmol/L'], 'nmol/L')).toBeUndefined();
    expect(sharedUnit(['ug/L', 'ug/dL'])).toBeUndefined();
  });

  it('never unifies on a unit it cannot read, and ignores an unrelated preferred', () => {
    expect(sharedUnit(['wibble', 'mIU/L'], 'mIU/L')).toBeUndefined();
    // An unrelated preferred unit can't name the row: the readings' own
    // majority spelling does (ties to the earliest column).
    expect(sharedUnit(['uIU/mL', 'mIU/L'], 'mg/dL')).toBe('uIU/mL');
  });
});

describe('buildRowCells', () => {
  const dates = ['2026-05-07'];

  it('labels the row from the reading, not the alias group primary', () => {
    const row = buildRowCells(obs('13458-5'), dates, [entry('25371-6', '2026-05-07', 0.98, 'ммоль/л')], 'si');
    expect(row.rowUnit).toBe('mmol/L');
    expect(row.showCellUnits).toBe(false);
    expect(row.cells[0]!.display).toMatchObject({ value: 0.98, unit: 'mmol/L' });
  });

  it('drops the row label and labels each cell when readings sit on two scales', () => {
    const row = buildRowCells(
      obs('3084-1'),
      ['2024-01-01', '2026-05-07'],
      [entry('3084-1', '2024-01-01', 5.2, 'mg/dL'), entry('14933-6', '2026-05-07', 310, 'мкмоль/л')],
      'si'
    );
    expect(row.rowUnit).toBeUndefined();
    expect(row.showCellUnits).toBe(true);
    expect(row.cells.map((c) => c.display?.unit)).toEqual(['mg/dL', 'umol/L']);
  });

  it('keeps one label, and every number as printed, when two spellings are one unit', () => {
    // The real TSH history: one lab printed uIU/mL, the next mIU/L. Same unit.
    const row = buildRowCells(
      obs('11580-8'),
      ['2023-02-01', '2024-01-01', '2026-05-07'],
      [
        entry('11580-8', '2023-02-01', 2.72, 'uIU/mL'),
        entry('11580-8', '2024-01-01', 1.999, 'mIU/L'),
        entry('11580-8', '2026-05-07', 4.266, 'мМЕ/л'),
      ],
      'si'
    );
    expect(row.rowUnit).toBe('mIU/L');
    expect(row.showCellUnits).toBe(false);
    expect(row.cells.map((c) => c.display?.value)).toEqual([2.72, 1.999, 4.266]);
  });

  it('still splits magnesium, whose mg/dL and mmol/L readings are two scales', () => {
    const row = buildRowCells(
      obs('19123-9'),
      ['2024-01-01', '2026-05-07'],
      [entry('19123-9', '2024-01-01', 2.1, 'mg/dL'), entry('2601-3', '2026-05-07', 0.86, 'ммоль/л')],
      'si'
    );
    expect(row.rowUnit).toBeUndefined();
    expect(row.showCellUnits).toBe(true);
    expect(row.cells.map((c) => c.display?.unit)).toEqual(['mg/dL', 'mmol/L']);
    expect(row.cells.map((c) => c.display?.value)).toEqual([2.1, 0.86]);
  });

  it('converts a whole SI/US row to one unit, alias readings included', () => {
    const row = buildRowCells(
      obs('2093-3'),
      ['2024-01-01', '2026-05-07'],
      [entry('2093-3', '2024-01-01', 200, 'mg/dL'), entry('14647-2', '2026-05-07', 5.2, 'ммоль/л')],
      'us'
    );
    expect(row.rowUnit).toBe('mg/dL');
    expect(row.showCellUnits).toBe(false);
    expect(row.cells[1]!.display!.value).toBeCloseTo(5.2 * 38.6664, 2);
  });

  it('falls back to the row\'s own unit when it has no readings at all', () => {
    expect(buildRowCells(obs('13458-5'), dates, [], 'si').rowUnit).toBe('mg/dL');
    expect(buildRowCells(obs('2093-3'), dates, [], 'si').rowUnit).toBe('mmol/L');
  });
});
