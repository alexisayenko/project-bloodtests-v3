import { describe, it, expect } from 'vitest';
import { filesFromUpload, isReportPath, patchEditedFile, reportPathFor, resolveReportFiles } from '../src/data/reportFiles';
import { contentHashOf } from '../src/data/contentHash';
import { makeResult, makeSession } from './helpers/fixtures';

const NOW = new Date('2026-09-01T10:00:00.000Z');

const obs = (rawName: string, rawValue: string, rawUnit: string) => ({
  loinc: '2345-7',
  rawName,
  value: Number(rawValue),
  rawValue,
  unit: 'mmol/L',
  rawUnit,
  interpretation: 'H',
});

const report = (lab: string, day: string, rawValue = '5.10') => ({
  lab,
  collectedAt: `${day}T00:00:00Z`,
  specimen: { material: 'serum' },
  observations: [obs('Glucose ', rawValue, 'mg/dL')],
});

const envelope = (diagnosticReports: unknown[], extra: Record<string, unknown> = {}) => ({
  schema: '3.1',
  generatedAt: '2026-01-01T00:00:00.000Z',
  contentHash: 'sha256:x',
  diagnosticReports,
  ...extra,
});

describe('reportPathFor', () => {
  it('names a file by collection day and lab slug, and suffixes a taken name', () => {
    const taken = new Set<string>();
    expect(reportPathFor('2024-05-01T08:00:00Z', 'Ygia', taken)).toBe('reports/2024-05-01__ygia.json');
    expect(reportPathFor('2024-05-01T09:00:00Z', 'YGIA', taken)).toBe('reports/2024-05-01__ygia-2.json');
    expect(reportPathFor('2024-05-01T09:00:00Z', 'ygia', taken)).toBe('reports/2024-05-01__ygia-3.json');
  });

  it('falls back to unknown for an unusable date and a non-ASCII lab', () => {
    expect(reportPathFor('soon', 'Ελλάδα', new Set())).toBe('reports/unknown__unknown.json');
  });

  it('recognises report paths only', () => {
    expect(isReportPath('reports/a.json')).toBe(true);
    expect(isReportPath('medications.json')).toBe(false);
    expect(isReportPath('reports/a.txt')).toBe(false);
  });
});

describe('filesFromUpload', () => {
  it('writes one single-report envelope per report, spreading the originals with nothing dropped or derived', () => {
    const upload = envelope([report('MS LAB', '2026-08-19'), report('Ygia', '2022-04-29')], { subject: 'A', sex: 'male', birthYear: 1980, notes: 'n' });
    const files = filesFromUpload(upload, undefined, new Set(), NOW);

    expect(Object.keys(files)).toEqual(['reports/2026-08-19__ms-lab.json', 'reports/2022-04-29__ygia.json']);
    const parsed = JSON.parse(files['reports/2022-04-29__ygia.json']!);
    expect(parsed).toMatchObject({ schema: '3.1', subject: 'A', sex: 'male', birthYear: 1980, notes: 'n', generatedAt: '2026-01-01T00:00:00.000Z' });
    expect(parsed.lastUpdatedDate).toBe(NOW.toISOString());
    expect(parsed.diagnosticReports).toEqual([report('Ygia', '2022-04-29')]);
    expect(parsed.contentHash).toBe(contentHashOf(parsed.diagnosticReports));
    expect(files['reports/2022-04-29__ygia.json']!.endsWith('}\n')).toBe(true);
  });

  it('keeps a single-report upload that carries its own lastUpdatedDate as its own text', () => {
    const text = JSON.stringify(envelope([report('Ygia', '2024-01-01')], { lastUpdatedDate: '2026-02-02T02:02:02Z' }), null, 4);
    const files = filesFromUpload(JSON.parse(text), text, new Set(), NOW);
    expect(Object.values(files)).toEqual([text]);
  });

  it('gives a single-report upload without one a fresh lastUpdatedDate', () => {
    const files = filesFromUpload(envelope([report('Ygia', '2024-01-01')]), undefined, new Set(), NOW);
    expect(JSON.parse(Object.values(files)[0]!).lastUpdatedDate).toBe(NOW.toISOString());
  });

  it('suffixes same-lab same-day reports in input order', () => {
    const files = filesFromUpload(envelope([report('Ygia', '2024-05-01', '1'), report('YGIA', '2024-05-01', '2')]), undefined, new Set(), NOW);
    expect(Object.keys(files)).toEqual(['reports/2024-05-01__ygia.json', 'reports/2024-05-01__ygia-2.json']);
  });

  it('yields no files for an empty envelope', () => {
    expect(filesFromUpload(envelope([]), undefined, new Set(), NOW)).toEqual({});
  });
});

describe('resolveReportFiles', () => {
  const held = { 'reports/2024-01-01__lab.json': '{"schema":"3.1","diagnosticReports":[]}  \n', 'reports/gone.json': 'x' };
  const linked = makeSession({ file: 'a', source: { path: 'reports/2024-01-01__lab.json', index: 0 } });

  it('keeps a held file text untouched and drops files no session points at', () => {
    const { sessions, files } = resolveReportFiles([linked], held, NOW);
    expect(files).toEqual({ 'reports/2024-01-01__lab.json': held['reports/2024-01-01__lab.json'] });
    expect(sessions[0]).toBe(linked);
  });

  it('builds a file once for a session with none, without deriving a unit', () => {
    const orphan = makeSession({ file: 'b', place: 'Quest', date: '2026-03-04', items: [makeResult({ loinc: '2093-3', rawName: 'Total Cholesterol', value: 186, unit: 'mg/dL' })] });
    const { sessions, files } = resolveReportFiles([orphan], {}, NOW);
    const path = sessions[0]!.source!.path;
    expect(path).toBe('reports/2026-03-04__quest.json');
    const parsed = JSON.parse(files[path]!);
    expect(parsed.lastUpdatedDate).toBe(NOW.toISOString());
    expect(parsed.diagnosticReports[0].observations[0]).not.toHaveProperty('unit');
    expect(parsed.diagnosticReports[0].observations[0].rawUnit).toBe('mg/dL');
  });
});

describe('patchEditedFile', () => {
  const stored = JSON.stringify(envelope([report('Ygia', '2024-01-01')], { subject: 'A' }), null, 2) + '\n';
  const before = [makeResult({ loinc: '2345-7', value: 5.1, rawValue: '5.10', unit: 'mg/dL' })];

  it('patches only the touched field, refreshes lastUpdatedDate and the hash, and keeps everything else', () => {
    const after = [{ ...before[0]!, value: 6, rawValue: '6.0' }];
    const parsed = JSON.parse(patchEditedFile(stored, 0, before, after, NOW));
    const o = parsed.diagnosticReports[0].observations[0];
    expect(o).toMatchObject({ value: 6, rawValue: '6.0', unit: 'mmol/L', rawUnit: 'mg/dL', interpretation: 'H' });
    expect(parsed).toMatchObject({ subject: 'A', generatedAt: '2026-01-01T00:00:00.000Z', lastUpdatedDate: NOW.toISOString() });
    expect(parsed.diagnosticReports[0].specimen).toEqual({ material: 'serum' });
    expect(parsed.contentHash).toBe(contentHashOf(parsed.diagnosticReports));
  });

  it('adds no contentHash to a file that had none', () => {
    const bare = JSON.stringify({ schema: '3.1', diagnosticReports: [report('Ygia', '2024-01-01')] });
    const after = [{ ...before[0]!, value: 6, rawValue: '6.0' }];
    expect(JSON.parse(patchEditedFile(bare, 0, before, after, NOW))).not.toHaveProperty('contentHash');
  });
});
