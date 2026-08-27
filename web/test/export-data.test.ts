import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildExportEnvelope, downloadExportFile } from '../src/utils/exportData';
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

describe('buildExportEnvelope', () => {
  it('creates an envelope with schema 1 and contentHash', async () => {
    const sessions = [session({})];
    const envelope = await buildExportEnvelope(sessions);

    expect(envelope.schema).toBe(1);
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
    expect(report.observations[0].name).toBe('Cholesterol');
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

  it('includes sex when provided', async () => {
    const sessions = [session({})];
    const envelope = await buildExportEnvelope(sessions, 'female');

    expect(envelope.sex).toBe('female');
  });

  it('includes birthYear when provided', async () => {
    const sessions = [session({})];
    const envelope = await buildExportEnvelope(sessions, undefined, 1972);

    expect(envelope.birthYear).toBe(1972);
  });

  it('omits sex and birthYear when not provided', async () => {
    const sessions = [session({})];
    const envelope = await buildExportEnvelope(sessions);

    expect(envelope.sex).toBeUndefined();
    expect(envelope.birthYear).toBeUndefined();
  });

  it('computes contentHash from diagnosticReports only (not full envelope)', async () => {
    const sessions = [session({})];
    const envelope1 = await buildExportEnvelope(sessions);
    const envelope2 = await buildExportEnvelope(sessions, 'female');

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
    expect(obs.name).toBe('Total Cholesterol');
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
