import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pullCloudFiles, pushCloudFiles } from '../src/supabase/sync';

const selectResult = { data: null as unknown, error: null as unknown };
const upsertResult = { data: null as unknown, error: null as unknown };

const eq = vi.fn(() => ({ maybeSingle: vi.fn(() => Promise.resolve(selectResult)) }));
const select = vi.fn(() => ({ eq }));
const upsert = vi.fn(() => Promise.resolve(upsertResult));
const from = vi.fn(() => ({ select, upsert }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (...args: unknown[]) => from(...args) }),
}));

beforeEach(() => {
  from.mockClear();
  select.mockClear();
  eq.mockClear();
  upsert.mockClear();
  selectResult.data = null;
  selectResult.error = null;
  upsertResult.error = null;
});

describe('pullCloudFiles', () => {
  it('returns null when no row exists for the uid', async () => {
    selectResult.data = null;
    expect(await pullCloudFiles('uid-1')).toBeNull();
    expect(from).toHaveBeenCalledWith('user_backups');
    expect(eq).toHaveBeenCalledWith('id', 'uid-1');
  });

  it('maps snake_case columns back to backup filenames, stringified', async () => {
    selectResult.data = {
      manifest: { format: 'blood-tests-backup', version: 1 },
      lab_reports: { schema: '3.1', diagnosticReports: [] },
      medications: { rows: [] },
      scheduled_visits: { visits: [] },
      settings: { a: 1 },
    };
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
    selectResult.data = { manifest: { version: 1 }, lab_reports: {} };
    const files = await pullCloudFiles('uid-1');
    expect(files).toEqual({
      'manifest.json': JSON.stringify({ version: 1 }),
      'lab-reports.json': JSON.stringify({}),
    });
    expect(files).not.toHaveProperty('laboratory-prices.json');
  });
});

describe('pushCloudFiles', () => {
  it('parses each file and writes it under its snake_case column via upsert (full replace)', async () => {
    const files = {
      'manifest.json': JSON.stringify({ version: 1 }),
      'lab-reports.json': JSON.stringify({ diagnosticReports: [] }),
      'medications.json': JSON.stringify({ rows: [] }),
      'scheduled-visits.json': JSON.stringify({ visits: [] }),
      'settings.json': JSON.stringify({ a: 1 }),
      'laboratory-prices.json': JSON.stringify([{ id: 'esculab' }]),
    };
    await pushCloudFiles('uid-1', files);
    expect(from).toHaveBeenCalledWith('user_backups');
    expect(upsert).toHaveBeenCalledWith({
      id: 'uid-1',
      manifest: { version: 1 },
      lab_reports: { diagnosticReports: [] },
      medications: { rows: [] },
      scheduled_visits: { visits: [] },
      settings: { a: 1 },
    });
  });

  it('omits fields whose file is absent from the input', async () => {
    await pushCloudFiles('uid-1', { 'manifest.json': JSON.stringify({ version: 1 }) });
    expect(upsert).toHaveBeenCalledWith({ id: 'uid-1', manifest: { version: 1 } });
  });
});
