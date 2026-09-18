// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { act, useState } from 'react';
import { useAllResults, type AllResultsState } from '../src/hooks/useAllResults';
import type { DiagnosticReport, Result } from '../src/types';
import { makeResult, makeSession } from './helpers/fixtures';
import { mount, unmount } from './helpers/render';

let latest: AllResultsState;
let setSessions: (s: DiagnosticReport[]) => void = () => {};

type Loader = (sessionId: string) => Promise<Result[]>;

function Harness({ initial, loadGroupItems }: Readonly<{ initial: DiagnosticReport[]; loadGroupItems: Loader }>) {
  const [sessions, set] = useState(initial);
  setSessions = set;
  latest = useAllResults(sessions, loadGroupItems);
  return null;
}

const neverCalled: Loader = vi.fn(() => Promise.reject(new Error('should not load')));

const settle = () => act(async () => {});

afterEach(() => {
  unmount();
});

describe('useAllResults', () => {
  it('flattens every session that already carries its items, stamping date and place', async () => {
    const sessions = [
      makeSession({ date: '2026-01-10', place: 'Quest', file: 'a', items: [makeResult({ loinc: '718-7', value: 14 })] }),
      makeSession({ date: '2026-03-02', place: 'Synevo', file: 'b', items: [makeResult({ loinc: '718-7', value: 15 }), makeResult({ loinc: '2345-7', value: 5 })] }),
    ];
    await mount(<Harness initial={sessions} loadGroupItems={neverCalled} />);
    await settle();
    expect(latest.allResults.map((e) => [e.loinc, e.date, e.place, e.result.value])).toEqual([
      ['718-7', '2026-01-10', 'Quest', 14],
      ['718-7', '2026-03-02', 'Synevo', 15],
      ['2345-7', '2026-03-02', 'Synevo', 5],
    ]);
    expect(neverCalled).not.toHaveBeenCalled();
  });

  it('loads the items of a session that has none in memory', async () => {
    const loader = vi.fn(async (id: string) => (id === 'lazy' ? [makeResult({ loinc: '2345-7', value: 90 })] : []));
    const sessions = [makeSession({ date: '2026-02-01', file: 'lazy', items: null })];
    await mount(<Harness initial={sessions} loadGroupItems={loader} />);
    await settle();
    expect(loader).toHaveBeenCalledWith('lazy');
    expect(latest.allResults).toHaveLength(1);
    expect(latest.allResults[0]!.loinc).toBe('2345-7');
  });

  it('drops a load superseded by a newer session list', async () => {
    let resolveFirst: (items: Result[]) => void = () => {};
    const loader = vi.fn((id: string) =>
      id === 'slow'
        ? new Promise<Result[]>((resolve) => {
            resolveFirst = resolve;
          })
        : Promise.resolve([makeResult({ loinc: '2345-7', value: 2 })])
    );
    await mount(<Harness initial={[makeSession({ file: 'slow', items: null })]} loadGroupItems={loader} />);
    await act(async () => setSessions([makeSession({ file: 'fast', items: null })]));
    await settle();
    expect(latest.allResults.map((e) => e.result.value)).toEqual([2]);
    await act(async () => resolveFirst([makeResult({ loinc: '718-7', value: 1 })]));
    expect(latest.allResults.map((e) => e.result.value)).toEqual([2]);
  });

  it('starts empty and empties again when the sessions are cleared', async () => {
    const sessions = [makeSession({ items: [makeResult({ loinc: '718-7', value: 14 })] })];
    await mount(<Harness initial={sessions} loadGroupItems={neverCalled} />);
    await settle();
    expect(latest.allResults).toHaveLength(1);
    await act(async () => setSessions([]));
    await settle();
    expect(latest.allResults).toEqual([]);
    expect(latest.latestByLoinc).toEqual({});
    expect(latest.resultsByDate).toEqual({});
  });

  it('keeps the newest numeric reading per LOINC, ignoring a text-only one', async () => {
    const sessions = [
      makeSession({ date: '2026-01-10', file: 'a', items: [makeResult({ loinc: '718-7', value: 14 })] }),
      makeSession({ date: '2026-03-02', file: 'b', items: [makeResult({ loinc: '718-7', value: null, rawValue: 'not measured' })] }),
      makeSession({ date: '2026-02-01', file: 'c', items: [makeResult({ loinc: '718-7', value: 15 })] }),
    ];
    await mount(<Harness initial={sessions} loadGroupItems={neverCalled} />);
    await settle();
    expect(latest.latestByLoinc['718-7']!.date).toBe('2026-02-01');
    expect(latest.latestByLoinc['718-7']!.result.value).toBe(15);
  });

  it('indexes every reading by date, then by LOINC', async () => {
    const sessions = [
      makeSession({ date: '2026-01-10', file: 'a', items: [makeResult({ loinc: '718-7', value: 14 }), makeResult({ loinc: '2345-7', value: 5 })] }),
      makeSession({ date: '2026-03-02', file: 'b', items: [makeResult({ loinc: '718-7', value: 15 })] }),
    ];
    await mount(<Harness initial={sessions} loadGroupItems={neverCalled} />);
    await settle();
    expect(Object.keys(latest.resultsByDate).sort()).toEqual(['2026-01-10', '2026-03-02']);
    expect(latest.resultsByDate['2026-01-10']!['2345-7']!.value).toBe(5);
    expect(latest.resultsByDate['2026-03-02']!['718-7']!.value).toBe(15);
    expect(latest.resultsByDate['2026-03-02']!['2345-7']).toBeUndefined();
  });
});
