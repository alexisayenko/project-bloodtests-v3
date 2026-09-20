import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { backupFilename, buildBackupFiles, zipBackupFiles, type StorageReader } from '../src/data/backupArchive';
import type { DiagnosticReport } from '../src/types';
import { makeResult, makeSession } from './helpers/fixtures';

const NOW = new Date('2026-09-10T08:30:00Z');
const APP = { commit: 'abc1234', builtAt: '2026-09-10T08:00:00Z' };
const REPORT = 'reports/2026-08-26__quest.json';
const FILES = [
  'manifest.json',
  REPORT,
  'medications.json',
  'scheduled-visits.json',
  'settings.json',
];

function fakeStorage(entries: Record<string, string>): StorageReader {
  const keys = Object.keys(entries);
  return {
    get length() {
      return keys.length;
    },
    key: (i) => keys[i] ?? null,
    getItem: (key) => entries[key] ?? null,
  };
}

const session = makeSession({ items: [makeResult({ loinc: '2093-3', rawName: 'Total Cholesterol', value: 186, unit: 'mg/dL', refMax: 200 })] });

function unzip(storage: StorageReader, sessions: DiagnosticReport[]) {
  const files = buildBackupFiles({ sessions, storage, app: APP, now: NOW });
  const zip = zipBackupFiles(files, { zipSync, strToU8 });
  const entries = unzipSync(zip);
  return Object.fromEntries(Object.entries(entries).map(([name, bytes]) => [name, JSON.parse(strFromU8(bytes)) as unknown]));
}

describe('buildBackupFiles', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('zips every file with its stored content', () => {
    const medications = {
      years: [2025, 2026],
      rows: [{ id: 'm1', brand: 'Vitamin D', compounds: [], notes: '2000 IU', months: ['2026-01'] }],
    };
    const scheduled = { visits: [{ id: 'v1', loincs: ['2093-3'], indices: ['homair'], month: '2026-10' }] };
    const storage = fakeStorage({
      bloodtests_medications_v1: JSON.stringify(medications),
      bloodtests_scheduled_v1: JSON.stringify(scheduled),
      bloodtests_view_settings_v1: JSON.stringify({ unitSystem: 'us', sampleLimit: 'all' }),
      'exploreSel:Lipids': JSON.stringify(['ldl', 'hdl']),
      'hpgAutoscale:all': '1',
      'exploreEv:all:meds': '0',
      bloodtests_shared_meta_v1: JSON.stringify({ showPanels: ['Lipids'] }),
      bloodtests_lang: 'en',
    });

    const unzipped = unzip(storage, [session]);

    expect(Object.keys(unzipped).sort()).toEqual([...FILES].sort());
    expect(unzipped['manifest.json']).toEqual({
      format: 'blood-tests-backup',
      version: 1,
      exportedAt: NOW.toISOString(),
      app: APP,
      files: FILES.slice(1),
    });
    expect(unzipped[REPORT]).toMatchObject({
      schema: '3.2',
      lastUpdatedDate: NOW.toISOString(),
      diagnosticReports: [{ lab: session.place, observations: [{ loinc: '2093-3', rawName: 'Total Cholesterol', value: 186, rawUnit: 'mg/dL' }] }],
    });
    expect(unzipped[REPORT]).not.toHaveProperty('generatedAt');
    expect(unzipped['medications.json']).toEqual(medications);
    expect(unzipped['scheduled-visits.json']).toEqual(scheduled);
    expect(unzipped).not.toHaveProperty('laboratory-prices.json');
    expect(unzipped['settings.json']).toEqual({
      bloodtests_view_settings_v1: { unitSystem: 'us', sampleLimit: 'all' },
      'exploreEv:all:meds': '0',
      'exploreSel:Lipids': ['ldl', 'hdl'],
      'hpgAutoscale:all': '1',
    });
  });

  it('exports an empty database as a bare manifest', () => {
    const unzipped = unzip(fakeStorage({}), []);

    expect(Object.keys(unzipped)).toEqual(['manifest.json']);
    expect((unzipped['manifest.json'] as { files: string[] }).files).toEqual([]);
  });

  it('writes the file of a session that has none once, with no unit derived from rawUnit', () => {
    const unzipped = unzip(fakeStorage({}), [session]);

    const observation = (unzipped[REPORT] as { diagnosticReports: { observations: Record<string, unknown>[] }[] }).diagnosticReports[0]!.observations[0]!;
    expect(observation).not.toHaveProperty('unit');
    expect(observation.rawUnit).toBe('mg/dL');
  });
});

describe('backupFilename', () => {
  it('stamps the UTC date', () => {
    expect(backupFilename(NOW)).toBe('blood-tests-backup-20260910.zip');
  });
});
