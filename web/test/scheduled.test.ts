import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  EMPTY_SCHEDULED,
  SCHEDULED_KEY,
  indexInputLoincs,
  isIndexScheduled,
  isRowScheduled,
  loadScheduled,
  monthChoices,
  saveScheduled,
  selectionState,
  setRowsScheduled,
  setScheduleMonth,
  toggleIndex,
  toggleRow,
} from '../src/components/conditions/scheduled';
import { MARKER_LOINC } from '../src/data/computedIndices';
import { ALIAS_TO_PRIMARY, ALSO_REFS } from '../src/data/analyteCatalog';
import { testLoincs } from '../src/components/conditions/markers';

describe('toggleRow', () => {
  it('schedules and unschedules a plain LOINC', () => {
    const on = toggleRow(EMPTY_SCHEDULED, ['2093-3']);
    expect(isRowScheduled(on, ['2093-3'])).toBe(true);
    const off = toggleRow(on, ['2093-3']);
    expect(isRowScheduled(off, ['2093-3'])).toBe(false);
    expect(off.loincs).toEqual([]);
  });

  it('treats every LOINC of the same marker as one row', () => {
    const [primary, alt] = MARKER_LOINC.T!;
    const on = toggleRow(EMPTY_SCHEDULED, [primary!]);
    expect(isRowScheduled(on, [alt!])).toBe(true);
    const off = toggleRow(on, [alt!]);
    expect(isRowScheduled(off, [primary!])).toBe(false);
  });

  it('drops a stored index whose inputs are not all scheduled', () => {
    const s = toggleRow({ loincs: [], indices: ['ka'] }, ['2093-3']);
    expect(s.indices).toEqual([]);
  });
});

describe('toggleRow derives indices', () => {
  it('turns an index on once every input is scheduled', () => {
    const tc = toggleRow(EMPTY_SCHEDULED, ['2093-3']);
    expect(isIndexScheduled(tc, 'ka')).toBe(false);
    const both = toggleRow(tc, ['2085-9']);
    expect(isIndexScheduled(both, 'ka')).toBe(true);
    expect(isIndexScheduled(both, 'tchdl')).toBe(true);
    expect(isIndexScheduled(both, 'ldlhdl')).toBe(false);
  });

  it('turns an index off when one input is unscheduled, keeping the rest', () => {
    const on = toggleIndex(EMPTY_SCHEDULED, 'ka');
    const off = toggleRow(on, ['2085-9']);
    expect(isIndexScheduled(off, 'ka')).toBe(false);
    expect(isRowScheduled(off, ['2093-3'])).toBe(true);
    expect(isRowScheduled(off, ['2085-9'])).toBe(false);
  });

  it('counts an input scheduled under an alternate LOINC', () => {
    const [primary, alt] = MARKER_LOINC.T!;
    const shbg = MARKER_LOINC.SHBG![0]!;
    const s = toggleRow(toggleRow(EMPTY_SCHEDULED, [alt!]), [shbg]);
    expect(isRowScheduled(s, [primary!])).toBe(true);
    expect(isIndexScheduled(s, 'fai')).toBe(true);
  });
});

describe('toggleIndex', () => {
  it('schedules the index and every input LOINC it depends on', () => {
    const s = toggleIndex(EMPTY_SCHEDULED, 'ka');
    expect(isIndexScheduled(s, 'ka')).toBe(true);
    const deps = indexInputLoincs('ka');
    expect(deps).toEqual(expect.arrayContaining(['2093-3', '2085-9']));
    for (const loinc of deps) expect(isRowScheduled(s, [loinc])).toBe(true);
  });

  it('unschedules only the index, keeping its inputs', () => {
    const on = toggleIndex(EMPTY_SCHEDULED, 'ka');
    const off = toggleIndex(on, 'ka');
    expect(isIndexScheduled(off, 'ka')).toBe(false);
    expect(off.loincs).toEqual(on.loincs);
  });

  it('does not duplicate inputs already scheduled', () => {
    const pre = toggleRow(EMPTY_SCHEDULED, ['2093-3']);
    const s = toggleIndex(pre, 'ka');
    expect(new Set(s.loincs).size).toBe(s.loincs.length);
  });

  it('resolves an unknown index to no inputs', () => {
    expect(indexInputLoincs('nope')).toEqual([]);
  });
});

// All Observations folds an alias code into its primary's row before building
// the row, exactly as Panel Detail does, so both views hand toggleRow the same
// LOINC set and one view's toggle reads back in the other.
describe('All Observations rows fold aliases like Panel Detail', () => {
  const row = (loinc: string) => {
    const primary = ALIAS_TO_PRIMARY[loinc] ?? loinc;
    return testLoincs({ shortName: '', friendlyName: '', longCommonName: '', loinc: primary, also: ALSO_REFS[primary] });
  };

  it('every alias-bearing analyte yields the same LOINC set from either code', () => {
    for (const [alias, primary] of Object.entries(ALIAS_TO_PRIMARY)) {
      expect(row(alias)).toEqual(row(primary));
    }
  });

  it('scheduling a folded row reads as scheduled under every code of the group', () => {
    const [alias, primary] = Object.entries(ALIAS_TO_PRIMARY)[0]!;
    const on = toggleRow(EMPTY_SCHEDULED, row(alias));
    expect(isRowScheduled(on, [primary])).toBe(true);
    expect(isRowScheduled(on, [alias])).toBe(true);
    const off = toggleRow(on, row(primary));
    expect(isRowScheduled(off, [alias])).toBe(false);
  });
});

describe('loadScheduled', () => {
  it('falls back to empty when storage is unavailable', () => {
    expect(loadScheduled()).toEqual({ loincs: [], indices: [] });
  });
});

describe('the target month', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips through storage', () => {
    saveScheduled({ loincs: ['2093-3'], indices: [], month: '2027-03' });
    expect(loadScheduled()).toEqual({ loincs: ['2093-3'], indices: [], month: '2027-03' });
  });

  it('reads a payload stored before the month existed, sets intact', () => {
    store.set(SCHEDULED_KEY, '{"loincs":["2093-3","2085-9"],"indices":["ka"]}');
    const loaded = loadScheduled();
    expect(loaded.loincs).toEqual(['2093-3', '2085-9']);
    expect(loaded.indices).toEqual(['ka']);
    expect(loaded.month).toBeUndefined();
  });

  it('writes no month key when none is set, so the stored shape stays as it was', () => {
    saveScheduled({ loincs: ['2093-3'], indices: [] });
    expect(store.get(SCHEDULED_KEY)).toBe('{"loincs":["2093-3"],"indices":[]}');
  });

  it('ignores a stored month that is not YYYY-MM', () => {
    store.set(SCHEDULED_KEY, '{"loincs":[],"indices":[],"month":"March 2027"}');
    expect(loadScheduled().month).toBeUndefined();
    expect(setScheduleMonth(EMPTY_SCHEDULED, '2027-13').month).toBeUndefined();
    expect(setScheduleMonth(EMPTY_SCHEDULED, undefined).month).toBeUndefined();
  });

  // The month labels the one schedule rather than partitioning it, so every
  // toggle has to carry it through untouched.
  it('survives every kind of toggle', () => {
    const base = setScheduleMonth(EMPTY_SCHEDULED, '2027-03');
    expect(toggleRow(base, ['2093-3']).month).toBe('2027-03');
    expect(toggleIndex(base, 'ka').month).toBe('2027-03');
    expect(setRowsScheduled(base, [['2093-3']], true).month).toBe('2027-03');
    expect(setRowsScheduled(toggleRow(base, ['2093-3']), [['2093-3']], false).month).toBe('2027-03');
  });

  it('offers the coming months plus a stored one that has since fallen behind', () => {
    const choices = monthChoices(new Date(2026, 8, 8), 3, '2025-01');
    expect(choices).toEqual(['2025-01', '2026-09', '2026-10', '2026-11', '2026-12']);
    expect(monthChoices(new Date(2026, 8, 8), 3, '2026-10')).toHaveLength(4);
  });

  it('rolls the choices over a year boundary', () => {
    expect(monthChoices(new Date(2026, 10, 30), 2)).toEqual(['2026-11', '2026-12', '2027-01']);
  });
});

describe('a stored laboratory, which nothing sets any more', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('loads an old payload carrying lab with its observations, indices and month intact', () => {
    for (const lab of ['"esculab"', '42', 'null', '"no-such-lab"']) {
      store.set(SCHEDULED_KEY, `{"loincs":["2093-3"],"indices":["ka"],"month":"2027-03","lab":${lab}}`);
      expect(loadScheduled()).toEqual({ loincs: ['2093-3'], indices: ['ka'], month: '2027-03' });
    }
  });

  it('writes no lab key when that payload is saved back', () => {
    store.set(SCHEDULED_KEY, '{"loincs":["2093-3"],"indices":[],"month":"2027-03","lab":"esculab"}');
    saveScheduled(loadScheduled());
    expect(store.get(SCHEDULED_KEY)).toBe('{"loincs":["2093-3"],"indices":[],"month":"2027-03"}');
  });
});

describe('select-all over the observation rows on screen', () => {
  it('schedules and unschedules exactly the rows it is given', () => {
    const visible = [['2093-3'], ['2085-9']];
    const on = setRowsScheduled(toggleRow(EMPTY_SCHEDULED, ['2571-8']), visible, true);
    expect(isRowScheduled(on, ['2093-3'])).toBe(true);
    expect(isRowScheduled(on, ['2085-9'])).toBe(true);
    // Hidden by a filter, so select-all left it alone -- and clear-all likewise.
    const off = setRowsScheduled(on, visible, false);
    expect(off.loincs).toEqual(['2571-8']);
  });

  it('re-derives indices like a single row toggle does', () => {
    const on = setRowsScheduled(EMPTY_SCHEDULED, [['2093-3'], ['2085-9']], true);
    expect(isIndexScheduled(on, 'ka')).toBe(true);
    expect(isIndexScheduled(setRowsScheduled(on, [['2085-9']], false), 'ka')).toBe(false);
  });

  it('folds a row keyed under an alternate LOINC', () => {
    const [primary, alt] = MARKER_LOINC.T!;
    expect(isRowScheduled(setRowsScheduled(EMPTY_SCHEDULED, [[alt!]], true), [primary!])).toBe(true);
  });

  it('schedules no index whose inputs it did not all cover', () => {
    const [first] = indexInputLoincs('ka');
    const on = setRowsScheduled(EMPTY_SCHEDULED, [[first!]], true);
    expect(isRowScheduled(on, [first!])).toBe(true);
    expect(on.indices).toEqual([]);
  });
});

describe('selectionState', () => {
  it('reads none, some and all off the visible rows', () => {
    const visible = [['2093-3'], ['2085-9']];
    const flags = (s: typeof EMPTY_SCHEDULED) => visible.map((loincs) => isRowScheduled(s, loincs));
    expect(selectionState(flags(EMPTY_SCHEDULED))).toBe('none');
    expect(selectionState(flags(toggleRow(EMPTY_SCHEDULED, ['2093-3'])))).toBe('some');
    expect(selectionState(flags(setRowsScheduled(EMPTY_SCHEDULED, visible, true)))).toBe('all');
  });

  it('reads an empty table as none rather than all', () => {
    expect(selectionState([])).toBe('none');
  });

  it('reads the raw flags the same way at every size', () => {
    expect(selectionState([false])).toBe('none');
    expect(selectionState([true])).toBe('all');
    expect(selectionState([false, false, false])).toBe('none');
    expect(selectionState([false, true, false])).toBe('some');
    expect(selectionState([true, true, true])).toBe('all');
  });
});
