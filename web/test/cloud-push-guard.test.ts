import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { keepsStoredFields, pendingChanges, pushBeforeSignOut, pushCloudFiles, syncOnSignIn } from '../src/cloud/sync';
import { buildBackupFiles } from '../src/data/backupArchive';
import { restoreBackup } from '../src/data/backupRestore';
import { addResults, editSession, replaceReportFiles, settleStoredSessions } from '../src/data/importResults';
import { parseUploadedResults } from '../src/data/parseUpload';
import { loadHeldFiles } from '../src/data/storage/heldFiles';
import { MEDICATIONS_KEY } from '../src/data/storage/medications';
import { RESULTS_STORAGE_KEY, parseStoredSessions } from '../src/data/storage/resultsStorage';
import type { DiagnosticReport } from '../src/types';
import { installMemoryStorage } from './helpers/storage';
import {
  APP,
  FULL_REPORT,
  FULL_REPORT_PATH,
  NON_ASCII_REPORT_PATH,
  REPORT_FILES,
  STORED_FOLDER,
  SUFFIXED_REPORT_PATH,
} from './helpers/storedFiles';

// The cloud folder must survive every browser state byte for byte unless the user changed it (ADR-0028).

const NOW = new Date('2026-09-20T10:00:00.000Z');
let store: Map<string, string>;
let cloud: Record<string, string>;
let requests: { method: string; files?: Record<string, string> }[];

const puts = () => requests.filter((r) => r.method === 'PUT');
const cloudReports = () => Object.fromEntries(Object.entries(cloud).filter(([name]) => name.startsWith('reports/')));

const sessionsNow = () => parseStoredSessions(store.get(RESULTS_STORAGE_KEY) ?? null);
const localFiles = () => buildBackupFiles({ sessions: sessionsNow(), storage: localStorage, app: APP, now: NOW });
const deps = { clearReports: () => store.delete(RESULTS_STORAGE_KEY), importReports: (files: Record<string, string>) => void replaceReportFiles(files, NOW) };
const importAll: Parameters<typeof syncOnSignIn>[1] = (backup, options) => restoreBackup(backup, deps, options);

// What every browser that ran an earlier build holds: the parsed sessions, no `source`, no held files.
function oldShapeCache(files: Record<string, string>) {
  const sessions = Object.entries(files)
    .filter(([path]) => path.startsWith('reports/'))
    .flatMap(([path, text]) => parseUploadedResults(JSON.parse(text), path))
    .map((session) => {
      const { source, ...rest } = session;
      void source;
      return rest as DiagnosticReport;
    });
  store.set(RESULTS_STORAGE_KEY, JSON.stringify(sessions));
}

// The current shape: a pull or import held the files verbatim.
async function pulledCache(files: Record<string, string>) {
  const { readBackup } = await import('../src/data/backupRestore');
  await restoreBackup(readBackup(files, { manifestOptional: true }), deps, { fromCloud: true });
}

// The cloud copy the bad push left behind: the same reports without `unit`, schema bumped, stamped.
function corrupted(text: string): string {
  const envelope = JSON.parse(text);
  envelope.schema = '3.2';
  envelope.lastUpdatedDate = '2026-09-19T16:18:00.000Z';
  for (const report of envelope.diagnosticReports) for (const obs of report.observations) delete obs.unit;
  return JSON.stringify(envelope, null, 2) + '\n';
}

beforeEach(() => {
  store = installMemoryStorage();
  cloud = { ...STORED_FOLDER };
  requests = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { method: string; body?: string }) => {
      const files = init.body ? (JSON.parse(init.body).files as Record<string, string>) : undefined;
      requests.push({ method: init.method, files });
      if (init.method === 'PUT') cloud = files!;
      return { ok: true, status: 200, statusText: 'OK', json: async () => (init.method === 'PUT' ? {} : { files: cloud }) };
    })
  );
});
afterEach(() => vi.unstubAllGlobals());

describe.each([
  ['an old-shape cache without held files', async () => oldShapeCache(cloud)],
  ['held files in the current shape', async () => pulledCache(cloud)],
])('%s', (_label, arrange) => {
  it('sends nothing on mount, sign-in and sign-out', async () => {
    await arrange();
    settleStoredSessions(sessionsNow(), NOW);

    await syncOnSignIn(localFiles, importAll);
    settleStoredSessions(sessionsNow(), NOW);
    const saved = await pushBeforeSignOut(localFiles(), pendingChanges());

    expect(saved).toBe('saved');
    expect(puts()).toHaveLength(0);
    expect(cloud).toEqual(STORED_FOLDER);
  });

  it('sends nothing on sign-out alone, the cloud copy staying exactly as it is', async () => {
    await arrange();
    settleStoredSessions(sessionsNow(), NOW);

    expect(await pushBeforeSignOut(localFiles(), pendingChanges())).toBe('saved');

    expect(puts()).toHaveLength(0);
  });
});

describe('sign-in', () => {
  it('replaces what is held with the cloud text, so a corrupted copy heals on the next pull', async () => {
    const bad = Object.fromEntries(Object.entries(STORED_FOLDER).map(([path, text]) => [path, path.startsWith('reports/') ? corrupted(text) : text]));
    await pulledCache(bad);
    expect(loadHeldFiles().reports[FULL_REPORT_PATH]).not.toContain('"unit": "g/L"');

    expect(await syncOnSignIn(localFiles, importAll)).toBe('pulled');

    expect(loadHeldFiles().reports).toEqual(REPORT_FILES);
    expect(loadHeldFiles().pending).toEqual({ reports: [], removed: [], other: [] });
    expect(sessionsNow().find((s) => s.source?.path === FULL_REPORT_PATH)?.items?.[0]?.storedUnit).toBe('g/L');
    expect(puts()).toHaveLength(0);
  });

  it('pushes the local set to an empty cloud, and only then', async () => {
    cloud = {};
    replaceReportFiles(REPORT_FILES, NOW, { paths: Object.keys(REPORT_FILES) });

    expect(await syncOnSignIn(localFiles, importAll)).toBe('pushed');

    expect(cloudReports()).toEqual(REPORT_FILES);
    expect(loadHeldFiles().pending.reports).toEqual([]);
  });
});

describe('a copy holding the corrupted files', () => {
  it('sends nothing on sign-out when the user changed nothing', async () => {
    const bad = Object.fromEntries(Object.entries(STORED_FOLDER).map(([path, text]) => [path, path.startsWith('reports/') ? corrupted(text) : text]));
    await pulledCache(bad);

    expect(await pushBeforeSignOut(localFiles(), pendingChanges())).toBe('saved');

    expect(puts()).toHaveLength(0);
    expect(cloud).toEqual(STORED_FOLDER);
  });

  it('never writes an edit of a file that lost fields: the cloud keeps its text and the data stays local', async () => {
    const bad = Object.fromEntries(Object.entries(STORED_FOLDER).map(([path, text]) => [path, path.startsWith('reports/') ? corrupted(text) : text]));
    await pulledCache(bad);
    const target = sessionsNow().find((s) => s.source?.path === FULL_REPORT_PATH)!;
    const items = target.items!.map((item, i) => (i === 0 ? { ...item, value: 15.1, rawValue: '15.1' } : item));
    editSession(sessionsNow(), target.file, { ...target, items }, NOW);

    expect(await pushBeforeSignOut(localFiles(), pendingChanges())).toBe('kept');

    expect(cloud).toEqual(STORED_FOLDER);
  });
});

describe('a real change', () => {
  it('sends only the edited file, with every field it had and a stamp on that file alone', async () => {
    await pulledCache(cloud);
    const target = sessionsNow().find((s) => s.source?.path === FULL_REPORT_PATH)!;
    const items = target.items!.map((item, i) => (i === 0 ? { ...item, value: 15.1, rawValue: '15.1' } : item));

    editSession(sessionsNow(), target.file, { ...target, items }, NOW);
    expect(await pushBeforeSignOut(localFiles(), pendingChanges())).toBe('saved');

    expect(puts()).toHaveLength(1);
    const sent = puts()[0]!.files!;
    const edited = JSON.parse(sent[FULL_REPORT_PATH]!);
    expect(edited.lastUpdatedDate).toBe(NOW.toISOString());
    expect(edited.diagnosticReports[0].observations[0]).toMatchObject({ value: 15.1, unit: 'g/L', rawUnit: 'g/dl', interpretation: 'N' });
    expect(keepsStoredFields(FULL_REPORT, sent[FULL_REPORT_PATH]!)).toBe(true);
    for (const path of [SUFFIXED_REPORT_PATH, NON_ASCII_REPORT_PATH]) expect(sent[path]).toBe(REPORT_FILES[path]);
    for (const name of ['medications.json', 'scheduled-visits.json', 'settings.json']) expect(sent[name]).toBe(STORED_FOLDER[name]);
  });

  it('leaves the cloud reports alone when a new upload is added on top of an old-shape cache', async () => {
    oldShapeCache(cloud);
    settleStoredSessions(sessionsNow(), NOW);
    const upload = {
      schema: '3.1',
      diagnosticReports: [{ lab: 'Lab New', collectedAt: '2026-08-01T00:00:00Z', observations: [{ loinc: '718-7', rawName: 'Hemoglobin', value: 14, unit: 'g/dL', rawUnit: 'g/dl' }] }],
    };

    addResults(sessionsNow(), upload, undefined, NOW);
    await pushBeforeSignOut(localFiles(), pendingChanges());

    expect(puts()).toHaveLength(1);
    const sent = puts()[0]!.files!;
    for (const [path, text] of Object.entries(REPORT_FILES)) expect(sent[path]).toBe(text);
    const added = Object.keys(sent).filter((path) => path.startsWith('reports/') && !(path in REPORT_FILES));
    expect(added).toHaveLength(1);
  });

  it('sends a changed settings file alone', async () => {
    await pulledCache(cloud);
    store.set('exploreSel:Lipids', JSON.stringify(['ldl']));

    await pushBeforeSignOut(localFiles(), pendingChanges());

    const sent = puts()[0]!.files!;
    expect(sent['settings.json']).not.toBe(STORED_FOLDER['settings.json']);
    for (const [path, text] of Object.entries(REPORT_FILES)) expect(sent[path]).toBe(text);
  });

  it('sends a medication edit, and nothing on the next sign-out', async () => {
    await pulledCache(cloud);
    store.set(MEDICATIONS_KEY, JSON.stringify({ years: [2026], rows: [{ id: 'm2', months: ['2026-02'], brand: 'Iron', compounds: [], notes: '' }] }));

    await pushBeforeSignOut(localFiles(), pendingChanges());
    await pushBeforeSignOut(localFiles(), pendingChanges());

    expect(puts()).toHaveLength(1);
    expect(JSON.parse(puts()[0]!.files!['medications.json']!).rows[0].id).toBe('m2');
  });

  it('sends the files of a zip the user imported', async () => {
    const { readBackup } = await import('../src/data/backupRestore');
    cloud = { ...STORED_FOLDER, [FULL_REPORT_PATH]: corrupted(FULL_REPORT) };

    await restoreBackup(readBackup(STORED_FOLDER), deps);
    await pushBeforeSignOut(localFiles(), pendingChanges());

    expect(cloud[FULL_REPORT_PATH]).toBe(FULL_REPORT);
  });
});

describe('a legacy cache holding local data the cloud lacks', () => {
  it('is neither sent nor wiped', async () => {
    cloud = { ...STORED_FOLDER };
    delete cloud[NON_ASCII_REPORT_PATH];
    oldShapeCache(STORED_FOLDER);
    settleStoredSessions(sessionsNow(), NOW);

    const saved = await pushBeforeSignOut(localFiles(), pendingChanges());

    expect(puts()).toHaveLength(0);
    expect(saved).toBe('kept');
  });
});

describe('pushCloudFiles guard', () => {
  const local = { ...REPORT_FILES, 'manifest.json': STORED_FOLDER['manifest.json']! };

  it('keeps the cloud text when a changed file would lose observation fields', async () => {
    const lossy = corrupted(FULL_REPORT);

    const result = await pushCloudFiles({ ...local, [FULL_REPORT_PATH]: lossy }, { reports: [FULL_REPORT_PATH], removed: [], other: [] });

    expect(result).toMatchObject({ sent: false, skipped: [FULL_REPORT_PATH] });
    expect(puts()).toHaveLength(0);
  });

  it('never replaces a different report that happens to have the same file name', async () => {
    const other = JSON.parse(FULL_REPORT);
    other.diagnosticReports[0].lab = 'Another Lab';

    const result = await pushCloudFiles({ ...local, [FULL_REPORT_PATH]: JSON.stringify(other) }, { reports: [FULL_REPORT_PATH], removed: [], other: [] });

    expect(result.skipped).toEqual([FULL_REPORT_PATH]);
  });

  it('sends a file that has lost only what an edit may clear', () => {
    const edited = JSON.parse(FULL_REPORT);
    delete edited.diagnosticReports[0].observations[1].value;
    delete edited.diagnosticReports[0].observations[1].rawValue;

    expect(keepsStoredFields(FULL_REPORT, JSON.stringify(edited))).toBe(true);
  });

  it.each(['unit', 'rawUnit', 'referenceRanges', 'interpretation', 'method', 'comparator', 'specimen'])('refuses a file without %s', (field) => {
    const lossy = JSON.parse(FULL_REPORT);
    for (const obs of lossy.diagnosticReports[0].observations) delete obs[field];

    expect(keepsStoredFields(FULL_REPORT, JSON.stringify(lossy))).toBe(false);
  });

  it('refuses a file without a report-level field, or with fewer observations', () => {
    const noSpecimen = JSON.parse(FULL_REPORT);
    delete noSpecimen.diagnosticReports[0].specimen;
    const fewer = JSON.parse(FULL_REPORT);
    fewer.diagnosticReports[0].observations.pop();
    const noSex = JSON.parse(FULL_REPORT);
    delete noSex.sex;

    for (const lossy of [noSpecimen, fewer, noSex]) expect(keepsStoredFields(FULL_REPORT, JSON.stringify(lossy))).toBe(false);
  });
});
