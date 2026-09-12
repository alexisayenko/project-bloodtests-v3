import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { buildBackupFiles, isUserDataKey, USER_DATA_KEYS, zipBackupFiles, type StorageReader } from '../src/data/backupArchive';
import { BackupImportError, clearAllData, readBackup, restoreBackup, unzipBackup } from '../src/data/backupRestore';
import { ENVELOPE_META_KEY, loadEnvelopeMeta } from '../src/data/envelopeMeta';
import { importResults } from '../src/data/importResults';
import { loadMedications, MEDICATIONS_KEY } from '../src/data/medications';
import { RESULTS_STORAGE_KEY } from '../src/data/resultsStorage';
import { IMPORTED_LINKS_KEY } from '../src/data/sharedLink';
import { SHARED_META_KEY } from '../src/data/sharedMeta';
import { loadScheduled, SCHEDULED_KEY } from '../src/components/conditions/scheduled';
import { VIEW_SETTINGS_KEY } from '../src/components/conditions/ui';
import type { DiagnosticReport, Result } from '../src/types';

const NOW = new Date('2026-09-10T08:30:00Z');
const APP = { commit: 'abc1234', builtAt: '2026-09-10T08:00:00Z' };

const MEDICATIONS = {
  years: [2025, 2026],
  rows: [{ id: 'm1', brand: 'Vitamin D', compounds: [], notes: '2000 IU', months: ['2026-01'] }],
};
const SCHEDULED = { loincs: ['2093-3'], indices: ['homair'], month: '2026-10' };
// Stored while the schedule still carried a laboratory: it must restore all the same, without it.
const STORED_SCHEDULED = { ...SCHEDULED, lab: 'esculab' };
const SETTINGS = {
  [VIEW_SETTINGS_KEY]: JSON.stringify({ unitSystem: 'us', sampleLimit: 'all', compactPanels: true, medsCurrentYearOnly: false }),
  'exploreSel:Lipids': JSON.stringify(['ldl', 'hdl']),
  'hpgAutoscale:all': '1',
  'exploreEv:all:meds': '0',
};

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

const store = new Map<string, string>();

function seed() {
  store.set(RESULTS_STORAGE_KEY, JSON.stringify([session]));
  store.set(ENVELOPE_META_KEY, JSON.stringify({ subject: 'Alex' }));
  store.set(MEDICATIONS_KEY, JSON.stringify(MEDICATIONS));
  store.set(SCHEDULED_KEY, JSON.stringify(STORED_SCHEDULED));
  store.set(SHARED_META_KEY, JSON.stringify({ showPanels: ['Lipids'] }));
  store.set(IMPORTED_LINKS_KEY, JSON.stringify(['guid-1']));
  store.set('bloodtests_lang', 'en');
  for (const [key, value] of Object.entries(SETTINGS)) store.set(key, value);
}

async function exportZip(): Promise<Record<string, string>> {
  const files = await buildBackupFiles({ sessions: [session], meta: { subject: 'Alex' }, storage: localStorage, app: APP, now: NOW });
  return unzipBackup(zipBackupFiles(files, { zipSync, strToU8 }), { unzipSync, strFromU8 });
}

const deps = {
  clearReports: () => localStorage.removeItem(RESULTS_STORAGE_KEY),
  importReports: (text: string) => void importResults(JSON.parse(text)),
};

function without(files: Record<string, string>, ...names: string[]): Record<string, string> {
  return Object.fromEntries(Object.entries(files).filter(([name]) => !names.includes(name)));
}

async function importFiles(files: Record<string, string>) {
  const backup = readBackup(files);
  return restoreBackup(backup, deps);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  store.clear();
  vi.stubGlobal('localStorage', {
    get length() {
      return store.size;
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('restoreBackup', () => {
  it('round-trips an export: reports, medications, schedule and settings come back, link state does not', async () => {
    seed();
    const files = await exportZip();
    store.clear();
    store.set(MEDICATIONS_KEY, JSON.stringify({ years: [2026], rows: [{ id: 'x', name: 'Other', dosage: '', months: [] }] }));
    store.set(SHARED_META_KEY, JSON.stringify({ showPanels: ['Thyroid'] }));

    const lines = await importFiles(files);

    expect(loadMedications()).toEqual(MEDICATIONS);
    expect(loadScheduled()).toEqual(SCHEDULED);
    for (const [key, value] of Object.entries(SETTINGS)) expect(store.get(key)).toBe(value);
    expect((JSON.parse(store.get(RESULTS_STORAGE_KEY)!) as DiagnosticReport[]).map((s) => s.date)).toEqual([session.date]);
    expect(loadEnvelopeMeta().subject).toBe('Alex');
    expect(store.has(SHARED_META_KEY)).toBe(false);
    expect(lines).toContain('Lab reports: 1 report restored.');
    expect(lines).toContain('Scheduled visits: 1 observation and 1 index restored.');
    expect(lines).toContain('Laboratory prices: not restored; the prices that ship with the app are used.');
  });

  it('leaves a part missing from the zip empty', async () => {
    seed();
    const files = without(await exportZip(), 'medications.json', 'settings.json');

    const lines = await importFiles(files);

    expect(store.has(MEDICATIONS_KEY)).toBe(false);
    expect(loadMedications()).toEqual({ years: [2026], rows: [] });
    for (const key of Object.keys(SETTINGS)) expect(store.has(key)).toBe(false);
    expect(lines).toContain('Medications: not in the backup, left empty.');
    expect(loadScheduled()).toEqual(SCHEDULED);
  });

  it('reports one line per part, in order, for a backup holding only its manifest', async () => {
    seed();
    const files = without(await exportZip(), 'lab-reports.json', 'medications.json', 'scheduled-visits.json', 'settings.json', 'laboratory-prices.json');

    const lines = await importFiles(files);

    expect(lines).toEqual([
      'Lab reports: not in the backup, left empty.',
      'Medications: not in the backup, left empty.',
      'Scheduled visits: not in the backup, left empty.',
      'Settings: not in the backup, left at defaults.',
      'Laboratory prices: ship with the app, nothing to restore.',
    ]);
    expect(store.has(RESULTS_STORAGE_KEY)).toBe(false);
    expect(store.has(SCHEDULED_KEY)).toBe(false);
  });

  it('restores an exported empty database', async () => {
    const files = await exportZip().then((f) => ({ ...f, 'lab-reports.json': JSON.stringify({ schema: '3.1', diagnosticReports: [] }) }));
    seed();

    const lines = await importFiles(files);

    expect(store.has(RESULTS_STORAGE_KEY)).toBe(false);
    expect(lines).toContain('Lab reports: 0 reports restored.');
  });

  it('restores an older backup whose schedule still carries a laboratory, and stores it without one', async () => {
    seed();
    const files = { ...(await exportZip()), 'scheduled-visits.json': JSON.stringify(STORED_SCHEDULED) };

    await importFiles(files);

    expect(loadScheduled()).toEqual(SCHEDULED);
    expect(JSON.parse(store.get(SCHEDULED_KEY)!)).toEqual(SCHEDULED);
  });
});

describe('readBackup rejects and nothing is cleared', () => {
  async function expectRejected(files: Record<string, string>) {
    seed();
    const before = new Map(store);
    await expect(importFiles(files)).rejects.toBeInstanceOf(BackupImportError);
    expect(store).toEqual(before);
  }

  it('a missing manifest', async () => {
    await expectRejected(without(await exportZip(), 'manifest.json'));
  });

  it.each([
    ['another format', { format: 'something-else', version: 1, files: [] }],
    ['another version', { format: 'blood-tests-backup', version: 2, files: [] }],
    ['not an object', ['blood-tests-backup']],
  ])('a manifest with %s', async (_label, manifest) => {
    await expectRejected({ ...(await exportZip()), 'manifest.json': JSON.stringify(manifest) });
  });

  it.each([
    ['medications.json', '{"years": [2026], "rows": ['],
    ['scheduled-visits.json', 'not json'],
    ['settings.json', '{'],
    ['lab-reports.json', '{"schema": "3.1", "diagnosticReports": [{}'],
    ['laboratory-prices.json', '['],
  ])('malformed JSON in %s', async (name, text) => {
    await expectRejected({ ...(await exportZip()), [name]: text });
  });

  it.each([
    ['medications.json', '[]'],
    ['scheduled-visits.json', '{"loincs": []}'],
    ['settings.json', '{"bloodtests_lang": "en"}'],
    ['lab-reports.json', '{"schema": 1, "diagnosticReports": []}'],
  ])('a %s of the wrong shape', async (name, text) => {
    await expectRejected({ ...(await exportZip()), [name]: text });
  });

  it('bytes that are not a zip', () => {
    expect(() => unzipBackup(strToU8('not a zip'), { unzipSync, strFromU8 })).toThrow(BackupImportError);
  });
});

describe('clearAllData', () => {
  it('removes every listed key and chart preference, runs the reports Clear, and leaves other keys', () => {
    seed();
    const clearReports = vi.fn();

    clearAllData(clearReports);

    expect(clearReports).toHaveBeenCalledOnce();
    for (const key of USER_DATA_KEYS) expect(store.has(key)).toBe(false);
    for (const key of Object.keys(SETTINGS)) expect(store.has(key)).toBe(false);
    expect([...store.keys()]).toEqual(['bloodtests_lang']);
  });

  it('covers every key the export reads', async () => {
    seed();
    const read = new Set<string>();
    const recording: StorageReader = {
      get length() {
        return store.size;
      },
      key: (i) => [...store.keys()][i] ?? null,
      getItem: (key) => {
        read.add(key);
        return store.get(key) ?? null;
      },
    };

    await buildBackupFiles({ sessions: [session], storage: recording, app: APP, now: NOW });

    expect(read.size).toBeGreaterThan(0);
    for (const key of read) expect(isUserDataKey(key)).toBe(true);
    expect(USER_DATA_KEYS).toEqual(expect.arrayContaining([RESULTS_STORAGE_KEY, ENVELOPE_META_KEY]));
  });
});
