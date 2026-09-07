import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildExportEnvelope, downloadExportFile } from '../src/utils/exportData';
import { parseUploadedResults } from '../src/data/parseUpload';
import type { Result, DiagnosticReport } from '../src/types';

const result = (partial: Partial<Result>): Result => ({
  loinc: '2093-3',
  analysis: 'Total Cholesterol',
  symbol: '',
  section: '',
  value: 186,
  rawValue: '186',
  valueQualifier: '',
  unit: 'mg/dL',
  refText: '< 200 Desirable',
  refMin: null,
  refMax: 200,
  method: '',
  ...partial,
});

const session = (partial: Partial<DiagnosticReport>): DiagnosticReport => ({
  date: '2026-08-26',
  place: 'Quest Diagnostics',
  file: 'quest_2026-08-26',
  items: [result({})],
  itemCount: 1,
  ...partial,
});

describe('buildExportEnvelope — import-time normalization leaves it untouched', () => {
  const source = {
    schema: 3,
    diagnosticReports: [
      {
        lab: 'Lab A',
        collectedAt: '2026-01-10T00:00:00Z',
        observations: [
          { loinc: '2093-3', rawName: 'Cholesterol', value: 1.86, rawValue: '1.86', unit: 'g/L' },
          { loinc: '2160-0', rawName: 'Creatinine', value: 0.9, rawValue: '0,9', unit: 'мг/дл' },
          { loinc: '718-7', rawName: 'Hemoglobin', value: 14.2, rawValue: '14.2', unit: 'g/dL' },
        ],
      },
    ],
  };

  it('writes bytes identical to an export of the same reports without a canonical form', async () => {
    const normalized = parseUploadedResults(source);
    expect(normalized[0]!.items!.some((item) => item.canonical !== undefined)).toBe(true);

    const stripped = normalized.map((group) => ({
      ...group,
      items: group.items!.map((item) => {
        const copy = { ...item };
        delete copy.canonical;
        return copy;
      }),
    }));

    const [withCanonical, withoutCanonical] = await Promise.all([
      buildExportEnvelope(normalized),
      buildExportEnvelope(stripped),
    ]);

    expect(JSON.stringify(withCanonical.diagnosticReports, null, 2)).toBe(
      JSON.stringify(withoutCanonical.diagnosticReports, null, 2)
    );
    expect(withCanonical.contentHash).toBe(withoutCanonical.contentHash);
  });

  it('keeps the printed unit in the envelope, never the canonical one', async () => {
    const envelope = await buildExportEnvelope(parseUploadedResults(source));
    const observations = envelope.diagnosticReports[0]!.observations;
    expect(observations.map((obs) => obs.unit)).toEqual(['g/L', 'мг/дл', 'g/dL']);
    expect(observations.every((obs) => !('canonical' in obs))).toBe(true);
  });
});

describe('buildExportEnvelope', () => {
  it('creates an envelope with schema 3 and contentHash', async () => {
    const sessions = [session({})];
    const envelope = await buildExportEnvelope(sessions);

    expect(envelope.schema).toBe(3);
    expect(envelope.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(envelope.diagnosticReports.length).toBe(1);
  });

  it('maps sessions to diagnosticReports', async () => {
    const sessions = [
      session({
        date: '2026-08-26',
        place: 'Lab A',
        items: [
          result({ loinc: '2093-3', analysis: 'Cholesterol', value: 180 }),
          result({ loinc: '2571-8', analysis: 'Triglycerides', value: 150 }),
        ],
        itemCount: 2,
      }),
    ];

    const envelope = await buildExportEnvelope(sessions);
    const report = envelope.diagnosticReports[0];

    expect(report.lab).toBe('Lab A');
    expect(report.collectedAt).toBe('2026-08-26T00:00:00Z');
    expect(report.observations.length).toBe(2);
    expect(report.observations[0].loinc).toBe('2093-3');
    expect(report.observations[0].rawName).toBe('Cholesterol');
    expect(report.observations[0].value).toBe(180);
  });

  it('excludes sessions with no items', async () => {
    const sessions = [session({ items: null }), session({ items: [] }), session({ items: [result({})] })];

    const envelope = await buildExportEnvelope(sessions);

    expect(envelope.diagnosticReports.length).toBe(1);
  });

  it('handles missing lab name with "Unknown Lab"', async () => {
    const sessions = [session({ place: '' })];

    const envelope = await buildExportEnvelope(sessions);

    expect(envelope.diagnosticReports[0].lab).toBe('Unknown Lab');
  });

  it('includes a generatedAt ISO timestamp', async () => {
    const envelope = await buildExportEnvelope([session({})]);

    expect(envelope.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('includes meta fields in the envelope when set', async () => {
    const envelope = await buildExportEnvelope([session({})], {
      subject: 'p-7fa3',
      sex: 'female',
      birthYear: 1972,
      notes: 'Rebuilt from the lab PDFs.',
    });

    expect(envelope.subject).toBe('p-7fa3');
    expect(envelope.sex).toBe('female');
    expect(envelope.birthYear).toBe(1972);
    expect(envelope.notes).toBe('Rebuilt from the lab PDFs.');
  });

  it('omits empty meta fields', async () => {
    const envelope = await buildExportEnvelope([session({})], { subject: '  ', notes: '' });

    expect(envelope).not.toHaveProperty('subject');
    expect(envelope).not.toHaveProperty('sex');
    expect(envelope).not.toHaveProperty('birthYear');
    expect(envelope).not.toHaveProperty('notes');
  });

  it('omits meta fields when no meta given', async () => {
    const envelope = await buildExportEnvelope([session({})]);

    expect(envelope.sex).toBeUndefined();
    expect(envelope.birthYear).toBeUndefined();
    expect(envelope.subject).toBeUndefined();
    expect(envelope.notes).toBeUndefined();
  });

  it('computes contentHash from diagnosticReports only (not full envelope)', async () => {
    const sessions = [session({})];
    const envelope1 = await buildExportEnvelope(sessions);
    const envelope2 = await buildExportEnvelope(sessions, { sex: 'female' });

    // Same diagnosticReports but different sex — hash should match
    expect(envelope1.contentHash).toBe(envelope2.contentHash);
  });

  it('maps observation fields correctly', async () => {
    const sessions = [
      session({
        items: [
          result({
            loinc: '2093-3',
            analysis: 'Total Cholesterol',
            value: 186.65,
            rawValue: '186.65',
            unit: 'mg/dL',
            refMin: null,
            refMax: 200,
            refText: '< 200 Desirable',
            method: 'CHOD-POD',
          }),
        ],
        itemCount: 1,
      }),
    ];

    const envelope = await buildExportEnvelope(sessions);
    const obs = envelope.diagnosticReports[0].observations[0];

    expect(obs.loinc).toBe('2093-3');
    expect(obs.rawName).toBe('Total Cholesterol');
    expect(obs.value).toBe(186.65);
    expect(obs.rawValue).toBe('186.65');
    expect(obs.unit).toBe('mg/dL');
    expect(obs.method).toBe('CHOD-POD');
    expect(obs.referenceRanges).toEqual([{ high: 200, text: '< 200 Desirable' }]);
  });

  it('omits referenceRanges when no bounds or text', async () => {
    const sessions = [session({ items: [result({ refMin: null, refMax: null, refText: '' })] })];

    const envelope = await buildExportEnvelope(sessions);
    const obs = envelope.diagnosticReports[0].observations[0];

    expect(obs.referenceRanges).toBeUndefined();
  });

  it('omits value when null', async () => {
    const sessions = [session({ items: [result({ value: null })] })];

    const envelope = await buildExportEnvelope(sessions);
    const obs = envelope.diagnosticReports[0].observations[0];

    expect(obs.value).toBeUndefined();
  });
});

describe('downloadExportFile', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal('document', {
      createElement: vi.fn((tag: string) => ({
        href: '',
        download: '',
        click: vi.fn(),
        tagName: tag,
      })),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('triggers a download with correct filename format', async () => {
    const mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    const mockCreateElement = vi.fn(() => mockLink);
    vi.mocked(document).createElement = mockCreateElement;

    const envelope = await buildExportEnvelope([session({})]);
    downloadExportFile(envelope);

    expect(mockCreateElement).toHaveBeenCalledWith('a');
    expect(mockLink.download).toMatch(/^blood-tests-export-\d{8}\.json$/);
    expect(mockLink.click).toHaveBeenCalled();
  });
});
