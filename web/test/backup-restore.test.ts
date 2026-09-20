import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { buildBackupFiles, isUserDataKey, USER_DATA_KEYS, zipBackupFiles, type StorageReader } from '../src/data/backupArchive';
import { BackupImportError, clearAllData, readBackup, restoreBackup, unzipBackup } from '../src/data/backupRestore';
import { ENVELOPE_META_KEY, loadEnvelopeMeta } from '../src/data/envelopeMeta';
import { replaceReportFiles } from '../src/data/importResults';
import { loadMedications, MEDICATIONS_KEY } from '../src/data/storage/medications';
import { RESULTS_STORAGE_KEY } from '../src/data/storage/resultsStorage';
import { IMPORTED_LINKS_KEY } from '../src/data/sharedLink';
import { SHARED_META_KEY } from '../src/data/sharedMeta';
import { loadScheduled, SCHEDULED_KEY } from '../src/data/storage/scheduledVisits';
import { VIEW_SETTINGS_KEY } from '../src/data/storage/viewSettings';
import type { DiagnosticReport } from '../src/types';
import { makeResult, makeSession } from './helpers/fixtures';
import { installMemoryStorage } from './helpers/storage';

const NOW = new Date('2026-09-10T08:30:00Z');
const APP = { commit: 'abc1234', builtAt: '2026-09-10T08:00:00Z' };

const MEDICATIONS = {
  years: [2025, 2026],
  rows: [{ id: 'm1', brand: 'Vitamin D', compounds: [], notes: '2000 IU', months: ['2026-01'] }],
};
const SCHEDULED = { visits: [{ id: 'v1', loincs: ['2093-3'], indices: ['homair'], month: '2026-10' }] };
// Stored while the schedule still carried a laboratory: it must restore all the same, without it.
const STORED_SCHEDULED = { visits: [{ ...SCHEDULED.visits[0], lab: 'esculab' }] };
// Stored before multiple visits existed: the pre-redesign single-schedule shape, migrated on restore into one visit.
const LEGACY_STORED_SCHEDULED = { loincs: ['2093-3'], indices: ['homair'], month: '2026-10' };
const SETTINGS = {
  [VIEW_SETTINGS_KEY]: JSON.stringify({ unitSystem: 'us', sampleLimit: 'all', compactPanels: true }),
  'exploreSel:Lipids': JSON.stringify(['ldl', 'hdl']),
  'hpgAutoscale:all': '1',
  'exploreEv:all:meds': '0',
};

const session = makeSession({ items: [makeResult({ loinc: '2093-3', rawName: 'Total Cholesterol', value: 186, unit: 'mg/dL', refMax: 200 })] });

let store: Map<string, string>;

function seed() {
  store.set(RESULTS_STORAGE_KEY, JSON.stringify([session]));
  store.set(ENVELOPE_META_KEY, JSON.stringify({ sex: 'female' }));
  store.set(MEDICATIONS_KEY, JSON.stringify(MEDICATIONS));
  store.set(SCHEDULED_KEY, JSON.stringify(STORED_SCHEDULED));
  store.set(SHARED_META_KEY, JSON.stringify({ showPanels: ['Lipids'] }));
  store.set(IMPORTED_LINKS_KEY, JSON.stringify(['guid-1']));
  store.set('bloodtests_lang', 'en');
  for (const [key, value] of Object.entries(SETTINGS)) store.set(key, value);
}

const REPORT = 'reports/2026-08-26__quest.json';

function exportZip(): Record<string, string> {
  const files = buildBackupFiles({ sessions: [session], storage: localStorage, app: APP, now: NOW });
  return unzipBackup(zipBackupFiles(files, { zipSync, strToU8 }), { unzipSync, strFromU8 });
}

const deps = {
  clearReports: () => localStorage.removeItem(RESULTS_STORAGE_KEY),
  importReports: (files: Record<string, string>) => void replaceReportFiles(files, NOW),
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
  store = installMemoryStorage();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('restoreBackup', () => {
  it('round-trips an export: reports, medications, schedule and settings come back, link state does not', async () => {
    seed();
    const files = exportZip();
    store.clear();
    store.set(MEDICATIONS_KEY, JSON.stringify({ years: [2026], rows: [{ id: 'x', name: 'Other', dosage: '', months: [] }] }));
    store.set(SHARED_META_KEY, JSON.stringify({ showPanels: ['Thyroid'] }));

    const lines = await importFiles(files);

    expect(loadMedications()).toEqual(MEDICATIONS);
    expect(loadScheduled()).toEqual(SCHEDULED);
    for (const [key, value] of Object.entries(SETTINGS)) expect(store.get(key)).toBe(value);
    expect((JSON.parse(store.get(RESULTS_STORAGE_KEY)!) as DiagnosticReport[]).map((s) => s.date)).toEqual([session.date]);
    expect(store.has(SHARED_META_KEY)).toBe(false);
    expect(lines).toContain('Lab reports: 1 report restored.');
    expect(lines).toContain('Scheduled visits: 1 visit with 1 observation and 1 index restored.');
    expect(lines).toContain('Laboratory prices: ship with the app, nothing to restore.');
  });

  it('leaves a part missing from the zip empty', async () => {
    seed();
    const files = without(exportZip(), 'medications.json', 'settings.json');

    const lines = await importFiles(files);

    expect(store.has(MEDICATIONS_KEY)).toBe(false);
    expect(loadMedications()).toEqual({ years: [2026], rows: [] });
    for (const key of Object.keys(SETTINGS)) expect(store.has(key)).toBe(false);
    expect(lines).toContain('Medications: not in the backup, left empty.');
    expect(loadScheduled()).toEqual(SCHEDULED);
  });

  it('reports one line per part, in order, for a backup holding only its manifest', async () => {
    seed();
    const files = without(exportZip(), REPORT, 'medications.json', 'scheduled-visits.json', 'settings.json');

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
    const files = { ...exportZip(), [REPORT]: JSON.stringify({ schema: '3.1', diagnosticReports: [] }) };
    seed();

    const lines = await importFiles(files);

    expect(store.has(RESULTS_STORAGE_KEY)).toBe(false);
    expect(lines).toContain('Lab reports: 0 reports restored.');
  });

  it('takes the printed sex from a report file, and keeps the file itself as it was', async () => {
    seed();
    const text = JSON.stringify({ ...JSON.parse(exportZip()[REPORT]!), sex: 'female', subject: 'p-x' }, null, 4);

    await importFiles({ ...exportZip(), [REPORT]: text });

    expect(loadEnvelopeMeta()).toEqual({ sex: 'female' });
    expect(buildBackupFiles({ sessions: JSON.parse(store.get(RESULTS_STORAGE_KEY)!), storage: localStorage, app: APP, now: NOW })[REPORT]).toBe(text);
  });

  it('restores a backup whose visit still carries a laboratory, and stores it without one', async () => {
    seed();
    const files = { ...exportZip(), 'scheduled-visits.json': JSON.stringify(STORED_SCHEDULED) };

    await importFiles(files);

    expect(loadScheduled()).toEqual(SCHEDULED);
    expect(JSON.parse(store.get(SCHEDULED_KEY)!)).toEqual(SCHEDULED);
  });

  it('restores a pre-redesign backup (one schedule, no visits list) by migrating it into a single visit', async () => {
    seed();
    const files = { ...exportZip(), 'scheduled-visits.json': JSON.stringify(LEGACY_STORED_SCHEDULED) };

    await importFiles(files);

    const loaded = loadScheduled();
    expect(loaded.visits).toHaveLength(1);
    expect(loaded.visits[0]).toMatchObject({ loincs: ['2093-3'], indices: ['homair'], month: '2026-10' });
    expect(typeof loaded.visits[0]!.id).toBe('string');
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
    await expectRejected(without(exportZip(), 'manifest.json'));
  });

  it.each([
    ['another format', { format: 'something-else', version: 1, files: [] }],
    ['another version', { format: 'blood-tests-backup', version: 2, files: [] }],
    ['not an object', ['blood-tests-backup']],
  ])('a manifest with %s', async (_label, manifest) => {
    await expectRejected({ ...exportZip(), 'manifest.json': JSON.stringify(manifest) });
  });

  it.each([
    ['medications.json', '{"years": [2026], "rows": ['],
    ['scheduled-visits.json', 'not json'],
    ['settings.json', '{'],
    [REPORT, '{"schema": "3.1", "diagnosticReports": [{}'],
  ])('malformed JSON in %s', async (name, text) => {
    await expectRejected({ ...exportZip(), [name]: text });
  });

  it.each([
    ['medications.json', '[]'],
    ['scheduled-visits.json', '{"loincs": []}'],
    ['settings.json', '{"bloodtests_lang": "en"}'],
    [REPORT, '{"schema": 1, "diagnosticReports": []}'],
  ])('a %s of the wrong shape', async (name, text) => {
    await expectRejected({ ...exportZip(), [name]: text });
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

    buildBackupFiles({ sessions: [session], storage: recording, app: APP, now: NOW });

    expect(read.size).toBeGreaterThan(0);
    for (const key of read) expect(isUserDataKey(key)).toBe(true);
    expect(USER_DATA_KEYS).toEqual(expect.arrayContaining([RESULTS_STORAGE_KEY, ENVELOPE_META_KEY]));
  });
});
