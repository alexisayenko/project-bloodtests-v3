import { describe, it, expect, vi } from 'vitest';
import {
  buildRowCells,
  cellBg,
  formatFullDate,
  formatMonthYear,
  greenRangeOf,
  isCellArmed,
  loadViewSettings,
  DEFAULT_VIEW_SETTINGS,
  displayedResult,
  popupPosition,
  pressable,
  sharedUnit,
  visibleDatesOf,
} from '../src/components/conditions/ui';
import { COLOR } from '../src/styles/tokens';
import { ALSO_REFS, SHORT_LABELS } from '../src/data/analyteCatalog';
import type { Observation } from '../src/components/conditions/markers';
import type { ResultEntry } from '../src/components/conditions/resultsLookup';
import type { Result } from '../src/types';
import { INDEX_DEFS } from '../src/data/indexDefs';

describe('date labels', () => {
  it('renders the column "Mon YY" and the full "Mon D, YYYY"', () => {
    expect(formatMonthYear('2026-08-25')).toBe('Aug 26');
    expect(formatMonthYear('2024-12-01')).toBe('Dec 24');
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
  it('no reference → transparent (selection tint when selected)', () => {
    expect(cellBg(false, false, false)).toBe('transparent');
    expect(cellBg(false, false, true)).toBe(COLOR.accentSoft);
  });

  it('in range → green family; out of range → red family', () => {
    expect(cellBg(true, false, false)).toBe(COLOR.statusOkBg);
    expect(cellBg(true, true, false)).toBe(COLOR.statusBadBg);
    expect(cellBg(true, false, true)).toBe(COLOR.statusOkBgSelected);
    expect(cellBg(true, true, true)).toBe(COLOR.statusBadBgSelected);
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

  it('keeps all dates, oldest first', () => {
    expect(visibleDatesOf(dates, 'all')).toEqual([...dates].reverse());
  });

  it('takes the most recent N, then runs them oldest to newest', () => {
    expect(visibleDatesOf(dates, 2)).toEqual(['2026-02-01', '2026-03-01']);
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

  it('keeps the right edge in the viewport for an element near it', () => {
    vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 800 });
    const p = popupPosition(rect({ left: 960, width: 40, top: 100, bottom: 130 }), 260);
    expect(p.left).toBe(1000 - 260 - 8);
    vi.unstubAllGlobals();
  });

  it('narrows a popup wider than the viewport instead of overflowing it', () => {
    vi.stubGlobal('window', { innerWidth: 375, innerHeight: 812 });
    const p = popupPosition(rect({ left: 20, width: 100, top: 100, bottom: 130 }), 380);
    expect(p.width).toBe(375 - 16);
    expect(p.left).toBe(8);
    expect(p.left + p.width).toBe(375 - 8);
    vi.unstubAllGlobals();
  });

  it('leaves a popup that already fits at its full width', () => {
    vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 800 });
    const p = popupPosition(rect({ left: 400, width: 100, top: 100, bottom: 130 }), 380);
    expect(p.width).toBe(380);
    expect(p.left).toBe(450 - 190);
    vi.unstubAllGlobals();
  });

  it('never returns a negative left, whatever the anchor', () => {
    vi.stubGlobal('window', { innerWidth: 320, innerHeight: 800 });
    for (const left of [0, 150, 310]) {
      const p = popupPosition(rect({ left, width: 10, top: 100, bottom: 130 }), 380);
      expect(p.left).toBeGreaterThanOrEqual(8);
      expect(p.left + p.width).toBeLessThanOrEqual(320 - 8);
    }
    vi.unstubAllGlobals();
  });
});

describe('loadViewSettings', () => {
  it('falls back to defaults when storage is unavailable', () => {
    // node environment: localStorage is undefined → the try/catch default path
    expect(loadViewSettings()).toEqual({ unitSystem: 'si', sampleLimit: 5 });
  });

  it('gives a first-time visitor every default, sampleLimit included', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    expect(loadViewSettings()).toEqual(DEFAULT_VIEW_SETTINGS);
    expect(loadViewSettings().sampleLimit).toBe(5);
    vi.unstubAllGlobals();
  });

  it('keeps a stored choice and fills only what is missing', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{"sampleLimit":"all"}', setItem: () => {} });
    expect(loadViewSettings()).toEqual({ ...DEFAULT_VIEW_SETTINGS, sampleLimit: 'all' });
    vi.unstubAllGlobals();
  });

  it('ignores the retired dateOrder field a pre-existing payload still carries', () => {
    vi.stubGlobal('localStorage', { getItem: () => '{"unitSystem":"us","sampleLimit":10,"dateOrder":"desc"}', setItem: () => {} });
    expect(loadViewSettings()).toEqual({ unitSystem: 'us', sampleLimit: 10 });
    vi.unstubAllGlobals();
  });

  it('never hands out the shared defaults object', () => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} });
    loadViewSettings().sampleLimit = 'all';
    expect(DEFAULT_VIEW_SETTINGS.sampleLimit).toBe(5);
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

  it('folds U with IU on an enzyme row, where the printed IU is a U', () => {
    // ALT is a catalytic activity, so "IU" is the 1964 enzyme unit = U.
    expect(sharedUnit(['U/L', 'IU/L'], 'U/L', '1742-6')).toBe('U/L');
    expect(sharedUnit(['Ед/л', 'МЕ/л'], 'U/L', '1742-6')).toBe('U/L');
  });

  it('folds U with IU on an arbitrary-unit row, where the printed U is an IU', () => {
    // Insulin, the owner's real case: nine draws printed µU/mL, five µIU/mL.
    // One row, one label — the catalog's own uIU/mL, since it is that unit.
    expect(sharedUnit(['µU/mL', 'µIU/mL', 'µU/mL'], 'uIU/mL', '20448-7')).toBe('uIU/mL');
    // With no catalog unit to prefer, the readings' own majority spelling names it.
    expect(sharedUnit(['µU/mL', 'µU/mL', 'µIU/mL'], undefined, '20448-7')).toBe('µU/mL');
    expect(sharedUnit(['U/L', 'IU/L'], 'IU/L', '15067-2')).toBe('IU/L');
  });

  it('folds them for no other analyte, and for none at all', () => {
    // Cholesterol is a mass concentration: nothing licenses the fold there.
    expect(sharedUnit(['U/L', 'IU/L'], 'U/L', '2093-3')).toBeUndefined();
    expect(sharedUnit(['µU/mL', 'µIU/mL'], 'uIU/mL', '2093-3')).toBeUndefined();
    expect(sharedUnit(['U/L', 'IU/L'], 'U/L')).toBeUndefined();
    expect(sharedUnit(['µU/mL', 'µIU/mL'], 'uIU/mL')).toBeUndefined();
  });

  it('still splits a genuine scale gap on a folding row', () => {
    expect(sharedUnit(['U/mL', 'µIU/mL'], 'uIU/mL', '20448-7')).toBeUndefined();
    expect(sharedUnit(['U/L', 'mIU/L'], 'U/L', '1742-6')).toBeUndefined();
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
