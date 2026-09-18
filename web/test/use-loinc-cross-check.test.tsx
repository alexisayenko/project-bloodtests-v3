// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useLoincCrossCheck, type LoincCrossCheck } from '../src/components/conditions/useLoincCrossCheck';
import type { NlmLookupResult } from '../src/data/loincNlm';
import type { Analysis, Result } from '../src/types';

const catalog: Record<string, Analysis> = {
  '2345-7': {
    loinc: '2345-7',
    longCommonName: 'Glucose [Mass/volume] in Serum or Plasma',
    friendlyName: 'Glucose',
    lang: { 'ru-RU': 'Глюкоза' },
  },
  '2093-3': {
    loinc: '2093-3',
    longCommonName: 'Cholesterol [Mass/volume] in Serum or Plasma',
    friendlyName: 'Total Cholesterol',
    lang: {},
  },
  '718-7': {
    loinc: '718-7',
    longCommonName: 'Hemoglobin [Mass/volume] in Blood',
    friendlyName: 'Hemoglobin',
    lang: {},
  },
};

vi.mock('../src/data/DataContext', () => ({
  useData: () => ({ analysesCatalog: catalog, panels: [], monitoringPanels: [], loading: false }),
}));

const fetchNlmLoinc = vi.fn<(codes: string[], names: string[]) => Promise<NlmLookupResult>>();

vi.mock('../src/data/loincNlm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/data/loincNlm')>()),
  fetchNlmLoinc: (codes: string[], names: string[]) => fetchNlmLoinc(codes, names),
}));

const result = (overrides: Partial<Result>): Result => ({
  loinc: '',
  rawName: 'Glucose',
  section: '',
  value: 90,
  rawValue: '90',
  valueQualifier: '',
  unit: 'mg/dL',
  refText: '',
  refMin: null,
  refMax: null,
  method: '',
  ...overrides,
});

let latest: LoincCrossCheck;
let draft: Result[];
let root: Root | null = null;
let container: HTMLDivElement;

function Harness({ initial }: Readonly<{ initial: Result[] }>) {
  const [items, setItems] = useState(initial);
  const check = useLoincCrossCheck(items, setItems);
  useEffect(() => {
    draft = items;
    latest = check;
  });
  return null;
}

async function mount(items: Result[]): Promise<void> {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<Harness initial={items} />);
  });
}

const crossCheck = () => act(async () => latest.onCrossCheck());
const nlmCheck = () => act(async () => latest.onNlmCheck());

beforeEach(() => {
  fetchNlmLoinc.mockReset();
  fetchNlmLoinc.mockResolvedValue({ status: 'ok', byCode: {}, byName: {} });
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container.remove();
});

describe('useLoincCrossCheck', () => {
  it('has nothing to report before a check is run', async () => {
    await mount([result({})]);
    expect(latest.checkResults).toBeNull();
    expect(latest.unresolvedRows).toEqual([]);
    expect(latest.nlmState).toBe('idle');
  });

  it('fills a confident derivation straight into the draft and counts it', async () => {
    const original = [result({ loinc: '', rawName: 'Glucose' })];
    await mount(original);
    await crossCheck();
    expect(draft[0]!.loinc).toBe('2345-7');
    expect(draft[0]!.value).toBe(90);
    expect(draft[0]!.unit).toBe('mg/dL');
    expect(latest.autoFilledCount).toBe(1);
    expect(latest.checkResults?.[0]?.status).toBe('match');
  });

  it('leaves a row whose printed code already agrees untouched', async () => {
    const original = [result({ loinc: '2345-7', rawName: 'Glucose' })];
    await mount(original);
    await crossCheck();
    expect(draft).toBe(original);
    expect(latest.autoFilledCount).toBe(0);
    expect(latest.checkResults?.[0]?.status).toBe('match');
    expect(latest.unresolvedRows).toEqual([]);
  });

  it('lists an unknown code and an unresolvable codeless name as unresolved', async () => {
    await mount([
      result({ loinc: '99999-9', rawName: 'Xyzzy' }),
      result({ loinc: '', rawName: 'Xyzzy' }),
      result({ loinc: '2093-3', rawName: 'Total Cholesterol' }),
    ]);
    await crossCheck();
    expect(latest.checkResults?.map((r) => r.status)).toEqual(['unknown-code', 'no-code', 'match']);
    expect(latest.unresolvedRows.map(({ i }) => i)).toEqual([0, 1]);
  });

  it('sends only the unresolved codes and Latin names to NLM, never a value', async () => {
    await mount([
      result({ loinc: '99999-9', rawName: 'Xyzzy', value: 12345 }),
      result({ loinc: '', rawName: 'Абвгд Xyzzy', value: 6789 }),
      result({ loinc: '', rawName: 'Glucose' }),
    ]);
    await crossCheck();
    await nlmCheck();
    expect(fetchNlmLoinc).toHaveBeenCalledTimes(1);
    expect(fetchNlmLoinc.mock.calls[0]).toEqual([['99999-9'], ['Xyzzy']]);
    expect(JSON.stringify(fetchNlmLoinc.mock.calls[0])).not.toMatch(/12345|6789/);
  });

  it('resolves rows from what NLM returns and marks the lookup done', async () => {
    fetchNlmLoinc.mockResolvedValue({
      status: 'ok',
      byCode: { '99999-9': 'Some Analyte [Mass/volume] in Serum' },
      byName: { Xyzzy: [{ loinc: '11111-1', name: 'Xyzzy [Mass/volume] in Serum', unit: 'mg/dL' }] },
    });
    await mount([result({ loinc: '99999-9', rawName: 'Xyzzy' }), result({ loinc: '', rawName: 'Xyzzy' })]);
    await crossCheck();
    await nlmCheck();
    expect(latest.nlmState).toBe('done');
    expect(latest.nlmByCode['99999-9']).toBe('Some Analyte [Mass/volume] in Serum');
    expect(latest.nlmSuggestions[1]?.[0]?.loinc).toBe('11111-1');
    expect(latest.unresolvedRows).toEqual([]);
  });

  it('reports a failed lookup and keeps the rows unresolved', async () => {
    fetchNlmLoinc.mockResolvedValue({ status: 'failed', byCode: {}, byName: {} });
    await mount([result({ loinc: '99999-9', rawName: 'Xyzzy' })]);
    await crossCheck();
    await nlmCheck();
    expect(latest.nlmState).toBe('failed');
    expect(latest.unresolvedRows).toHaveLength(1);
  });

  it('forgets the previous NLM answers when the check is run again', async () => {
    fetchNlmLoinc.mockResolvedValue({ status: 'ok', byCode: { '99999-9': 'Some Analyte' }, byName: {} });
    await mount([result({ loinc: '99999-9', rawName: 'Xyzzy' })]);
    await crossCheck();
    await nlmCheck();
    expect(latest.unresolvedRows).toEqual([]);
    await crossCheck();
    expect(latest.nlmState).toBe('idle');
    expect(latest.nlmByCode).toEqual({});
    expect(latest.unresolvedRows).toHaveLength(1);
  });

  it('does nothing without items or before a local check', async () => {
    await mount([result({ loinc: '99999-9', rawName: 'Xyzzy' })]);
    await nlmCheck();
    expect(fetchNlmLoinc).not.toHaveBeenCalled();
    expect(latest.nlmState).toBe('idle');
  });
});
