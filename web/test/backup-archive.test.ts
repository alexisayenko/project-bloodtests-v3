import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { backupFilename, buildBackupFiles, zipBackupFiles, type StorageReader } from '../src/data/backupArchive';
import { buildExportEnvelope } from '../src/utils/exportData';
import laboratories from '../public/data/laboratories.json';
import type { DiagnosticReport, Result } from '../src/types';

const NOW = new Date('2026-09-10T08:30:00Z');
const APP = { commit: 'abc1234', builtAt: '2026-09-10T08:00:00Z' };
const FILES = [
  'manifest.json',
  'lab-reports.json',
  'medications.json',
  'scheduled-visits.json',
  'laboratory-prices.json',
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

const result: Result = {
  loinc: '2093-3',
  rawName: 'Total Cholesterol',
    section: '',
  value: 186,
  rawValue: '186',
  valueQualifier: '',
  unit: 'mg/dL',
  refText: '',
  refMin: null,
  refMax: 200,
  method: '',
};
const session: DiagnosticReport = { date: '2026-08-26', place: 'Quest', file: 'quest_2026-08-26', items: [result], itemCount: 1 };

async function unzip(storage: StorageReader, sessions: DiagnosticReport[]) {
  const files = await buildBackupFiles({ sessions, meta: { subject: 'Alex' }, storage, app: APP, now: NOW });
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

  it('zips every file with its stored content', async () => {
    const medications = { years: [2025, 2026], rows: [{ id: 'm1', name: 'Vitamin D', dosage: '2000 IU', months: ['2026-01'] }] };
    const scheduled = { loincs: ['2093-3'], indices: ['homair'], month: '2026-10', lab: 'esculab' };
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

    const unzipped = await unzip(storage, [session]);

    expect(Object.keys(unzipped).sort()).toEqual([...FILES].sort());
    expect(unzipped['manifest.json']).toEqual({
      format: 'blood-tests-backup',
      version: 1,
      exportedAt: NOW.toISOString(),
      app: APP,
      files: FILES.slice(1),
    });
    expect(unzipped['lab-reports.json']).toEqual(await buildExportEnvelope([session], { subject: 'Alex' }));
    expect(unzipped['medications.json']).toEqual(medications);
    expect(unzipped['scheduled-visits.json']).toEqual(scheduled);
    expect(unzipped['laboratory-prices.json']).toEqual(laboratories);
    expect(unzipped['settings.json']).toEqual({
      bloodtests_view_settings_v1: { unitSystem: 'us', sampleLimit: 'all' },
      'exploreEv:all:meds': '0',
      'exploreSel:Lipids': ['ldl', 'hdl'],
      'hpgAutoscale:all': '1',
    });
  });

  it('exports an empty database', async () => {
    const unzipped = await unzip(fakeStorage({}), []);

    expect(Object.keys(unzipped).sort()).toEqual([...FILES].sort());
    expect((unzipped['lab-reports.json'] as { diagnosticReports: unknown[] }).diagnosticReports).toEqual([]);
    expect(unzipped['medications.json']).toEqual({ years: [2026], rows: [] });
    expect(unzipped['scheduled-visits.json']).toEqual({ loincs: [], indices: [] });
    expect(unzipped['settings.json']).toEqual({});
  });
});

describe('backupFilename', () => {
  it('stamps the UTC date', () => {
    expect(backupFilename(NOW)).toBe('blood-tests-backup-20260910.zip');
  });
});
