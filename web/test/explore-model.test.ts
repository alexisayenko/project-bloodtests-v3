import { describe, it, expect } from 'vitest';
import { buildExploreModel, refBandFor, INDEX_MARKER_KEY_PREFIX, type Condition } from '../src/components/conditions/exploreModel';
import { INDEX_DEFS, toUnit } from '../src/data/computedIndices';
import type { Observation } from '../src/components/conditions/markers';
import type { ResultEntry } from '../src/components/conditions/resultsLookup';
import type { Result } from '../src/types';

function obs(loinc: string, short: string, unit?: string): Observation {
  return { short, full: short, longCommonName: '', loinc, unit };
}

function result(value: number | null, overrides: Partial<Result> = {}): Result {
  return {
    loinc: '',
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
}

function entry(loinc: string, date: string, value: number | null, overrides: Partial<Result> = {}): ResultEntry {
  return { loinc, date, place: 'Lab', result: { ...result(value, overrides), loinc } };
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

// Sanity-checks refBandFor against two REAL INDEX_DEFS entries (not fabricated
// cut-points), one of each `hi` direction.
describe('refBandFor', () => {
  it('lower-is-better (hi=false/undefined, e.g. TC/HDL): [0, good] keeps the whole ok zone under 100%', () => {
    const tchdl = INDEX_DEFS.find((d) => d.key === 'tchdl')!;
    expect(tchdl.cut).toEqual([3.5, 5]); // good=3.5, warn=5
    expect(tchdl.hi).toBeFalsy();

    const { refMin, refMax } = refBandFor(tchdl);
    expect(refMin).toBe(0);
    expect(refMax).toBe(3.5);

    const pct = (v: number) => ((v - refMin) / (refMax - refMin)) * 100;
    expect(pct(3.0)).toBeLessThan(100); // an ok TC/HDL reads comfortably under 100%
    expect(pct(4.5)).toBeGreaterThan(100); // a warn-zone TC/HDL reads over 100%
  });

  it('higher-is-better (hi=true, e.g. T/LH): [warn, good] puts the ok threshold at/above 100%', () => {
    const tlh = INDEX_DEFS.find((d) => d.key === 'tlh')!;
    expect(tlh.cut).toEqual([100, 50]); // good=100, warn=50
    expect(tlh.hi).toBe(true);

    const { refMin, refMax } = refBandFor(tlh);
    expect(refMin).toBe(50);
    expect(refMax).toBe(100);

    const pct = (v: number) => ((v - refMin) / (refMax - refMin)) * 100;
    expect(pct(120)).toBeGreaterThanOrEqual(100); // clearly-ok T/LH reads at/past the band
    expect(pct(100)).toBe(100); // AT the ok threshold itself: at 100%, not still climbing toward it
    expect(pct(60)).toBeLessThan(100); // a low T/LH reads within-band-but-low, not off-scale
    expect(pct(60)).toBeGreaterThan(0);
  });
});

describe('buildExploreModel — computed indices (Panel Detail only)', () => {
  const CARDIO = 'Cardiovascular Risk'; // real PANEL_DEFS/INDEX_DEFS panel name
  const TC_LOINC = '2093-3';
  const HDL_LOINC = '2085-9';

  it('builds a full historical series for a panel index, banded via refBandFor', () => {
    const conditions: Condition[] = [{ name: CARDIO, tests: [] }];
    const resultsByDate: Record<string, Record<string, Result>> = {
      '2024-01-01': { [TC_LOINC]: result(200, { unit: 'mg/dL' }), [HDL_LOINC]: result(50, { unit: 'mg/dL' }) }, // TC/HDL = 4
      '2024-06-01': { [TC_LOINC]: result(175, { unit: 'mg/dL' }), [HDL_LOINC]: result(50, { unit: 'mg/dL' }) }, // TC/HDL = 3.5
    };

    const model = buildExploreModel(conditions, [], 'si', CARDIO, resultsByDate);
    const tchdl = INDEX_DEFS.find((d) => d.key === 'tchdl')!;

    expect(model.markers[`${INDEX_MARKER_KEY_PREFIX}tchdl`]).toMatchObject({
      label: 'TC/HDL',
      panel: CARDIO,
      warn: false,
      ...refBandFor(tchdl),
      data: [
        ['2024-01-01', 4],
        ['2024-06-01', 3.5],
      ],
    });
  });

  it('never builds index markers when called without resultsByDate (the All Observations call shape)', () => {
    const conditions: Condition[] = [{ name: CARDIO, tests: [] }];
    const model = buildExploreModel(conditions, [], 'si', CARDIO);
    expect(Object.keys(model.markers).some((k) => k.startsWith(INDEX_MARKER_KEY_PREFIX))).toBe(false);
  });

  it('lists an index that is never computable from anything on file as not taken, not plotted', () => {
    const conditions: Condition[] = [{ name: CARDIO, tests: [] }];
    // TC only, every date -- tchdl also needs HDL-C, so it can never be computed.
    const resultsByDate: Record<string, Record<string, Result>> = {
      '2024-01-01': { [TC_LOINC]: result(200, { unit: 'mg/dL' }) },
    };

    const model = buildExploreModel(conditions, [], 'si', CARDIO, resultsByDate);
    expect(model.markers[`${INDEX_MARKER_KEY_PREFIX}tchdl`]).toBeUndefined();
    expect(model.notTaken).toContainEqual({ key: `${INDEX_MARKER_KEY_PREFIX}tchdl`, label: 'TC/HDL', panel: CARDIO });
  });
});
