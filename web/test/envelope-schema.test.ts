import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { buildExportEnvelope } from '../src/utils/exportData';
import type { Result, DiagnosticReport } from '../src/types';

const schema = JSON.parse(
  readFileSync(new URL('../public/schema/bloodtests-3.schema.json', import.meta.url), 'utf8')
) as object;

const ajv = new Ajv2020({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

interface SchemaError {
  instancePath: string;
  keyword: string;
  message?: string;
  missingProperty?: string;
}

function errorsFor(envelope: unknown): SchemaError[] {
  validate(envelope);
  return (validate.errors ?? []).map((e) => {
    const error: SchemaError = { instancePath: e.instancePath, keyword: e.keyword, message: e.message };
    const params = e.params as { missingProperty?: string };
    if (params.missingProperty) error.missingProperty = params.missingProperty;
    return error;
  });
}

const result = (partial: Partial<Result>): Result => ({
  loinc: '2093-3',
  analysis: 'Total Cholesterol',
  symbol: '',
  section: '',
  value: 186.65,
  rawValue: '186.65',
  valueQualifier: '',
  unit: 'mg/dL',
  refText: '< 200 Desirable',
  refMin: null,
  refMax: 200,
  method: 'CHOD-POD',
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

describe('published JSON Schema — compiles', () => {
  it('is a valid draft 2020-12 schema with the published $id', () => {
    expect((schema as { $id: string }).$id).toBe('https://blood.isayenko.net/schema/bloodtests-3.schema.json');
    expect(typeof validate).toBe('function');
  });
});

describe('published JSON Schema — what the app exports', () => {
  it('accepts an envelope built by buildExportEnvelope', async () => {
    const envelope = await buildExportEnvelope([session({})]);

    expect(errorsFor(envelope)).toEqual([]);
  });

  it('accepts an export envelope carrying every meta field', async () => {
    const envelope = await buildExportEnvelope(
      [
        session({
          items: [
            result({ loinc: '2093-3', analysis: 'Cholesterol', value: 180 }),
            result({ loinc: '2571-8', analysis: 'Triglycerides', value: 150, method: '' }),
          ],
          itemCount: 2,
        }),
      ],
      { subject: 'p-7fa3', sex: 'female', birthYear: 1972, notes: 'Rebuilt from the lab PDFs.' }
    );

    expect(errorsFor(envelope)).toEqual([]);
  });

  it('accepts an export envelope whose observation has no value and no reference range', async () => {
    const envelope = await buildExportEnvelope([
      session({ items: [result({ value: null, rawValue: 'Negative', refMin: null, refMax: null, refText: '' })] }),
    ]);

    expect(errorsFor(envelope)).toEqual([]);
  });
});

describe('published JSON Schema — v3 fixtures', () => {
  it('accepts the minimal v3 envelope', () => {
    expect(
      errorsFor({
        schema: 3,
        diagnosticReports: [
          {
            lab: 'Quest Diagnostics',
            collectedAt: '2026-01-10T00:00:00Z',
            observations: [
              {
                loinc: '718-7',
                rawName: 'Hemoglobin',
                value: 14.2,
                unit: 'g/dL',
                referenceRanges: [{ low: 13, high: 17 }],
              },
            ],
          },
        ],
      })
    ).toEqual([]);
  });

  it('accepts an empty loinc — the observation is stored but joins nothing', () => {
    expect(
      errorsFor({
        schema: 3,
        diagnosticReports: [
          {
            lab: 'Lab A',
            collectedAt: '2026-01-10T00:00:00Z',
            observations: [{ loinc: '', rawName: 'Unknown Test', value: 50, unit: 'units' }],
          },
        ],
      })
    ).toEqual([]);
  });

  it('accepts every optional field the prose spec defines, including the unimplemented rawUnit', () => {
    expect(
      errorsFor({
        schema: 3,
        generatedAt: '2026-08-26T21:14:09Z',
        contentHash: `sha256:${'a'.repeat(64)}`,
        subject: 'p-7fa3',
        sex: 'female',
        birthYear: 1972,
        notes: 'Rebuilt from the lab PDFs, March 2026.',
        diagnosticReports: [
          {
            lab: 'NeoGenesis',
            collectedAt: '2026-05-07T08:23:00Z',
            issuedAt: '2026-05-13T15:26:00Z',
            identifiers: { visit: 'v-1', order: 'o-2', accession: 'a-3' },
            specimen: { material: 'plasma', additive: 'citrate' },
            observations: [
              {
                loinc: '2093-3',
                rawName: 'Total Cholesterol',
                value: 0.01,
                comparator: '<',
                rawValue: '< 0.01',
                unit: 'mg/dL',
                rawUnit: 'mg/dl',
                referenceRanges: [
                  { low: 200, label: 'Desirable', text: '< 200.00 Desirable' },
                  { low: 200, high: 239, label: 'Borderline' },
                  { high: 40, appliesTo: { sex: 'female' } },
                  { low: 20, high: 43, ageLow: 15, ageHigh: 65 },
                ],
                interpretation: 'L',
                specimen: { material: 'serum' },
                method: 'CHOD-POD',
              },
            ],
          },
        ],
      })
    ).toEqual([]);
  });

  it('accepts an unrecognised lab identifier key — objects are open for forward compatibility', () => {
    expect(
      errorsFor({
        schema: 3,
        diagnosticReports: [
          {
            lab: 'Lab A',
            collectedAt: '2026-01-10T00:00:00Z',
            identifiers: { 'lab-run-no': '77-B' },
            observations: [{ loinc: '718-7', rawName: 'Hemoglobin', value: 14.2 }],
          },
        ],
      })
    ).toEqual([]);
  });
});

describe('published JSON Schema — rejects', () => {
  it('an envelope with no diagnosticReports', () => {
    expect(errorsFor({ schema: 3 })).toContainEqual(
      expect.objectContaining({ instancePath: '', keyword: 'required', missingProperty: 'diagnosticReports' })
    );
  });

  it('a report with no lab', () => {
    expect(
      errorsFor({
        schema: 3,
        diagnosticReports: [
          {
            collectedAt: '2026-01-10T00:00:00Z',
            observations: [{ loinc: '718-7', rawName: 'Hemoglobin' }],
          },
        ],
      })
    ).toContainEqual(
      expect.objectContaining({
        instancePath: '/diagnosticReports/0',
        keyword: 'required',
        missingProperty: 'lab',
      })
    );
  });

  it('an observation with no loinc', () => {
    expect(
      errorsFor({
        schema: 3,
        diagnosticReports: [
          {
            lab: 'Lab A',
            collectedAt: '2026-01-10T00:00:00Z',
            observations: [{ rawName: 'Hemoglobin', value: 14.2 }],
          },
        ],
      })
    ).toContainEqual(
      expect.objectContaining({
        instancePath: '/diagnosticReports/0/observations/0',
        keyword: 'required',
        missingProperty: 'loinc',
      })
    );
  });

  it('an observation carrying the printed name under the old key "name"', () => {
    expect(
      errorsFor({
        schema: 3,
        diagnosticReports: [
          {
            lab: 'Lab A',
            collectedAt: '2026-01-10T00:00:00Z',
            observations: [{ loinc: '718-7', name: 'Hemoglobin', value: 14.2 }],
          },
        ],
      })
    ).toContainEqual(
      expect.objectContaining({
        instancePath: '/diagnosticReports/0/observations/0',
        keyword: 'required',
        missingProperty: 'rawName',
      })
    );
  });

  it('a lab-internal code in loinc', () => {
    expect(
      errorsFor({
        schema: 3,
        diagnosticReports: [
          {
            lab: 'Lab A',
            collectedAt: '2026-01-10T00:00:00Z',
            observations: [{ loinc: '900101', rawName: 'Hemoglobin' }],
          },
        ],
      })
    ).toContainEqual(
      expect.objectContaining({
        instancePath: '/diagnosticReports/0/observations/0/loinc',
        keyword: 'pattern',
      })
    );
  });

  it('schema: 1 — the format is version-3 only, and the parser rejects 1 as well', () => {
    const legacy = {
      schema: 1,
      diagnosticReports: [
        {
          lab: 'Lab A',
          collectedAt: '2026-01-10T00:00:00Z',
          observations: [{ loinc: '718-7', rawName: 'Hemoglobin', value: 14.2, unit: 'g/dL' }],
        },
      ],
    };

    expect(errorsFor(legacy)).toContainEqual(
      expect.objectContaining({ instancePath: '/schema', keyword: 'const' })
    );

    const asV3 = { ...legacy, schema: 3 };
    expect(errorsFor(asV3)).toEqual([]);
  });
});
