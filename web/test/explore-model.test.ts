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
  it('excludes a lower-bound-only marker from plotting, but surfaces it as a distinguishable notTaken chip (not silently dropped)', () => {
    // Real-world shape: HDL-C (LOINC 2085-9) is commonly reported as "> 40
    // mg/dL" with no upper bound at all, confirmed against real uploaded
    // data (dev-data/bloodtests.json) -- every dated HDL-C reading there has
    // refMax: null. It would read inverted once normalized, so it can never
    // be PLOTTED -- but it HAS real readings on file, so it must not vanish
    // the way a genuinely never-taken marker does not (see the next
    // describe block) -- it needs its own reason.
    const test = obs('LOWONLY', 'Lower Only');
    const allResults = [entry('LOWONLY', '2024-01-01', 50, { refMin: 20, refMax: null })];
    const model = buildExploreModel([{ name: 'PanelA', tests: [test] }], allResults, 'si', 'PanelA');
    expect(model.markers['LOWONLY']).toBeUndefined();
    expect(model.notTaken).toContainEqual({ key: 'LOWONLY', label: 'Lower Only', panel: 'PanelA', reason: 'no upper bound' });
  });

  it('distinguishes a has-data-but-unplottable marker from a genuinely never-taken one via reason', () => {
    const lowOnly = obs('LOWONLY2', 'Lower Only 2');
    const neverTaken = obs('NEVERTAKEN2', 'Never Taken 2');
    const allResults = [entry('LOWONLY2', '2024-01-01', 50, { refMin: 20, refMax: null })];
    const model = buildExploreModel(
      [{ name: 'PanelA', tests: [lowOnly, neverTaken] }],
      allResults,
      'si',
      'PanelA'
    );
    const lowOnlyEntry = model.notTaken.find((n) => n.key === 'LOWONLY2');
    const neverTakenEntry = model.notTaken.find((n) => n.key === 'NEVERTAKEN2');
    expect(lowOnlyEntry?.reason).toBe('no upper bound');
    expect(neverTakenEntry?.reason).toBeUndefined();
  });

  it('excludes a marker with no reference range at all from plotting, but still surfaces it as notTaken', () => {
    const test = obs('NOREF', 'No Ref');
    const allResults = [entry('NOREF', '2024-01-01', 50)];
    const model = buildExploreModel([{ name: 'PanelA', tests: [test] }], allResults, 'si', 'PanelA');
    expect(model.markers['NOREF']).toBeUndefined();
    expect(model.notTaken).toContainEqual({ key: 'NOREF', label: 'No Ref', panel: 'PanelA', reason: 'no upper bound' });
  });

  it('excludes a degenerate range (refMin === refMax)', () => {
    const test = obs('DEGEN', 'Degenerate');
    const allResults = [entry('DEGEN', '2024-01-01', 5, { refMin: 5, refMax: 5 })];
    const model = buildExploreModel([{ name: 'PanelA', tests: [test] }], allResults, 'si', 'PanelA');
    expect(model.markers['DEGEN']).toBeUndefined();
  });
});

describe('buildExploreModel — REF_BAND_OVERRIDES (curated band for a no-refMax marker)', () => {
  const HDL_LOINC = '2085-9'; // real LOINC, the only entry in REF_BAND_OVERRIDES

  it('plots HDL-C (real data, no dated reading ever prints refMax) using the curated 40/60 mg/dL band instead of falling back to notTaken', () => {
    const test = obs(HDL_LOINC, 'HDL-C', 'mg/dL');
    const allResults = [
      entry(HDL_LOINC, '2024-01-01', 45, { unit: 'mg/dL', refMin: 40, refMax: null }),
      entry(HDL_LOINC, '2024-06-01', 55, { unit: 'mg/dL', refMin: 40, refMax: null }),
    ];
    const model = buildExploreModel([{ name: 'Cardiovascular Risk', tests: [test] }], allResults, 'us', 'Cardiovascular Risk');

    expect(model.notTaken.map((n) => n.key)).not.toContain(HDL_LOINC);
    expect(model.markers[HDL_LOINC]).toMatchObject({
      refMin: 40,
      refMax: 60,
      unit: 'mg/dL',
      data: [
        ['2024-01-01', 45],
        ['2024-06-01', 55],
      ],
      warn: false,
    });
    // Honesty signal: the override cites its source in goodNote, surfaced once a
    // reading reaches the NCEP threshold, rather than a label caveat.
    expect(model.markers[HDL_LOINC]?.goodNote).toContain('curated band');
  });

  it('converts the curated HDL-C band through the same SI/US unit-conversion path other markers use', () => {
    const test = obs(HDL_LOINC, 'HDL-C', 'mg/dL');
    const allResults = [entry(HDL_LOINC, '2024-01-01', 50, { unit: 'mg/dL', refMin: 40, refMax: null })];
    const model = buildExploreModel([{ name: 'Cardiovascular Risk', tests: [test] }], allResults, 'si', 'Cardiovascular Risk');

    expect(model.markers[HDL_LOINC]?.unit).toBe('mmol/L');
    expect(model.markers[HDL_LOINC]?.refMin).toBe(toUnit(40, 'HDL-C', 'mg/dL', 'mmol/L'));
    expect(model.markers[HDL_LOINC]?.refMax).toBe(toUnit(60, 'HDL-C', 'mg/dL', 'mmol/L'));
    expect(model.markers[HDL_LOINC]?.data).toEqual([['2024-01-01', toUnit(50, 'HDL-C', 'mg/dL', 'mmol/L')]]);
  });

  it('regression: a DIFFERENT no-refMax marker with no configured override still falls back to notTaken/"no upper bound"', () => {
    const test = obs('OTHERLOWONLY', 'Other Lower Only');
    const allResults = [entry('OTHERLOWONLY', '2024-01-01', 50, { refMin: 20, refMax: null })];
    const model = buildExploreModel([{ name: 'PanelA', tests: [test] }], allResults, 'si', 'PanelA');

    expect(model.markers['OTHERLOWONLY']).toBeUndefined();
    expect(model.notTaken).toContainEqual({ key: 'OTHERLOWONLY', label: 'Other Lower Only', panel: 'PanelA', reason: 'no upper bound' });
  });
});

describe('buildExploreModel — INDEX_LOINCS (raw LOINC superseded by its computed twin)', () => {
  it('never builds a raw marker or notTaken chip for a LOINC in INDEX_LOINCS, even with real data', () => {
    // 9830-1 is TC/HDL ratio, independently lab-reportable but superseded by
    // the computed idx:tchdl marker elsewhere -- see markers.ts's
    // INDEX_LOINCS. Without this filter it would show up here as a raw,
    // grey-looking "TC/HDL" chip alongside the real computed one.
    const test = obs('9830-1', 'TC/HDL');
    const allResults = [entry('9830-1', '2024-01-01', 4, { refMin: 0, refMax: 3.5 })];
    const model = buildExploreModel([{ name: 'Cardiovascular Risk', tests: [test] }], allResults, 'si', 'Cardiovascular Risk');
    expect(model.markers['9830-1']).toBeUndefined();
    expect(model.notTaken.map((n) => n.key)).not.toContain('9830-1');
  });

  it('never builds a notTaken chip for a never-taken LOINC in INDEX_LOINCS either', () => {
    const test = obs('2502-3', 'TSAT'); // % Iron Saturation, also in INDEX_LOINCS
    const model = buildExploreModel([{ name: 'Iron Studies', tests: [test] }], [], 'si', 'Iron Studies');
    expect(model.notTaken.map((n) => n.key)).not.toContain('2502-3');
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
  it('gets exactly one marker, grouped under ALL of its panels (not just the first-listed one)', () => {
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
    // Still exactly one marker entry -- one series, one set of readings --
    // just groupable under both panels' picker boxes.
    expect(Object.keys(model.markers)).toEqual(['SHARED']);
    expect(model.markers['SHARED']?.panel).toEqual(['FirstPanel', 'SecondPanel']);
    // It DOES belong to the currently-open panel (just not exclusively), so
    // it's still pre-selected -- membership, not first-panel-wins equality.
    expect(model.defaultSelection).toContain('SHARED');
  });

  it('keeps a single-panel marker\'s panel field a plain string, not a 1-element array', () => {
    const solo = obs('SOLO', 'Solo');
    const allResults = [entry('SOLO', '2024-01-01', 10, { refMin: 5, refMax: 15 })];
    const model = buildExploreModel([{ name: 'OnlyPanel', tests: [solo] }], allResults, 'si');
    expect(model.markers['SOLO']?.panel).toBe('OnlyPanel');
  });

  it('lists a never-taken test shared by two panels as notTaken, grouped under ALL of its panels', () => {
    const shared = obs('NEVERSHARED', 'Never Shared');
    const conditions: Condition[] = [
      { name: 'FirstPanel', tests: [shared] },
      { name: 'SecondPanel', tests: [shared] },
    ];
    const model = buildExploreModel(conditions, [], 'si');
    expect(model.notTaken).toEqual([{ key: 'NEVERSHARED', label: 'Never Shared', panel: ['FirstPanel', 'SecondPanel'] }]);
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

describe('buildExploreModel — computed indices (Panel Detail: currentPanel + resultsByDate)', () => {
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

  it('never builds index markers when called without resultsByDate at all', () => {
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

describe('buildExploreModel — computed indices (All Observations: resultsByDate without currentPanel)', () => {
  const TC_LOINC = '2093-3';
  const HDL_LOINC = '2085-9';
  const TRIG_LOINC = '2571-8';

  it('builds a marker for every INDEX_DEFS entry, not just one panel\'s', () => {
    const conditions: Condition[] = [];
    const resultsByDate: Record<string, Record<string, Result>> = {
      '2024-01-01': {
        [TC_LOINC]: result(200, { unit: 'mg/dL' }),
        [HDL_LOINC]: result(50, { unit: 'mg/dL' }),
        [TRIG_LOINC]: result(150, { unit: 'mg/dL' }),
      },
    };

    // No currentPanel -- the All Observations call shape.
    const model = buildExploreModel(conditions, [], 'si', undefined, resultsByDate);

    // Indices from unrelated panels (e.g. Hypogonadism's cFT/FAI, which need
    // T/SHBG we never supplied) all still get a notTaken entry, so every
    // INDEX_DEFS key -- not just Cardiovascular Risk's -- shows up somewhere.
    const allIndexKeys = new Set([
      ...Object.keys(model.markers).filter((k) => k.startsWith(INDEX_MARKER_KEY_PREFIX)),
      ...model.notTaken.filter((n) => n.key.startsWith(INDEX_MARKER_KEY_PREFIX)).map((n) => n.key),
    ]);
    for (const def of INDEX_DEFS) expect(allIndexKeys).toContain(INDEX_MARKER_KEY_PREFIX + def.key);
  });

  it('groups a multi-panel index (aip) under ALL of its declared panels, same string|string[] convention as observations', () => {
    const aip = INDEX_DEFS.find((d) => d.key === 'aip')!;
    expect(aip.panels).toEqual(['Insulin Resistance', 'Cardiovascular Risk']); // real multi-panel index

    const resultsByDate: Record<string, Record<string, Result>> = {
      '2024-01-01': { [TRIG_LOINC]: result(150, { unit: 'mg/dL' }), [HDL_LOINC]: result(50, { unit: 'mg/dL' }) },
    };
    const model = buildExploreModel([], [], 'si', undefined, resultsByDate);

    const key = INDEX_MARKER_KEY_PREFIX + 'aip';
    expect(model.markers[key]?.panel).toEqual(['Insulin Resistance', 'Cardiovascular Risk']);
  });

  it('groups a single-panel index (tchdl) under a plain string, not a 1-element array', () => {
    const tchdl = INDEX_DEFS.find((d) => d.key === 'tchdl')!;
    expect(tchdl.panels).toEqual(['Cardiovascular Risk']);

    const resultsByDate: Record<string, Record<string, Result>> = {
      '2024-01-01': { [TC_LOINC]: result(200, { unit: 'mg/dL' }), [HDL_LOINC]: result(50, { unit: 'mg/dL' }) },
    };
    const model = buildExploreModel([], [], 'si', undefined, resultsByDate);

    expect(model.markers[`${INDEX_MARKER_KEY_PREFIX}tchdl`]?.panel).toBe('Cardiovascular Risk');
  });

  it('lists a never-computable multi-panel index as notTaken under ALL of its panels', () => {
    // No TRIG/HDL at all -- aip can never be computed.
    const resultsByDate: Record<string, Record<string, Result>> = {
      '2024-01-01': { [TC_LOINC]: result(200, { unit: 'mg/dL' }) },
    };
    const model = buildExploreModel([], [], 'si', undefined, resultsByDate);

    expect(model.notTaken).toContainEqual({
      key: `${INDEX_MARKER_KEY_PREFIX}aip`,
      label: 'AIP',
      panel: ['Insulin Resistance', 'Cardiovascular Risk'],
    });
  });

  it('keeps the single-panel (currentPanel + resultsByDate) shape unaffected: still only that panel\'s indices, plain-string panel', () => {
    const conditions: Condition[] = [{ name: 'Cardiovascular Risk', tests: [] }];
    const resultsByDate: Record<string, Record<string, Result>> = {
      '2024-01-01': {
        [TC_LOINC]: result(200, { unit: 'mg/dL' }),
        [HDL_LOINC]: result(50, { unit: 'mg/dL' }),
        [TRIG_LOINC]: result(150, { unit: 'mg/dL' }),
      },
    };
    const model = buildExploreModel(conditions, [], 'si', 'Cardiovascular Risk', resultsByDate);

    // aip belongs to Cardiovascular Risk too, but currentPanel scoping keeps
    // it a plain string (not ['Insulin Resistance', 'Cardiovascular Risk']).
    expect(model.markers[`${INDEX_MARKER_KEY_PREFIX}aip`]?.panel).toBe('Cardiovascular Risk');
    // Insulin Resistance-only indices (e.g. TyG, which needs GLU we never
    // supplied here anyway) never appear at all when scoped to Cardio.
    expect(model.markers[`${INDEX_MARKER_KEY_PREFIX}tyg`]).toBeUndefined();
    expect(model.notTaken.some((n) => n.key === `${INDEX_MARKER_KEY_PREFIX}tyg`)).toBe(false);
  });
});
