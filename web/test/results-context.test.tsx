// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ResultsProvider, useResultsContext } from '../src/data/ResultsContext';
import { storeSharedMeta, loadStoredSharedMeta, SHARED_META_KEY } from '../src/data/sharedMeta';
import { RESULTS_STORAGE_KEY } from '../src/data/storage/resultsStorage';
import type { DiagnosticReport } from '../src/types';
import { makeEnvelope as envelope, makeReport, makeSession } from './helpers/fixtures';
import { installMemoryStorage } from './helpers/storage';

type Ctx = ReturnType<typeof useResultsContext>;

const report = (lab: string, date: string, loinc: string, rawName: string, value: number) =>
  makeReport({ lab, collectedAt: `${date}T00:00:00Z`, observations: [{ loinc, rawName, value }] });

const FIRST = envelope(report('Lab A', '2026-01-10', '718-7', 'Hemoglobin', 14.2));
const SECOND = envelope(report('Lab B', '2025-06-01', '2339-0', 'Glucose', 95));

const GENERATED: DiagnosticReport[] = [makeSession({ date: '2024-03-03', place: 'Generated', file: '2024-03-03__generated' })];

function fileOf(json: unknown): File {
  return { text: async () => JSON.stringify(json) } as unknown as File;
}

let ctx: Ctx;
let root: Root | null = null;

function Probe() {
  const value = useResultsContext();
  useEffect(() => {
    ctx = value;
  });
  return null;
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function mountProvider(): Promise<void> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(
      <ResultsProvider>
        <Probe />
      </ResultsProvider>
    );
  });
  await flush();
}

function setSearch(search: string): void {
  window.history.replaceState(null, '', `/${search}`);
}

describe('ResultsContext keeps a share link\'s meta from outliving its link', () => {
  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    installMemoryStorage();
    setSearch('');
  });

  afterEach(async () => {
    if (root) {
      const r = root;
      root = null;
      await act(async () => r.unmount());
    }
    vi.unstubAllGlobals();
  });

  it('drops a stored allowlist when an Import JSON replaces the data', async () => {
    storeSharedMeta({ showPanels: ['FBC'] });
    await mountProvider();
    expect(ctx.sharedMeta).toEqual({ showPanels: ['FBC'] });

    // This must fail if uploadFile stops calling clearSharedMeta: that missing
    // call is the 2026-09-08 bug, where one link went on hiding panels forever.
    await act(async () => {
      await ctx.uploadFile(fileOf(SECOND));
    });

    expect(localStorage.getItem(SHARED_META_KEY)).toBeNull();
    expect(loadStoredSharedMeta()).toBeNull();
    expect(ctx.sharedMeta).toBeNull();
    expect(ctx.sessions.map((s) => s.file)).toEqual(['2025-06-01__lab-b']);
  });

  it('keeps the allowlist when the imported file is not a valid envelope', async () => {
    storeSharedMeta({ showPanels: ['FBC'] });
    await mountProvider();

    await act(async () => {
      await ctx.uploadFile(fileOf({ not: 'an envelope' }));
    });

    expect(ctx.error).toBeTruthy();
    expect(loadStoredSharedMeta()).toEqual({ showPanels: ['FBC'] });
  });

  it('drops the allowlist on Clear', async () => {
    storeSharedMeta({ showPanels: ['FBC'] });
    await mountProvider();

    await act(async () => ctx.clearData());

    expect(loadStoredSharedMeta()).toBeNull();
    expect(ctx.sharedMeta).toBeNull();
    expect(localStorage.getItem(RESULTS_STORAGE_KEY)).toBeNull();
  });

  it('keeps the allowlist through a merge, which replaces nothing', async () => {
    storeSharedMeta({ showPanels: ['FBC'] });
    await mountProvider();

    await act(async () => ctx.loadGenerated(GENERATED));

    expect(loadStoredSharedMeta()).toEqual({ showPanels: ['FBC'] });
    expect(ctx.sharedMeta).toEqual({ showPanels: ['FBC'] });
    expect(ctx.sessions.map((s) => s.file)).toEqual(['2024-03-03__generated']);
  });

  it('ends a share-link visit with the meta that link supplied', async () => {
    const guid = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
    storeSharedMeta({ showPanels: ['FBC'] });
    setSearch(`?data=${guid}`);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      status: 200,
      json: async () => (url.endsWith('.meta.json') ? { showPanels: ['Anemia'] } : FIRST),
    })));

    await mountProvider();

    expect(loadStoredSharedMeta()).toEqual({ showPanels: ['Anemia'] });
    expect(ctx.sharedMeta).toEqual({ showPanels: ['Anemia'] });
    expect(ctx.sessions.map((s) => s.file)).toEqual(['2026-01-10__lab-a']);
    expect(window.location.search).toBe('');
  });

  it('ends a share-link visit with no meta when that link carries none', async () => {
    const guid = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
    storeSharedMeta({ showPanels: ['FBC'] });
    setSearch(`?data=${guid}`);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => (
      url.endsWith('.meta.json')
        ? { ok: false, status: 404, json: async () => ({}) }
        : { ok: true, status: 200, json: async () => FIRST }
    )));

    await mountProvider();

    expect(loadStoredSharedMeta()).toBeNull();
    expect(ctx.sharedMeta).toBeNull();
    expect(ctx.sessions.map((s) => s.file)).toEqual(['2026-01-10__lab-a']);
  });
});
