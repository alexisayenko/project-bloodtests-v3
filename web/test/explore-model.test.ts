import { describe, it, expect } from 'vitest';
import { buildExploreModel, type Condition } from '../src/components/conditions/exploreModel';
import { toUnit } from '../src/data/computedIndices';
import type { Observation } from '../src/components/conditions/markers';
import type { ResultEntry } from '../src/components/conditions/resultsLookup';
import type { Result } from '../src/types';

function obs(loinc: string, short: string, unit?: string): Observation {
  return { short, full: short, longCommonName: '', loinc, unit };
}

function entry(loinc: string, date: string, value: number | null, overrides: Partial<Result> = {}): ResultEntry {
  const result: Result = {
    loinc,
    analysis: '',
    symbol: '',
    section: '',
    value,
    rawValue: value == null ? '' : String(value),
    valueQualifier: '',
    unit: '',
    refText: '',
    refMin: null,
    refMax: null,
    method: '',
    ...overrides,
  };
  return { loinc, date, place: 'Lab', result };
}

describe('buildExploreModel — plottable two-sided-range markers', () => {
  it('plots a marker with >=1 reading, an upper bound and a non-degenerate range', () => {
    const test = obs('MARK1', 'M1', 'u');
    const conditions: Condition[] = [{ name: 'PanelA', tests: [test] }];
    const allResults = [
      entry('MARK1', '2024-06-01', 12, { unit: 'u', refMin: 5, refMax: 15 }),
      entry('MARK1', '2024-01-01', 10, { unit: 'u', refMin: 5, refMax: 15 }),
    ];
    const model = buildExploreModel(conditions, allResults, 'si', 'PanelA');
    expect(model.markers['MARK1']).toEqual({
      label: 'M1',
      unit: 'u',
      refMin: 5,
      refMax: 15,
      panel: 'PanelA',
      data: [
        ['2024-01-01', 10],
        ['2024-06-01', 12],
      ],
      warn: false,
    });
  });

  it('floors refMin at 0 for an upper-limit-only marker (no printed lower bound)', () => {
    const test = obs('UPPERONLY', 'UO');
    const allResults = [entry('UPPERONLY', '2024-01-01', 8, { refMax: 20 })];
    const model = buildExploreModel([{ name: 'PanelA', tests: [test] }], allResults, 'si', 'PanelA');
    expect(model.markers['UPPERONLY']).toMatchObject({ refMin: 0, refMax: 20 });
  });

  it('uses the most recently dated reading that reports a reference range', () => {
    const test = obs('REVISED', 'RV');
    const allResults = [
      entry('REVISED', '2023-01-01', 1, { refMin: 0, refMax: 10 }),
      entry('REVISED', '2025-01-01', 2, { refMin: 0, refMax: 20 }), // lab revised the printed range
    ];
    const model = buildExploreModel([{ name: 'PanelA', tests: [test] }], allResults, 'si', 'PanelA');
    expect(model.markers['REVISED']).toMatchObject({ refMax: 20 });
  });
});

describe('buildExploreModel — not taken', () => {
  it('lists a test with zero result rows as notTaken, unselectable and unplotted', () => {
    const test = obs('NEVER', 'Never Taken');
    const model = buildExploreModel([{ name: 'PanelA', tests: [test] }], [], 'si', 'PanelA');
    expect(model.notTaken).toEqual([{ key: 'NEVER', label: 'Never Taken', panel: 'PanelA' }]);
    expect(model.markers['NEVER']).toBeUndefined();
  });

  it('does not list a test with only null-valued rows as taken', () => {
    const test = obs('NULLED', 'Nulled');
    const allResults = [entry('NULLED', '2024-01-01', null, { refMin: 0, refMax: 10 })];
    const model = buildExploreModel([{ name: 'PanelA', tests: [test] }], allResults, 'si', 'PanelA');
    expect(model.notTaken.map((n) => n.key)).toContain('NULLED');
  });
});

describe('buildExploreModel — excluded (has data, ineligible to plot)', () => {
  it('excludes a lower-bound-only marker entirely (would read inverted)', () => {
    const test = obs('LOWONLY', 'Lower Only');
    const allResults = [entry('LOWONLY', '2024-01-01', 50, { refMin: 20, refMax: null })];
    const model = buildExploreModel([{ name: 'PanelA', tests: [test] }], allResults, 'si', 'PanelA');
    expect(model.markers['LOWONLY']).toBeUndefined();
    expect(model.notTaken.map((n) => n.key)).not.toContain('LOWONLY');
  });

  it('excludes a marker with no reference range at all', () => {
    const test = obs('NOREF', 'No Ref');
    const allResults = [entry('NOREF', '2024-01-01', 50)];
    const model = buildExploreModel([{ name: 'PanelA', tests: [test] }], allResults, 'si', 'PanelA');
    expect(model.markers['NOREF']).toBeUndefined();
    expect(model.notTaken.map((n) => n.key)).not.toContain('NOREF');
  });

  it('excludes a degenerate range (refMin === refMax)', () => {
    const test = obs('DEGEN', 'Degenerate');
    const allResults = [entry('DEGEN', '2024-01-01', 5, { refMin: 5, refMax: 5 })];
    const model = buildExploreModel([{ name: 'PanelA', tests: [test] }], allResults, 'si', 'PanelA');
    expect(model.markers['DEGEN']).toBeUndefined();
  });
});

describe('buildExploreModel — default selection by current panel', () => {
  const twoSided = (loinc: string, dates: string[]) => ({
    test: obs(loinc, loinc),
    entries: dates.map((d) => entry(loinc, d, 10, { refMin: 5, refMax: 15 })),
  });

  it('selects only the current panel\'s multi-reading, two-sided-range markers', () => {
    const a = twoSided('A_MULTI_CURRENT', ['2024-01-01', '2024-06-01']); // selected
    const b = twoSided('B_SINGLE_CURRENT', ['2024-01-01']); // plotted, not selected (1 reading)
    const c = twoSided('C_MULTI_OTHER', ['2024-01-01', '2024-06-01']); // plotted, not selected (other panel)
    const dUpperOnly = {
      test: obs('D_UPPERONLY_CURRENT', 'D'),
      entries: [
        entry('D_UPPERONLY_CURRENT', '2024-01-01', 8, { refMax: 20 }),
        entry('D_UPPERONLY_CURRENT', '2024-06-01', 9, { refMax: 20 }),
      ],
    }; // plotted (2 readings), not selected -- no genuine lower bound

    const conditions: Condition[] = [
      { name: 'Current', tests: [a.test, b.test, dUpperOnly.test] },
      { name: 'Other', tests: [c.test] },
    ];
    const allResults = [...a.entries, ...b.entries, ...c.entries, ...dUpperOnly.entries];
    const model = buildExploreModel(conditions, allResults, 'si', 'Current');

    expect(model.defaultSelection).toEqual(['A_MULTI_CURRENT']);
    expect(Object.keys(model.markers).sort()).toEqual(
      ['A_MULTI_CURRENT', 'B_SINGLE_CURRENT', 'C_MULTI_OTHER', 'D_UPPERONLY_CURRENT'].sort()
    );
  });
});

describe('buildExploreModel — a test shared by two panels', () => {
  it('gets exactly one marker, grouped under whichever panel lists it first', () => {
    const shared = obs('SHARED', 'Shared');
    const allResults = [
      entry('SHARED', '2024-01-01', 10, { refMin: 5, refMax: 15 }),
      entry('SHARED', '2024-06-01', 11, { refMin: 5, refMax: 15 }),
    ];
    const conditions: Condition[] = [
      { name: 'FirstPanel', tests: [shared] },
      { name: 'SecondPanel', tests: [shared] },
    ];
    const model = buildExploreModel(conditions, allResults, 'si', 'SecondPanel');
    expect(model.markers['SHARED']?.panel).toBe('FirstPanel');
    // Not the currently-open panel, so its multi-reading, two-sided marker
    // is still plotted but not pre-selected.
    expect(model.defaultSelection).not.toContain('SHARED');
  });
});

describe('buildExploreModel — SI/US unit conversion', () => {
  it('converts both the plotted values and the reference band into the requested unit system', () => {
    const test = obs('2339-0', 'GLU'); // real LOINC with a verified mg/dL <-> mmol/L conversion
    const allResults = [entry('2339-0', '2024-01-01', 90, { unit: 'mg/dL', refMin: 70, refMax: 100 })];

    const us = buildExploreModel([{ name: 'PanelA', tests: [test] }], allResults, 'us', 'PanelA');
    expect(us.markers['2339-0']).toMatchObject({ unit: 'mg/dL', refMin: 70, refMax: 100, data: [['2024-01-01', 90]] });

    const si = buildExploreModel([{ name: 'PanelA', tests: [test] }], allResults, 'si', 'PanelA');
    expect(si.markers['2339-0']!.unit).toBe('mmol/L');
    expect(si.markers['2339-0']!.refMin).toBe(toUnit(70, 'GLU', 'mg/dL', 'mmol/L'));
    expect(si.markers['2339-0']!.refMax).toBe(toUnit(100, 'GLU', 'mg/dL', 'mmol/L'));
    expect(si.markers['2339-0']!.data).toEqual([['2024-01-01', toUnit(90, 'GLU', 'mg/dL', 'mmol/L')]]);
  });

  it('leaves a marker with no verified conversion factor as-reported', () => {
    const test = obs('718-7', 'Hb'); // real LOINC, no entry in SI_US_UNIT
    const allResults = [entry('718-7', '2024-01-01', 14.2, { unit: 'g/dL', refMin: 13, refMax: 17 })];
    const model = buildExploreModel([{ name: 'PanelA', tests: [test] }], allResults, 'si', 'PanelA');
    expect(model.markers['718-7']).toMatchObject({ unit: 'g/dL', refMin: 13, refMax: 17, data: [['2024-01-01', 14.2]] });
  });
});

describe('buildExploreModel — title', () => {
  it('names the view honestly, matching the ported explore-types.ts rationale', () => {
    const model = buildExploreModel([], [], 'si', 'PanelA');
    expect(model.title).toBe("What's in range, what isn't");
  });
});
