import { describe, it, expect, beforeEach } from 'vitest';
import { clearStoredResults, importResults } from '../src/data/importResults';
import { loadHeldFiles } from '../src/data/storage/heldFiles';
import { RESULTS_STORAGE_KEY } from '../src/data/storage/resultsStorage';
import { UploadParseError } from '../src/data/parseUpload';
import type { DiagnosticReport } from '../src/types';
import { makeEnvelope as envelope, makeReport } from './helpers/fixtures';
import { installMemoryStorage } from './helpers/storage';

const stored = (): DiagnosticReport[] => JSON.parse(localStorage.getItem(RESULTS_STORAGE_KEY) ?? '[]');

const report = (lab: string, date: string, loinc: string, rawName: string, value: number) =>
  makeReport({ lab, collectedAt: `${date}T00:00:00Z`, observations: [{ loinc, rawName, value }] });

const FIRST = envelope(report('Lab A', '2026-01-10', '718-7', 'Hemoglobin', 14.2));
const SECOND = envelope(report('Lab B', '2025-06-01', '2339-0', 'Glucose', 95));

describe('importResults', () => {
  beforeEach(() => {
    installMemoryStorage();
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
    importResults(envelope(report('Shared', '2024-02-02', '718-7', 'Hemoglobin', 13)));
    expect(stored().map((g) => g.file)).toEqual(['2024-02-02__shared']);
  });

  it('leaves stored sessions untouched when parsing fails', () => {
    importResults(FIRST);
    const before = localStorage.getItem(RESULTS_STORAGE_KEY);
    expect(() => importResults({ not: 'an array' })).toThrow(UploadParseError);
    expect(localStorage.getItem(RESULTS_STORAGE_KEY)).toBe(before);
  });

  it('keeps every session of the incoming file, newest first', () => {
    const groups = importResults(
      envelope(
        report('Lab A', '2026-01-10', '718-7', 'Hemoglobin', 14.2),
        report('Lab B', '2025-06-01', '2339-0', 'Glucose', 95)
      )
    );
    expect(groups.map((g) => g.date)).toEqual(['2026-01-10', '2025-06-01']);
  });
});

describe('clearStoredResults', () => {
  beforeEach(() => {
    installMemoryStorage();
  });

  it('removes the sessions and the held files behind them', () => {
    importResults(FIRST);
    clearStoredResults();
    expect(localStorage.getItem(RESULTS_STORAGE_KEY)).toBeNull();
    expect(loadHeldFiles().reports).toEqual({});
  });
});
