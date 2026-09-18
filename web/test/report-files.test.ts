import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { mergeFilesToLabReports, splitReportsToFiles } from '../src/data/reportFiles';
import { computeSha256Hash } from '../src/utils/exportData';

const obs = (rawName: string, rawValue: string, rawUnit: string) => ({
  loinc: '2345-7',
  rawName,
  value: Number(rawValue),
  rawValue,
  unit: rawUnit,
  rawUnit,
});

const report = (lab: string, day: string, rawValue = '5.10') => ({
  lab,
  collectedAt: `${day}T00:00:00Z`,
  observations: [obs('Glucose ', rawValue, 'mg/dL')],
});

const envelope = (diagnosticReports: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ schema: '3.1', generatedAt: '2026-01-01T00:00:00.000Z', contentHash: 'sha256:x', diagnosticReports, ...extra });

describe('splitReportsToFiles', () => {
  it('writes one single-report envelope per lab and date', async () => {
    const files = await splitReportsToFiles(
      envelope([report('MS LAB Diagnostics', '2026-08-19'), report('Ygia', '2022-04-29')], { subject: 'A', sex: 'male', birthYear: 1980, notes: 'n' })
    );
    expect(Object.keys(files)).toEqual(['reports/2022-04-29__ygia.json', 'reports/2026-08-19__ms-lab-diagnostics.json']);
    const parsed = JSON.parse(files['reports/2022-04-29__ygia.json']);
    expect(parsed).toMatchObject({ schema: '3.1', subject: 'A', sex: 'male', birthYear: 1980, notes: 'n' });
    expect(parsed).not.toHaveProperty('generatedAt');
    expect(parsed.diagnosticReports).toHaveLength(1);
    expect(parsed.contentHash).toBe(await computeSha256Hash(parsed.diagnosticReports));
  });

  it('suffixes same-lab same-day reports in input order', async () => {
    const files = await splitReportsToFiles(envelope([report('Ygia', '2024-05-01', '1'), report('YGIA', '2024-05-01', '2'), report('ygia', '2024-05-01', '3')]));
    expect(Object.keys(files)).toEqual(['reports/2024-05-01__ygia-2.json', 'reports/2024-05-01__ygia-3.json', 'reports/2024-05-01__ygia.json']);
    expect(JSON.parse(files['reports/2024-05-01__ygia-2.json']).diagnosticReports[0].observations[0].rawValue).toBe('2');
  });

  it('copies printed values, units and names untouched', async () => {
    const files = await splitReportsToFiles(envelope([report('Lab', '2024-01-01', '5.10')]));
    const o = JSON.parse(files['reports/2024-01-01__lab.json']).diagnosticReports[0].observations[0];
    expect(o).toEqual(obs('Glucose ', '5.10', 'mg/dL'));
  });

  it('falls back for unusable lab and date', async () => {
    const files = await splitReportsToFiles(envelope([{ lab: 'Ελλάδα', collectedAt: 'soon', observations: [] }]));
    expect(Object.keys(files)).toEqual(['reports/unknown__lab.json']);
  });

  it('yields no files for an empty envelope and rejects garbage', async () => {
    expect(await splitReportsToFiles(envelope([]))).toEqual({});
    await expect(splitReportsToFiles('nope')).rejects.toThrow();
    await expect(splitReportsToFiles('{}')).rejects.toThrow();
  });
});

describe('mergeFilesToLabReports', () => {
  it('returns null with no report files', async () => {
    expect(await mergeFilesToLabReports({ 'medications.json': '{}' })).toBeNull();
  });

  it('orders newest first and round-trips split -> merge -> split', async () => {
    const source = envelope(
      [report('Ygia', '2022-04-29'), report('Ygia', '2024-05-01', '1'), report('Ygia', '2024-05-01', '2'), report('MediLab', '2024-05-01')],
      { subject: 'A', birthYear: 1980 }
    );
    const files = await splitReportsToFiles(source);
    const merged = (await mergeFilesToLabReports(files)) as string;
    const parsed = JSON.parse(merged);
    expect(parsed.diagnosticReports.map((r: { collectedAt: string }) => r.collectedAt.slice(0, 10))).toEqual(['2024-05-01', '2024-05-01', '2024-05-01', '2022-04-29']);
    expect(parsed).toMatchObject({ subject: 'A', birthYear: 1980, schema: '3.1' });
    expect(parsed.contentHash).toBe(await computeSha256Hash(parsed.diagnosticReports));
    expect(await splitReportsToFiles(merged)).toEqual(files);
    expect(await mergeFilesToLabReports(await splitReportsToFiles(merged))).toBe(merged);
  });

  it('tolerates multi-report files and takes the latest generatedAt', async () => {
    const merged = await mergeFilesToLabReports({
      'reports/2024-01-01__a.json': envelope([report('A', '2024-01-01'), report('A', '2024-01-01', '9')]),
      'reports/2025-01-01__b.json': JSON.stringify({ schema: '3.1', generatedAt: '2027-01-01T00:00:00.000Z', diagnosticReports: [report('B', '2025-01-01')] }),
      'medications.json': '{}',
    });
    const parsed = JSON.parse(merged as string);
    expect(parsed.diagnosticReports).toHaveLength(3);
    expect(parsed.generatedAt).toBe('2027-01-01T00:00:00.000Z');
  });

  it('throws on a file that is not JSON', async () => {
    await expect(mergeFilesToLabReports({ 'reports/2024-01-01__a.json': '{' })).rejects.toThrow();
  });
});

const REAL_DIR = process.env.PANELOOM_REPORTS_DIR;

describe.skipIf(!REAL_DIR || !existsSync(REAL_DIR))('real per-report files (PANELOOM_REPORTS_DIR)', () => {
  it('merge accepts them as they are and split round-trips', async () => {
    const files: Record<string, string> = {};
    for (const name of readdirSync(REAL_DIR as string).filter((n) => n.endsWith('.json'))) {
      files[`reports/${name}`] = readFileSync(join(REAL_DIR as string, name), 'utf8');
    }
    const merged = (await mergeFilesToLabReports(files)) as string;
    const parsed = JSON.parse(merged);
    const expected = Object.values(files).reduce((n, t) => n + JSON.parse(t).diagnosticReports.length, 0);
    expect(parsed.diagnosticReports).toHaveLength(expected);

    const resplit = await splitReportsToFiles(merged);
    expect(Object.keys(resplit).sort()).toEqual(Object.keys(files).sort());
    for (const [key, text] of Object.entries(files)) {
      expect(JSON.parse(resplit[key]).diagnosticReports).toEqual(JSON.parse(text).diagnosticReports);
    }
    expect(await splitReportsToFiles((await mergeFilesToLabReports(resplit)) as string)).toEqual(resplit);
  });
});
