import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildExportEnvelope, downloadExportFile } from '../src/utils/exportData';
import { parseUploadedResults } from '../src/data/parseUpload';
import { SCHEMA_VERSION } from '../src/data/envelopeSchema';
import type { Result, DiagnosticReport } from '../src/types';

const result = (partial: Partial<Result>): Result => ({
  loinc: '2093-3',
  rawName: 'Total Cholesterol',
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

describe('buildExportEnvelope — normalized unit, printed rawUnit', () => {
  const source = {
    schema: 3,
    diagnosticReports: [
      {
        lab: 'Lab A',
        collectedAt: '2026-01-10T00:00:00Z',
        observations: [
          { loinc: '2093-3', rawName: 'Cholesterol', value: 1.86, rawValue: '1.86', unit: 'g/L' },
          { loinc: '14682-9', rawName: 'Creatinine', value: 79.6, rawValue: '79,6', unit: 'мкмоль/л' },
          { loinc: '718-7', rawName: 'Hemoglobin', value: 14.2, rawValue: '14.2', unit: 'g/dL' },
          { loinc: '2000-8', rawName: 'Calcium ionized', value: 1.2, rawValue: '1.2', unit: 'μкат/л' },
        ],
      },
    ],
  };

  it('writes the UCUM spelling in unit and the printed string in rawUnit', async () => {
    const envelope = await buildExportEnvelope(parseUploadedResults(source));
    const observations = envelope.diagnosticReports[0]!.observations;

    expect(observations.map((obs) => obs.unit)).toEqual(['g/L', 'umol/L', 'g/dL', undefined]);
    expect(observations.map((obs) => obs.rawUnit)).toEqual(['g/L', 'мкмоль/л', 'g/dL', 'μкат/л']);
  });

  it('leaves unit absent when the printed unit cannot be placed in UCUM', async () => {
    const envelope = await buildExportEnvelope(parseUploadedResults(source));
    const unplaceable = envelope.diagnosticReports[0]!.observations[3]!;

    expect('unit' in unplaceable).toBe(false);
    expect(unplaceable.rawUnit).toBe('μкат/л');
  });

  it('normalizes the spelling only — the exported value is the printed one', async () => {
    const envelope = await buildExportEnvelope(parseUploadedResults(source));
    const creatinine = envelope.diagnosticReports[0]!.observations[1]!;

    expect(creatinine.value).toBe(79.6);
    expect(creatinine.rawValue).toBe('79,6');
  });

  it('never emits the derived canonical form', async () => {
    const normalized = parseUploadedResults(source);
    expect(normalized[0]!.items!.some((item) => item.canonical !== undefined)).toBe(true);

    const envelope = await buildExportEnvelope(normalized);

    expect(envelope.diagnosticReports[0]!.observations.every((obs) => !('canonical' in obs))).toBe(true);
  });

  // Byte-identity of the FIRST round trip is deliberately gone: export now
  // writes a field the imported file did not have. What has to hold instead is
  // that the transformation settles — a file this app wrote survives import and
  // re-export unchanged — which is the property that actually catches drift.
  it('is stable across a second round trip: export → import → export is identical', async () => {
    const first = await buildExportEnvelope(parseUploadedResults(source));
    const second = await buildExportEnvelope(parseUploadedResults({ schema: 3, ...first }));

    expect(JSON.stringify(second.diagnosticReports, null, 2)).toBe(
      JSON.stringify(first.diagnosticReports, null, 2)
    );
    expect(second.contentHash).toBe(first.contentHash);
  });

  it('reads rawUnit back as the printed unit, so a re-export writes the same pair', async () => {
    const reimported = parseUploadedResults({
      schema: 3,
      diagnosticReports: [
        {
          lab: 'Lab A',
          collectedAt: '2026-01-10T00:00:00Z',
          observations: [
            { loinc: '14682-9', rawName: 'Creatinine', value: 79.6, unit: 'umol/L', rawUnit: 'мкмоль/л' },
          ],
        },
      ],
    });

    expect(reimported[0]!.items![0]!.unit).toBe('мкмоль/л');
  });
});

describe('buildExportEnvelope', () => {
  it('creates an envelope stamped with the current schema version, a contentHash and a generatedAt stamp', async () => {
    const envelope = await buildExportEnvelope([session({})]);

    expect(envelope.schema).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe('3.1');
    expect(envelope.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(envelope.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(envelope.diagnosticReports).toHaveLength(1);
  });

  it('maps sessions to diagnosticReports', async () => {
    const sessions = [
      session({
        date: '2026-08-26',
        place: 'Lab A',
        items: [
          result({ loinc: '2093-3', rawName: 'Cholesterol', value: 180 }),
          result({ loinc: '2571-8', rawName: 'Triglycerides', value: 150 }),
        ],
        itemCount: 2,
      }),
    ];

    const envelope = await buildExportEnvelope(sessions);
    const report = envelope.diagnosticReports[0];

    expect(report.lab).toBe('Lab A');
    expect(report.collectedAt).toBe('2026-08-26T00:00:00Z');
    expect(report.observations).toHaveLength(2);
    expect(report.observations[0].loinc).toBe('2093-3');
    expect(report.observations[0].rawName).toBe('Cholesterol');
    expect(report.observations[0].value).toBe(180);
  });

  it('excludes sessions with no items', async () => {
    const sessions = [session({ items: null }), session({ items: [] }), session({ items: [result({})] })];

    const envelope = await buildExportEnvelope(sessions);

    expect(envelope.diagnosticReports).toHaveLength(1);
  });

  it('handles missing lab name with "Unknown Lab"', async () => {
    const sessions = [session({ place: '' })];

    const envelope = await buildExportEnvelope(sessions);

    expect(envelope.diagnosticReports[0].lab).toBe('Unknown Lab');
  });

  it('writes the meta fields that are set and omits the blank and the absent ones', async () => {
    const withMeta = await buildExportEnvelope([session({})], {
      subject: 'p-7fa3',
      sex: 'female',
      birthYear: 1972,
      notes: 'Rebuilt from the lab PDFs.',
    });
    expect(withMeta.subject).toBe('p-7fa3');
    expect(withMeta.sex).toBe('female');
    expect(withMeta.birthYear).toBe(1972);
    expect(withMeta.notes).toBe('Rebuilt from the lab PDFs.');

    const blank = await buildExportEnvelope([session({})], { subject: '  ', notes: '' });
    const none = await buildExportEnvelope([session({})]);
    for (const envelope of [blank, none]) {
      expect(envelope).not.toHaveProperty('subject');
      expect(envelope).not.toHaveProperty('sex');
      expect(envelope).not.toHaveProperty('birthYear');
      expect(envelope).not.toHaveProperty('notes');
    }
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
            rawName: 'Total Cholesterol',
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

  it('omits a null value and a reference range with neither bounds nor text', async () => {
    const envelope = await buildExportEnvelope([
      session({ items: [result({ value: null, refMin: null, refMax: null, refText: '' })] }),
    ]);
    const obs = envelope.diagnosticReports[0].observations[0];

    expect(obs.value).toBeUndefined();
    expect(obs.referenceRanges).toBeUndefined();
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
        remove: vi.fn(),
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
      remove: vi.fn(),
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
