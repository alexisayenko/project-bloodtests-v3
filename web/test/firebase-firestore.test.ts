import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pullCloudFiles, pushCloudFiles } from '../src/firebase/firestore';

const docRef = { path: 'users/uid-1' };
const doc = vi.fn(() => docRef);
const getDoc = vi.fn();
const setDoc = vi.fn();

vi.mock('firebase/firestore', () => ({
  initializeFirestore: () => ({}),
  doc: (...args: unknown[]) => doc(...args),
  getDoc: (...args: unknown[]) => getDoc(...args),
  setDoc: (...args: unknown[]) => setDoc(...args),
}));

vi.mock('../src/firebase/config', () => ({ firebaseApp: {} }));

beforeEach(() => {
  doc.mockClear();
  getDoc.mockClear();
  setDoc.mockClear();
});

describe('pullCloudFiles', () => {
  it('returns null when no document exists for the uid', async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    expect(await pullCloudFiles('uid-1')).toBeNull();
    expect(doc).toHaveBeenCalledWith({}, 'users', 'uid-1');
  });

  it('maps camelCase Firestore fields back to backup filenames, stringified', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        manifest: { format: 'blood-tests-backup', version: 1 },
        labReports: { schema: '3.1', diagnosticReports: [] },
        medications: { rows: [] },
        scheduledVisits: { visits: [] },
        settings: { a: 1 },
      }),
    });
    const files = await pullCloudFiles('uid-1');
    expect(files).toEqual({
      'manifest.json': JSON.stringify({ format: 'blood-tests-backup', version: 1 }),
      'lab-reports.json': JSON.stringify({ schema: '3.1', diagnosticReports: [] }),
      'medications.json': JSON.stringify({ rows: [] }),
      'scheduled-visits.json': JSON.stringify({ visits: [] }),
      'settings.json': JSON.stringify({ a: 1 }),
    });
  });

  it('never pulls laboratory-prices.json and only includes fields actually present', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ manifest: { version: 1 }, labReports: {} }),
    });
    const files = await pullCloudFiles('uid-1');
    expect(files).toEqual({
      'manifest.json': JSON.stringify({ version: 1 }),
      'lab-reports.json': JSON.stringify({}),
    });
    expect(files).not.toHaveProperty('laboratory-prices.json');
  });
});

describe('pushCloudFiles', () => {
  it('parses each file and writes it under its camelCase field via setDoc (full replace)', async () => {
    setDoc.mockResolvedValue(undefined);
    const files = {
      'manifest.json': JSON.stringify({ version: 1 }),
      'lab-reports.json': JSON.stringify({ diagnosticReports: [] }),
      'medications.json': JSON.stringify({ rows: [] }),
      'scheduled-visits.json': JSON.stringify({ visits: [] }),
      'settings.json': JSON.stringify({ a: 1 }),
      'laboratory-prices.json': JSON.stringify([{ id: 'esculab' }]),
    };
    await pushCloudFiles('uid-1', files);
    expect(doc).toHaveBeenCalledWith({}, 'users', 'uid-1');
    expect(setDoc).toHaveBeenCalledWith(docRef, {
      manifest: { version: 1 },
      labReports: { diagnosticReports: [] },
      medications: { rows: [] },
      scheduledVisits: { visits: [] },
      settings: { a: 1 },
    });
  });

  it('omits fields whose file is absent from the input', async () => {
    setDoc.mockResolvedValue(undefined);
    await pushCloudFiles('uid-1', { 'manifest.json': JSON.stringify({ version: 1 }) });
    expect(setDoc).toHaveBeenCalledWith(docRef, { manifest: { version: 1 } });
  });
});
