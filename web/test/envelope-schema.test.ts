import { describe, it, expect } from 'vitest';
import { filesFromUpload, resolveReportFiles } from '../src/data/reportFiles';
import { SCHEMA_VERSION, isAcceptedSchemaVersion } from '../src/data/envelopeSchema';
import type { Result, DiagnosticReport } from '../src/types';
import { makeResult, makeSession } from './helpers/fixtures';
import { compileSchema } from './helpers/schema';

const { schema, validate } = compileSchema('bloodtests-3.schema.json');

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

const result = (partial: Partial<Result>): Result =>
  makeResult({ loinc: '2093-3', rawName: 'Total Cholesterol', value: 186.65, unit: 'mg/dL', refText: '< 200 Desirable', refMax: 200, method: 'CHOD-POD', ...partial });

const session = (partial: Partial<DiagnosticReport>): DiagnosticReport =>
  makeSession({ place: 'Quest Diagnostics', items: [result({})], ...partial });

describe('published JSON Schema — compiles', () => {
  it('is a valid draft 2020-12 schema with the published $id', () => {
    expect(schema.$id).toBe('https://paneloom.com/schema/bloodtests-3.schema.json');
    expect(typeof validate).toBe('function');
  });
});

const NOW = new Date('2026-09-01T10:00:00.000Z');
const fileOf = (session: DiagnosticReport): unknown => {
  const { files } = resolveReportFiles([session], {}, NOW);
  return JSON.parse(Object.values(files)[0]!);
};

describe('published JSON Schema — what the app writes', () => {
  it('accepts a file built for a session that has none', () => {
    const envelope = fileOf(session({}));

    expect(errorsFor(envelope)).toEqual([]);
    expect(envelope).toMatchObject({ schema: SCHEMA_VERSION, lastUpdatedDate: NOW.toISOString() });
    expect(envelope).not.toHaveProperty('generatedAt');
  });

  it('accepts a built file whose observation has no value and no reference range', () => {
    const envelope = fileOf(session({ items: [result({ value: null, rawValue: 'Negative', refMin: null, refMax: null, refText: '' })] }));

    expect(errorsFor(envelope)).toEqual([]);
  });

  it('accepts each per-report file split from an upload, meta fields carried along', () => {
    const upload = {
      schema: '3.1',
      subject: 'p-7fa3',
      sex: 'female',
      birthYear: 1972,
      notes: 'Rebuilt from the lab PDFs.',
      diagnosticReports: [
        { lab: 'Lab A', collectedAt: '2026-01-10T00:00:00Z', observations: [{ loinc: '718-7', rawName: 'Hemoglobin', value: 14.2 }] },
        { lab: 'Lab B', collectedAt: '2026-02-10T00:00:00Z', observations: [{ loinc: '718-7', rawName: 'Hemoglobin', value: 13.9 }] },
      ],
    };
    const files = filesFromUpload(upload, undefined, new Set(), NOW);

    expect(Object.keys(files)).toHaveLength(2);
    for (const text of Object.values(files)) expect(errorsFor(JSON.parse(text))).toEqual([]);
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

  it('accepts every optional field the prose spec defines, including rawUnit beside a normalized unit', () => {
    expect(
      errorsFor({
        schema: 3,
        lastUpdatedDate: '2026-08-26T21:14:09Z',
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

  it('still accepts the deprecated generatedAt on a legacy file', () => {
    expect(
      errorsFor({
        schema: '3.1',
        generatedAt: '2026-08-26T21:14:09Z',
        diagnosticReports: [
          { lab: 'Lab A', collectedAt: '2026-01-10T00:00:00Z', observations: [{ loinc: '718-7', rawName: 'Hemoglobin', value: 14.2 }] },
        ],
      })
    ).toEqual([]);
  });

  it('rejects a lastUpdatedDate that is not a date-time', () => {
    expect(
      errorsFor({
        schema: '3.2',
        lastUpdatedDate: 'yesterday',
        diagnosticReports: [
          { lab: 'Lab A', collectedAt: '2026-01-10T00:00:00Z', observations: [{ loinc: '718-7', rawName: 'Hemoglobin', value: 14.2 }] },
        ],
      })
    ).toContainEqual(expect.objectContaining({ instancePath: '/lastUpdatedDate', keyword: 'format' }));
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

  it('schema: 1 — the format is major-3 only, and the schema rejects 1 as well', () => {
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
      expect.objectContaining({ instancePath: '/schema', keyword: 'anyOf' })
    );

    const asV3 = { ...legacy, schema: SCHEMA_VERSION };
    expect(errorsFor(asV3)).toEqual([]);
  });
});

// ADR-0012: the version is the string "major.minor". Every minor of major 3
// validates against this one schema — that is what makes a minor an addition
// rather than a new format — and the legacy bare number 3 stays readable.
describe('published JSON Schema — the schema version field', () => {
  const withVersion = (version: unknown) => ({
    schema: version,
    diagnosticReports: [
      {
        lab: 'Lab A',
        collectedAt: '2026-01-10T00:00:00Z',
        observations: [{ loinc: '718-7', rawName: 'Hemoglobin', value: 14.2, unit: 'g/dL' }],
      },
    ],
  });

  it.each([3, '3.0', '3.1', '3.2', '3.9', '3.10', '3.42'])('accepts %o', (version) => {
    expect(errorsFor(withVersion(version))).toEqual([]);
  });

  it.each([1, 2, 4, 3.1, '3', '4.0', '2.9', '3.', '3.01', 'abc', null, undefined])(
    'rejects %o',
    (version) => {
      expect(errorsFor(withVersion(version))).not.toEqual([]);
    }
  );
});

describe('isAcceptedSchemaVersion', () => {
  it.each([3, '3.0', '3.1', '3.9', '3.10', '3.42', SCHEMA_VERSION])('accepts %o', (version) => {
    expect(isAcceptedSchemaVersion(version)).toBe(true);
  });

  // '3x1' and '3-1' pin the escaped dot; '13.1', ' 3.1' and '3.1\n' the anchors.
  it.each([1, 4, 3.1, '3', '3.', '3.01', '3x1', '3-1', '13.1', '3.1.0', ' 3.1', '3.1\n', '4.0', '', null, undefined, {}])(
    'rejects %o',
    (version) => {
      expect(isAcceptedSchemaVersion(version)).toBe(false);
    }
  );
});
