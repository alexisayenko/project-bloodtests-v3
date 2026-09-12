import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  EMPTY_SCHEDULED_VISITS,
  SCHEDULED_KEY,
  addVisit,
  indexInputLoincs,
  isIndexScheduled,
  isRowScheduled,
  isScheduledShape,
  loadScheduled,
  monthChoices,
  removeVisit,
  saveScheduled,
  selectionState,
  setRowsScheduled,
  setScheduleMonth,
  setSelectedLab,
  toggleIndex,
  toggleRow,
  type ScheduledVisits,
} from '../src/components/conditions/scheduled';
import { MARKER_LOINC } from '../src/data/computedIndices';
import { ALIAS_TO_PRIMARY, ALSO_REFS } from '../src/data/analyteCatalog';
import { testLoincs } from '../src/components/conditions/markers';
import { LABORATORIES } from '../src/data/labPricing';

// One visit, named "v1", to exercise the pure per-visit functions the way the
// pre-redesign tests exercised the single global schedule.
const V1 = 'v1';
const withV1 = (): ScheduledVisits => addVisit(EMPTY_SCHEDULED_VISITS, V1);
const visitOf = (s: ScheduledVisits, id = V1) => s.visits.find((v) => v.id === id)!;

describe('toggleRow', () => {
  it('schedules and unschedules a plain LOINC', () => {
    const on = toggleRow(withV1(), V1, ['2093-3']);
    expect(isRowScheduled(visitOf(on), ['2093-3'])).toBe(true);
    const off = toggleRow(on, V1, ['2093-3']);
    expect(isRowScheduled(visitOf(off), ['2093-3'])).toBe(false);
    expect(visitOf(off).loincs).toEqual([]);
  });

  it('treats every LOINC of the same marker as one row', () => {
    const [primary, alt] = MARKER_LOINC.T!;
    const on = toggleRow(withV1(), V1, [primary!]);
    expect(isRowScheduled(visitOf(on), [alt!])).toBe(true);
    const off = toggleRow(on, V1, [alt!]);
    expect(isRowScheduled(visitOf(off), [primary!])).toBe(false);
  });

  it('drops a stored index whose inputs are not all scheduled', () => {
    const seeded: ScheduledVisits = { visits: [{ id: V1, loincs: [], indices: ['ka'] }] };
    const s = toggleRow(seeded, V1, ['2093-3']);
    expect(visitOf(s).indices).toEqual([]);
  });

  it('leaves every other visit untouched', () => {
    const two = addVisit(withV1(), 'v2');
    const s = toggleRow(two, V1, ['2093-3']);
    expect(isRowScheduled(visitOf(s, V1), ['2093-3'])).toBe(true);
    expect(isRowScheduled(visitOf(s, 'v2'), ['2093-3'])).toBe(false);
  });
});

describe('toggleRow derives indices', () => {
  it('turns an index on once every input is scheduled', () => {
    const tc = toggleRow(withV1(), V1, ['2093-3']);
    expect(isIndexScheduled(visitOf(tc), 'ka')).toBe(false);
    const both = toggleRow(tc, V1, ['2085-9']);
    expect(isIndexScheduled(visitOf(both), 'ka')).toBe(true);
    expect(isIndexScheduled(visitOf(both), 'tchdl')).toBe(true);
    expect(isIndexScheduled(visitOf(both), 'ldlhdl')).toBe(false);
  });

  it('turns an index off when one input is unscheduled, keeping the rest', () => {
    const on = toggleIndex(withV1(), V1, 'ka');
    const off = toggleRow(on, V1, ['2085-9']);
    expect(isIndexScheduled(visitOf(off), 'ka')).toBe(false);
    expect(isRowScheduled(visitOf(off), ['2093-3'])).toBe(true);
    expect(isRowScheduled(visitOf(off), ['2085-9'])).toBe(false);
  });

  it('counts an input scheduled under an alternate LOINC', () => {
    const [primary, alt] = MARKER_LOINC.T!;
    const shbg = MARKER_LOINC.SHBG![0]!;
    const s = toggleRow(toggleRow(withV1(), V1, [alt!]), V1, [shbg]);
    expect(isRowScheduled(visitOf(s), [primary!])).toBe(true);
    expect(isIndexScheduled(visitOf(s), 'fai')).toBe(true);
  });
});

describe('toggleIndex', () => {
  it('schedules the index and every input LOINC it depends on', () => {
    const s = toggleIndex(withV1(), V1, 'ka');
    expect(isIndexScheduled(visitOf(s), 'ka')).toBe(true);
    const deps = indexInputLoincs('ka');
    expect(deps).toEqual(expect.arrayContaining(['2093-3', '2085-9']));
    for (const loinc of deps) expect(isRowScheduled(visitOf(s), [loinc])).toBe(true);
  });

  it('unschedules only the index, keeping its inputs', () => {
    const on = toggleIndex(withV1(), V1, 'ka');
    const off = toggleIndex(on, V1, 'ka');
    expect(isIndexScheduled(visitOf(off), 'ka')).toBe(false);
    expect(visitOf(off).loincs).toEqual(visitOf(on).loincs);
  });

  it('does not duplicate inputs already scheduled', () => {
    const pre = toggleRow(withV1(), V1, ['2093-3']);
    const s = toggleIndex(pre, V1, 'ka');
    expect(new Set(visitOf(s).loincs).size).toBe(visitOf(s).loincs.length);
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
    const on = toggleRow(withV1(), V1, row(alias));
    expect(isRowScheduled(visitOf(on), [primary])).toBe(true);
    expect(isRowScheduled(visitOf(on), [alias])).toBe(true);
    const off = toggleRow(on, V1, row(primary));
    expect(isRowScheduled(visitOf(off), [alias])).toBe(false);
  });
});

describe('loadScheduled', () => {
  it('falls back to empty when storage is unavailable', () => {
    expect(loadScheduled()).toEqual({ visits: [] });
  });
});

describe('addVisit and removeVisit', () => {
  it('adds an empty visit with no month or rows', () => {
    const s = addVisit(EMPTY_SCHEDULED_VISITS, V1);
    expect(s.visits).toEqual([{ id: V1, loincs: [], indices: [] }]);
  });

  it('appends to the end, leaving existing visits untouched', () => {
    const one = toggleRow(withV1(), V1, ['2093-3']);
    const two = addVisit(one, 'v2');
    expect(two.visits.map((v) => v.id)).toEqual([V1, 'v2']);
    expect(visitOf(two, V1).loincs).toEqual(['2093-3']);
    expect(visitOf(two, 'v2').loincs).toEqual([]);
  });

  it('removes exactly the named visit, leaving the others in place', () => {
    const two = addVisit(withV1(), 'v2');
    const removed = removeVisit(two, V1);
    expect(removed.visits.map((v) => v.id)).toEqual(['v2']);
  });

  it('removing an unknown visit id is a no-op', () => {
    const one = withV1();
    expect(removeVisit(one, 'nope')).toEqual(one);
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
    const scheduled: ScheduledVisits = { visits: [{ id: V1, loincs: ['2093-3'], indices: [], month: '2027-03' }] };
    saveScheduled(scheduled);
    expect(loadScheduled()).toEqual(scheduled);
  });

  it('ignores a stored month that is not YYYY-MM', () => {
    store.set(SCHEDULED_KEY, '{"visits":[{"id":"v1","loincs":[],"indices":[],"month":"March 2027"}]}');
    expect(visitOf(loadScheduled()).month).toBeUndefined();
    expect(setScheduleMonth(withV1(), V1, '2027-13').visits[0]!.month).toBeUndefined();
    expect(setScheduleMonth(withV1(), V1, undefined).visits[0]!.month).toBeUndefined();
  });

  // The month labels one visit's schedule rather than partitioning it, so
  // every toggle in that visit has to carry it through untouched.
  it('survives every kind of toggle', () => {
    const base = setScheduleMonth(withV1(), V1, '2027-03');
    expect(visitOf(toggleRow(base, V1, ['2093-3'])).month).toBe('2027-03');
    expect(visitOf(toggleIndex(base, V1, 'ka')).month).toBe('2027-03');
    expect(visitOf(setRowsScheduled(base, V1, [['2093-3']], true)).month).toBe('2027-03');
    expect(visitOf(setRowsScheduled(toggleRow(base, V1, ['2093-3']), V1, [['2093-3']], false)).month).toBe('2027-03');
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

describe('migrating the pre-redesign single-schedule shape', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('migrates a non-empty legacy payload into exactly one visit with a fresh id', () => {
    store.set(SCHEDULED_KEY, '{"loincs":["2093-3","2085-9"],"indices":["ka"],"month":"2027-03"}');
    const loaded = loadScheduled();
    expect(loaded.visits).toHaveLength(1);
    const [visit] = loaded.visits;
    expect(typeof visit!.id).toBe('string');
    expect(visit!.id).not.toBe('');
    expect(visit).toMatchObject({ loincs: ['2093-3', '2085-9'], indices: ['ka'], month: '2027-03' });
  });

  it('migrates a fully empty legacy payload to zero visits, manufacturing nothing', () => {
    store.set(SCHEDULED_KEY, '{"loincs":[],"indices":[]}');
    expect(loadScheduled()).toEqual({ visits: [] });
  });

  it('migrates a legacy payload carrying only a selected lab (no rows) to one visit', () => {
    const realLabId = LABORATORIES[0]!.id;
    store.set(SCHEDULED_KEY, `{"loincs":[],"indices":[],"selectedLabId":"${realLabId}"}`);
    const loaded = loadScheduled();
    expect(loaded.visits).toHaveLength(1);
    expect(loaded.visits[0]).toMatchObject({ loincs: [], indices: [], selectedLabId: realLabId });
  });

  it('carries a stray legacy lab key over as ignored, exactly as before', () => {
    for (const lab of ['"esculab"', '42', 'null', '"no-such-lab"']) {
      store.set(SCHEDULED_KEY, `{"loincs":["2093-3"],"indices":["ka"],"month":"2027-03","lab":${lab}}`);
      const loaded = loadScheduled();
      expect(loaded.visits).toHaveLength(1);
      expect(loaded.visits[0]).toMatchObject({ loincs: ['2093-3'], indices: ['ka'], month: '2027-03', selectedLabId: undefined });
    }
  });

  it('does not read a legacy lab key as the new selectedLabId', () => {
    store.set(SCHEDULED_KEY, '{"loincs":["2093-3"],"indices":[],"lab":"esculab"}');
    expect(loadScheduled().visits[0]!.selectedLabId).toBeUndefined();
  });

  it('a payload already in the new visits shape is read back untouched', () => {
    const scheduled: ScheduledVisits = { visits: [{ id: 'v1', loincs: ['2093-3'], indices: [], month: '2027-03' }] };
    saveScheduled(scheduled);
    expect(loadScheduled()).toEqual(scheduled);
  });

  it('isScheduledShape recognizes both the legacy object and the new visits list', () => {
    expect(isScheduledShape({ loincs: [], indices: [] })).toBe(true);
    expect(isScheduledShape({ visits: [] })).toBe(true);
    expect(isScheduledShape({ visits: [{ id: 'v1', loincs: [], indices: [] }] })).toBe(true);
    expect(isScheduledShape({})).toBe(false);
    expect(isScheduledShape(null)).toBe(false);
  });

});

describe('the selected laboratory', () => {
  const store = new Map<string, string>();
  const realLabId = LABORATORIES[0]!.id;

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips through storage like month does', () => {
    const scheduled: ScheduledVisits = { visits: [{ id: V1, loincs: [], indices: [], selectedLabId: realLabId }] };
    saveScheduled(scheduled);
    expect(loadScheduled()).toEqual(scheduled);
  });

  it('ignores a stored id that names no known laboratory', () => {
    store.set(SCHEDULED_KEY, `{"visits":[{"id":"v1","loincs":[],"indices":[],"selectedLabId":"no-such-lab"}]}`);
    expect(visitOf(loadScheduled()).selectedLabId).toBeUndefined();
    expect(setSelectedLab(withV1(), V1, 'no-such-lab').visits[0]!.selectedLabId).toBeUndefined();
    expect(setSelectedLab(withV1(), V1, undefined).visits[0]!.selectedLabId).toBeUndefined();
  });

  it('sets and clears through setSelectedLab', () => {
    const picked = setSelectedLab(withV1(), V1, realLabId);
    expect(visitOf(picked).selectedLabId).toBe(realLabId);
    expect(visitOf(setSelectedLab(picked, V1, undefined)).selectedLabId).toBeUndefined();
  });
});

describe('select-all over the observation rows on screen', () => {
  it('schedules and unschedules exactly the rows it is given', () => {
    const visible = [['2093-3'], ['2085-9']];
    const on = setRowsScheduled(toggleRow(withV1(), V1, ['2571-8']), V1, visible, true);
    expect(isRowScheduled(visitOf(on), ['2093-3'])).toBe(true);
    expect(isRowScheduled(visitOf(on), ['2085-9'])).toBe(true);
    // Hidden by a filter, so select-all left it alone -- and clear-all likewise.
    const off = setRowsScheduled(on, V1, visible, false);
    expect(visitOf(off).loincs).toEqual(['2571-8']);
  });

  it('re-derives indices like a single row toggle does', () => {
    const on = setRowsScheduled(withV1(), V1, [['2093-3'], ['2085-9']], true);
    expect(isIndexScheduled(visitOf(on), 'ka')).toBe(true);
    expect(isIndexScheduled(visitOf(setRowsScheduled(on, V1, [['2085-9']], false)), 'ka')).toBe(false);
  });

  it('folds a row keyed under an alternate LOINC', () => {
    const [primary, alt] = MARKER_LOINC.T!;
    expect(isRowScheduled(visitOf(setRowsScheduled(withV1(), V1, [[alt!]], true)), [primary!])).toBe(true);
  });

  it('schedules no index whose inputs it did not all cover', () => {
    const [first] = indexInputLoincs('ka');
    const on = setRowsScheduled(withV1(), V1, [[first!]], true);
    expect(isRowScheduled(visitOf(on), [first!])).toBe(true);
    expect(visitOf(on).indices).toEqual([]);
  });

  it('leaves another visit untouched', () => {
    const two = addVisit(withV1(), 'v2');
    const on = setRowsScheduled(two, V1, [['2093-3']], true);
    expect(isRowScheduled(visitOf(on, V1), ['2093-3'])).toBe(true);
    expect(isRowScheduled(visitOf(on, 'v2'), ['2093-3'])).toBe(false);
  });
});

describe('selectionState', () => {
  it('reads none, some and all off the visible rows', () => {
    const visible = [['2093-3'], ['2085-9']];
    const flags = (s: ScheduledVisits) => visible.map((loincs) => isRowScheduled(visitOf(s), loincs));
    expect(selectionState(flags(withV1()))).toBe('none');
    expect(selectionState(flags(toggleRow(withV1(), V1, ['2093-3'])))).toBe('some');
    expect(selectionState(flags(setRowsScheduled(withV1(), V1, visible, true)))).toBe('all');
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
