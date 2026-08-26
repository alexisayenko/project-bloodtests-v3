import { describe, it, expect, beforeEach } from 'vitest';
import { importResults, replaceStoredSessions } from '../src/data/importResults';
import { RESULTS_STORAGE_KEY } from '../src/data/resultsStorage';
import { UploadParseError } from '../src/data/parseUpload';
import type { ResultGroup } from '../src/types';

function installLocalStorageStub(): void {
  const store = new Map<string, string>();
  const stub = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: stub, configurable: true, writable: true });
}

const stored = (): ResultGroup[] => JSON.parse(localStorage.getItem(RESULTS_STORAGE_KEY) ?? '[]');

const FIRST = [{ date: '2026-01-10', place: 'Lab A', loinc: '718-7', value: 14.2, unit: 'g/dL' }];
const SECOND = [{ date: '2025-06-01', place: 'Lab B', loinc: '2339-0', value: 95, unit: 'mg/dL' }];

describe('importResults', () => {
  beforeEach(() => {
    installLocalStorageStub();
  });

  it('replaces prior sessions instead of merging them', () => {
    importResults(FIRST);
    expect(stored().map((g) => g.file)).toEqual(['2026-01-10__lab-a']);

    const after = importResults(SECOND);
    expect(after.map((g) => g.file)).toEqual(['2025-06-01__lab-b']);
    expect(stored().map((g) => g.file)).toEqual(['2025-06-01__lab-b']);
  });

  it('replaces via the share-link path the same way', () => {
    importResults(FIRST);
    const shared = [{ date: '2024-02-02', place: 'Shared', items: [{ loinc: '718-7', value: 13 }] }];
    importResults(shared);
    expect(stored().map((g) => g.file)).toEqual(['2024-02-02__shared']);
  });

  it('leaves stored sessions untouched when parsing fails', () => {
    importResults(FIRST);
    const before = localStorage.getItem(RESULTS_STORAGE_KEY);
    expect(() => importResults({ not: 'an array' })).toThrow(UploadParseError);
    expect(localStorage.getItem(RESULTS_STORAGE_KEY)).toBe(before);
  });

  it('keeps every session of the incoming file, newest first', () => {
    const groups = importResults([...FIRST, ...SECOND]);
    expect(groups.map((g) => g.date)).toEqual(['2026-01-10', '2025-06-01']);
  });
});

describe('replaceStoredSessions', () => {
  beforeEach(() => {
    installLocalStorageStub();
  });

  it('writes an empty set when given no sessions', () => {
    importResults(FIRST);
    expect(replaceStoredSessions([])).toEqual([]);
    expect(stored()).toEqual([]);
  });
});
