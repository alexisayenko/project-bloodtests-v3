import { beforeEach, describe, expect, it } from 'vitest';
import { ENVELOPE_META_KEY, loadEnvelopeMeta, loadStoredFileMeta, readStoredFileMeta } from '../src/data/envelopeMeta';
import { replaceReportFiles } from '../src/data/importResults';
import { HELD_FILES_KEY } from '../src/data/storage/heldFiles';
import { installMemoryStorage } from './helpers/storage';

const report = (extra: Record<string, unknown>) =>
  JSON.stringify({
    schema: '3.2',
    ...extra,
    diagnosticReports: [
      { lab: 'Lab A', collectedAt: '2026-01-10T00:00:00Z', observations: [{ loinc: '718-7', rawName: 'Hb', value: 14, unit: 'g/dL' }] },
    ],
  });

let store: Map<string, string>;
beforeEach(() => {
  store = installMemoryStorage();
});

describe('Database details read the held report files', () => {
  it('reads subject, sex and birth year from the first file that has them', () => {
    expect(
      readStoredFileMeta({
        'reports/a.json': report({}),
        'reports/b.json': report({ subject: 'p-1', sex: 'male', birthYear: 1980 }),
        'reports/c.json': report({ subject: 'p-2', sex: 'female', birthYear: 1990 }),
      })
    ).toEqual({ subject: 'p-1', sex: 'male', birthYear: 1980 });
  });

  it('feeds the reference-range sex, ahead of the device setting, without writing anything', () => {
    store.set(ENVELOPE_META_KEY, JSON.stringify({ sex: 'female' }));
    const files = { 'reports/2026-01-10__lab-a.json': report({ subject: 'p-1', sex: 'male', birthYear: 1980 }) };
    replaceReportFiles(files);
    expect(loadStoredFileMeta()).toEqual({ subject: 'p-1', sex: 'male', birthYear: 1980 });
    expect(loadEnvelopeMeta()).toEqual({ sex: 'male' });
    expect(store.get(ENVELOPE_META_KEY)).toBe(JSON.stringify({ sex: 'female' }));
    expect(JSON.parse(store.get(HELD_FILES_KEY)!).reports['reports/2026-01-10__lab-a.json']).toBe(files['reports/2026-01-10__lab-a.json']);
  });

  it('falls back to the device setting when no file carries a sex', () => {
    store.set(ENVELOPE_META_KEY, JSON.stringify({ sex: 'female' }));
    replaceReportFiles({ 'reports/2026-01-10__lab-a.json': report({}) });
    expect(loadEnvelopeMeta()).toEqual({ sex: 'female' });
  });
});
