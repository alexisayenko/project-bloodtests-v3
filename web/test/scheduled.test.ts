import { describe, it, expect } from 'vitest';
import {
  EMPTY_SCHEDULED,
  indexInputLoincs,
  isIndexScheduled,
  isRowScheduled,
  loadScheduled,
  toggleIndex,
  toggleRow,
} from '../src/components/conditions/scheduled';
import { MARKER_LOINC } from '../src/data/computedIndices';

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

describe('loadScheduled', () => {
  it('falls back to empty when storage is unavailable', () => {
    expect(loadScheduled()).toEqual({ loincs: [], indices: [] });
  });
});
