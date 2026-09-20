import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { pendingChanges, pullCloudFiles, pushCloudFiles } from '../src/cloud/sync';
import { buildBackupFiles, zipBackupFiles } from '../src/data/backupArchive';
import { readBackup, restoreBackup, unzipBackup } from '../src/data/backupRestore';
import { addResults, editSession, importResults, replaceReportFiles, settleStoredSessions } from '../src/data/importResults';
import { filesFromUpload, patchEditedFile, reportPathFor } from '../src/data/reportFiles';
import { HELD_FILES_KEY, loadHeldFiles } from '../src/data/storage/heldFiles';
import { loadMedications, MEDICATIONS_KEY } from '../src/data/storage/medications';
import { RESULTS_STORAGE_KEY, parseStoredSessions } from '../src/data/storage/resultsStorage';
import { VIEW_SETTINGS_KEY } from '../src/data/storage/viewSettings';
import type { DiagnosticReport } from '../src/types';
import { installMemoryStorage } from './helpers/storage';
import {
  APP,
  FULL_REPORT,
  FULL_REPORT_PATH,
  MANIFEST,
  NON_ASCII_REPORT,
  NON_ASCII_REPORT_PATH,
  OTHER_FILES,
  REPORT_FILES,
  STORED_FOLDER,
  SUFFIXED_REPORT,
  SUFFIXED_REPORT_PATH,
} from './helpers/storedFiles';

const NOW = new Date('2026-09-10T08:30:00.000Z');
const deps = { clearReports: () => localStorage.removeItem(RESULTS_STORAGE_KEY), importReports: (files: Record<string, string>) => void replaceReportFiles(files, NOW) };

let store: Map<string, string>;

const sessionsNow = () => parseStoredSessions(localStorage.getItem(RESULTS_STORAGE_KEY));
const exportFiles = () => buildBackupFiles({ sessions: sessionsNow(), storage: localStorage, app: APP, now: new Date('2026-10-15T12:00:00Z') });
const load = (files: Record<string, string>) => restoreBackup(readBackup(files), deps);

// What the hooks do on mount: read their storage key and write it back in the app's own serialization.
function remountHooks() {
  store.set(MEDICATIONS_KEY, JSON.stringify(loadMedications()));
  const settings = store.get(VIEW_SETTINGS_KEY);
  if (settings) store.set(VIEW_SETTINGS_KEY, JSON.stringify(JSON.parse(settings)));
}

beforeEach(() => {
  store = installMemoryStorage();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('zip export -> import -> export', () => {
  it('returns every stored file byte for byte, manifest included', async () => {
    await load(STORED_FOLDER);
    remountHooks();

    expect(exportFiles()).toEqual(STORED_FOLDER);
  });

  it('survives the zip itself and a second full cycle', async () => {
    await load(STORED_FOLDER);
    remountHooks();
    const zip = zipBackupFiles(exportFiles(), { zipSync, strToU8 });

    store.clear();
    await load(unzipBackup(zip, { unzipSync, strFromU8 }));
    remountHooks();

    expect(exportFiles()).toEqual(STORED_FOLDER);
  });

  it('carries the printed unit, legacy generatedAt, interpretation, specimen, hash and time untouched', async () => {
    await load(STORED_FOLDER);

    const out = exportFiles()[FULL_REPORT_PATH]!;
    const parsed = JSON.parse(out).diagnosticReports[0];

    expect(out).toBe(FULL_REPORT);
    expect(parsed.observations[0]).toMatchObject({ unit: 'g/L', rawUnit: 'g/dl', interpretation: 'N', rawValue: '14.20' });
    expect(parsed.collectedAt).toBe('2026-03-14T08:23:00+02:00');
    expect(out).toContain('"generatedAt"');
  });

  it('keeps a non-ASCII lab under its stored file name and a suffixed name as it is', async () => {
    await load(STORED_FOLDER);

    const files = exportFiles();

    expect(files[NON_ASCII_REPORT_PATH]).toBe(NON_ASCII_REPORT);
    expect(files[SUFFIXED_REPORT_PATH]).toBe(SUFFIXED_REPORT);
    expect(SUFFIXED_REPORT.endsWith('\n')).toBe(false);
  });

  it('writes a fresh manifest, and only then, when a file changed', async () => {
    await load(STORED_FOLDER);
    expect(exportFiles()['manifest.json']).toBe(MANIFEST);

    store.set(MEDICATIONS_KEY, JSON.stringify({ years: [2026], rows: [] }));

    const changed = exportFiles();
    expect(changed['manifest.json']).not.toBe(MANIFEST);
    expect(JSON.parse(changed['manifest.json']!)).toMatchObject({ format: 'blood-tests-backup', version: 1, app: APP });
    expect(changed[FULL_REPORT_PATH]).toBe(FULL_REPORT);
    expect(changed['medications.json']).not.toBe(OTHER_FILES['medications.json']);
  });

  it('still reads the legacy lab-reports.json zip and single-envelope JSON uploads', async () => {
    const legacy = {
      'manifest.json': MANIFEST,
      'lab-reports.json': JSON.stringify({ schema: '3.1', diagnosticReports: [JSON.parse(FULL_REPORT).diagnosticReports[0]] }),
    };

    await load(legacy);

    expect(Object.keys(exportFiles()).filter((name) => name.startsWith('reports/'))).toEqual([FULL_REPORT_PATH]);
  });
});

describe('cloud pull -> push', () => {
  let cloud: Record<string, string>;
  const calls = () => (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, { method: string; body?: string }][];
  const puts = () => calls().filter(([, init]) => init.method === 'PUT');
  const pushed = (n = 0) => JSON.parse(puts()[n]![1].body!).files as Record<string, string>;
  const push = () => pushCloudFiles(exportFiles(), pendingChanges());

  beforeEach(() => {
    cloud = STORED_FOLDER;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { method: string; body?: string }) => {
        if (init.method === 'PUT') cloud = JSON.parse(init.body!).files;
        return { ok: true, status: 200, statusText: 'OK', json: async () => (init.method === 'PUT' ? {} : { files: cloud }) };
      })
    );
  });

  async function pullAndImport() {
    const pulled = (await pullCloudFiles())!;
    await restoreBackup(readBackup(pulled, { manifestOptional: true }), deps, { fromCloud: true });
    remountHooks();
  }

  it('sends nothing after a pull that changed nothing', async () => {
    await pullAndImport();

    expect((await push()).sent).toBe(false);

    expect(puts()).toHaveLength(0);
  });

  it('leaves the untouched report files byte-identical when only settings changed', async () => {
    await pullAndImport();
    store.set(VIEW_SETTINGS_KEY, JSON.stringify({ unitSystem: 'si', sampleLimit: 'all' }));

    await push();

    const sent = pushed();
    for (const [path, text] of Object.entries(REPORT_FILES)) expect(sent[path]).toBe(text);
    expect(sent['manifest.json']).not.toBe(MANIFEST);
    expect(JSON.parse(sent['settings.json']!)).toHaveProperty(VIEW_SETTINGS_KEY);
  });

  it('sends nothing more once a push has gone through', async () => {
    await pullAndImport();
    store.set(MEDICATIONS_KEY, JSON.stringify({ years: [2026], rows: [] }));
    await push();

    expect((await push()).sent).toBe(false);

    expect(puts()).toHaveLength(1);
  });

  it('sends no file for a report that was deleted', async () => {
    await pullAndImport();
    replaceReportFiles({ [FULL_REPORT_PATH]: FULL_REPORT }, NOW, { paths: [FULL_REPORT_PATH] });

    await push();

    expect(Object.keys(pushed()).filter((name) => name.startsWith('reports/'))).toEqual([FULL_REPORT_PATH]);
  });

  it('gives a cloud that has no manifest one with its first change', async () => {
    cloud = Object.fromEntries(Object.entries(STORED_FOLDER).filter(([name]) => name !== 'manifest.json'));
    await pullAndImport();
    expect((await push()).sent).toBe(false);
    store.set(VIEW_SETTINGS_KEY, JSON.stringify({ unitSystem: 'si', sampleLimit: 'all' }));

    await push();

    expect(JSON.parse(pushed()['manifest.json']!)).toMatchObject({ format: 'blood-tests-backup', version: 1 });
    for (const [path, text] of Object.entries(REPORT_FILES)) expect(pushed()[path]).toBe(text);
  });
});

describe('lastUpdatedDate', () => {
  const envelope = (...labs: string[]) => ({
    schema: '3.1',
    subject: 'p-synthetic',
    diagnosticReports: labs.map((lab, i) => ({
      lab,
      collectedAt: `2026-01-1${i}T00:00:00Z`,
      observations: [{ loinc: '718-7', rawName: 'Hemoglobin', value: 14.2, unit: 'g/dL', rawUnit: 'g/dl', interpretation: 'N' }],
    })),
  });
  const stamp = (text: string) => JSON.parse(text).lastUpdatedDate as string | undefined;

  it('stamps a new report file created from an upload, and only that', async () => {
    await load(STORED_FOLDER);

    const { sessions } = addResults(sessionsNow(), envelope('Lab New'), undefined, NOW);
    const files = loadHeldFiles().reports;

    expect(sessions).toHaveLength(4);
    const added = Object.keys(files).find((path) => path.includes('lab-new'))!;
    expect(stamp(files[added]!)).toBe(NOW.toISOString());
    expect(files[added]).toBe(JSON.stringify({ ...envelope('Lab New'), lastUpdatedDate: NOW.toISOString() }, null, 2) + '\n');
    for (const [path, text] of Object.entries(REPORT_FILES)) expect(files[path]).toBe(text);
  });

  it('never stamps on import, pull or export of unmodified files', async () => {
    await load({ ...STORED_FOLDER, 'reports/2026-03-14__acme-labs.json': JSON.stringify({ ...JSON.parse(FULL_REPORT), lastUpdatedDate: undefined }, null, 2) + '\n' });

    for (const text of Object.values(exportFiles()).filter((t) => t.includes('diagnosticReports'))) {
      if (text === NON_ASCII_REPORT) continue;
      expect(text).not.toContain(NOW.toISOString());
    }
    expect(stamp(exportFiles()[FULL_REPORT_PATH]!)).toBeUndefined();
  });

  it('refreshes it in an edited file and leaves every other file verbatim', async () => {
    await load(STORED_FOLDER);
    const target = sessionsNow().find((s) => s.source?.path === FULL_REPORT_PATH)!;
    const items = target.items!.map((item, i) => (i === 0 ? { ...item, value: 15.1, rawValue: '15.1' } : item));

    editSession(sessionsNow(), target.file, { ...target, items }, NOW);
    const files = exportFiles();

    const edited = JSON.parse(files[FULL_REPORT_PATH]!);
    expect(edited.lastUpdatedDate).toBe(NOW.toISOString());
    expect(edited.diagnosticReports[0].observations[0]).toMatchObject({ value: 15.1, rawValue: '15.1', unit: 'g/L', rawUnit: 'g/dl', interpretation: 'N' });
    expect(edited.generatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(edited.contentHash).not.toBe(JSON.parse(FULL_REPORT).contentHash);
    expect(files[SUFFIXED_REPORT_PATH]).toBe(SUFFIXED_REPORT);
    expect(files[NON_ASCII_REPORT_PATH]).toBe(NON_ASCII_REPORT);
  });

  it('is kept verbatim across a round trip', async () => {
    await load(STORED_FOLDER);

    expect(stamp(exportFiles()[NON_ASCII_REPORT_PATH]!)).toBe('2025-11-03T10:00:00.000Z');
  });

  it('adds none to a file that had no contentHash, and does not invent one', () => {
    const text = JSON.stringify(envelope('Lab A'));
    const before = JSON.parse(text).diagnosticReports[0].observations;
    const patched = JSON.parse(patchEditedFile(text, 0, before, before, NOW));

    expect(patched).not.toHaveProperty('contentHash');
    expect(patched.lastUpdatedDate).toBe(NOW.toISOString());
  });
});

describe('a new upload is the only place a file is produced', () => {
  const multi = {
    schema: '3.1',
    generatedAt: '2026-01-01T00:00:00.000Z',
    contentHash: 'sha256:stale',
    diagnosticReports: [
      { lab: 'Lab A', collectedAt: '2026-05-01T09:00:00Z', observations: [{ loinc: '718-7', rawName: 'Hb', value: 1, unit: 'g/L', rawUnit: 'g/dl', interpretation: 'L' }] },
      { lab: 'Ελλάδα', collectedAt: '2026-05-01T09:00:00Z', observations: [] },
      { lab: 'Lab A', collectedAt: '2026-05-01T12:00:00Z', observations: [] },
    ],
  };

  it('splits a multi-report envelope into one file per report, spreading the original objects', () => {
    const files = filesFromUpload(multi, undefined, new Set(), NOW);

    expect(Object.keys(files)).toEqual(['reports/2026-05-01__lab-a.json', 'reports/2026-05-01__unknown.json', 'reports/2026-05-01__lab-a-2.json']);
    const first = JSON.parse(files['reports/2026-05-01__lab-a.json']!);
    expect(first.diagnosticReports).toEqual([multi.diagnosticReports[0]]);
    expect(first.generatedAt).toBe(multi.generatedAt);
    expect(first.lastUpdatedDate).toBe(NOW.toISOString());
    expect(first.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(first.contentHash).not.toBe('sha256:stale');
    expect(files['reports/2026-05-01__lab-a.json']!.endsWith('}\n')).toBe(true);
  });

  it('keeps the text of a single-report upload that carries its own lastUpdatedDate', () => {
    const text = JSON.stringify({ ...envelope1(), lastUpdatedDate: '2026-02-02T00:00:00Z' }, null, 4);

    expect(filesFromUpload(JSON.parse(text), text, new Set(), NOW)).toEqual({ 'reports/2026-05-01__lab-a.json': text });
  });

  it('names a report with no usable date or lab unknown', () => {
    expect(reportPathFor('soon', undefined, new Set())).toBe('reports/unknown__unknown.json');
  });

  it('replaces the stored files on a plain upload and writes the sessions once', () => {
    importResults(multi, undefined, NOW);
    importResults(envelope1(), undefined, NOW);

    expect(Object.keys(loadHeldFiles().reports)).toEqual(['reports/2026-05-01__lab-a.json']);
    expect(sessionsNow().map((s: DiagnosticReport) => s.source?.path)).toEqual(['reports/2026-05-01__lab-a.json']);
  });
});

describe('sessions with no stored file (older builds, generated data)', () => {
  it('get one built once and never rebuilt afterwards', () => {
    const session = {
      file: '2026-01-10__lab-a',
      date: '2026-01-10',
      place: 'Lab A',
      items: [{ loinc: '718-7', rawName: 'Hemoglobin', section: '', value: 14.2, rawValue: '14.2', valueQualifier: '', unit: 'g/dL', refText: '', refMin: null, refMax: null, method: '' }],
      itemCount: 1,
    } as unknown as DiagnosticReport;
    store.set(RESULTS_STORAGE_KEY, JSON.stringify([session]));

    const settled = settleStoredSessions([session], NOW);
    const first = loadHeldFiles().reports;
    settleStoredSessions(settled, new Date('2030-01-01T00:00:00Z'));

    expect(Object.keys(first)).toEqual(['reports/2026-01-10__lab-a.json']);
    expect(loadHeldFiles().reports).toEqual(first);
    expect(JSON.parse(first['reports/2026-01-10__lab-a.json']!)).toMatchObject({ lastUpdatedDate: NOW.toISOString() });
    expect(store.has(HELD_FILES_KEY)).toBe(true);
  });
});

function envelope1() {
  return {
    schema: '3.1',
    diagnosticReports: [{ lab: 'Lab A', collectedAt: '2026-05-01T09:00:00Z', observations: [{ loinc: '718-7', rawName: 'Hb', value: 1, unit: 'g/dL' }] }],
  };
}
