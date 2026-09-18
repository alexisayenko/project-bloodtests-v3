import { describe, it, expect } from 'vitest';
import {
  buildRowCells,
  cellBg,
  greenRangeOf,
  isCellArmed,
  mostCommon,
  namedLab,
  displayedResult,
  sharedUnit,
  visibleDatesOf,
} from '../src/components/conditions/resultCells';
import { COLOR } from '../src/styles/tokens';
import { ALSO_REFS, SHORT_NAMES } from '../src/data/analyteCatalog';
import type { Observation } from '../src/components/conditions/markers';
import type { ResultEntry } from '../src/components/conditions/resultsLookup';
import type { Result } from '../src/types';
import { INDEX_DEFS } from '../src/data/indexDefs';
import { makeEntry, makeObservation } from './helpers/fixtures';

describe('greenRangeOf', () => {
  it('lower-is-better indices get "< cut0"', () => {
    const homair = INDEX_DEFS.find((d) => d.key === 'homair')!;
    expect(greenRangeOf(homair)).toBe('< 2');
  });

  it('higher-is-better indices get "> cut0" with the unit appended', () => {
    const cft = INDEX_DEFS.find((d) => d.key === 'cft')!;
    expect(greenRangeOf(cft)).toBe('> 100 pg/mL');
  });

  it('a sex-dependent index names both bands without a profile, and only the subject\'s with one', () => {
    const biot = INDEX_DEFS.find((d) => d.key === 'biot')!;
    expect(greenRangeOf(biot)).toBe('men > 2.88 nmol/L · women < 0.139 nmol/L');
    expect(greenRangeOf(biot, { sex: 'male' })).toBe('> 2.88 nmol/L');
    expect(greenRangeOf(biot, { sex: 'female' })).toBe('< 0.139 nmol/L');
    expect(greenRangeOf(biot, {})).toBe('depends on sex, not set');
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

/**
 * A unit-variant alias folds into its primary's row (VLDL-C's molar 25371-6
 * into mass 13458-5's), which is what the row model is for -- but the UNIT
 * LABEL has to keep following the reading, not the row. Pairing a printed
 * value with another code's unit is the mislabel ADR-0003 forbids: 0.98
 * ммоль/л must never read "0.98, mg/dL".
 */
function obs(loinc: string): Observation {
  return makeObservation({
    shortName: SHORT_NAMES[loinc]?.shortName ?? loinc,
    friendlyName: loinc,
    loinc,
    unit: SHORT_NAMES[loinc]?.unit,
    also: ALSO_REFS[loinc],
  });
}

function reading(loinc: string, value: number, unit: string): Pick<Result, 'loinc' | 'value' | 'rawValue' | 'unit'> {
  return { loinc, value, rawValue: String(value), unit };
}

function entry(loinc: string, date: string, value: number, unit: string): ResultEntry {
  return makeEntry({ loinc, date, result: { value, unit } });
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

describe('mostCommon', () => {
  it('names none for no readings', () => {
    expect(mostCommon([])).toBeUndefined();
  });

  it('is the only spelling when there is one', () => {
    expect(mostCommon(['mIU/L'])).toBe('mIU/L');
  });

  it('picks the majority spelling, wherever it first appears', () => {
    expect(mostCommon(['uIU/mL', 'mIU/L', 'mIU/L'])).toBe('mIU/L');
    expect(mostCommon(['ug/L', 'ng/mL', 'ug/L', 'ng/mL', 'ng/mL'])).toBe('ng/mL');
  });

  it('breaks a tie toward the earliest column', () => {
    expect(mostCommon(['uIU/mL', 'mIU/L'])).toBe('uIU/mL');
    expect(mostCommon(['mIU/L', 'uIU/mL', 'uIU/mL', 'mIU/L'])).toBe('mIU/L');
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

describe('namedLab', () => {
  it('trims a named lab and names nothing for an empty field, a placeholder or "Unknown Lab"', () => {
    expect(namedLab(' NeoGenesis ')).toBe('NeoGenesis');
    for (const place of ['', ' — ', '?', 'Unknown Lab']) expect(namedLab(place)).toBeUndefined();
  });
});
