import { describe, it, expect } from 'vitest';
import { parseUploadedResults, UploadParseError } from '../src/data/parseUpload';

describe('parseUploadedResults — v3 envelope', () => {
  it('parses v3 envelope with diagnosticReports', () => {
    const groups = parseUploadedResults({
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
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]!.date).toBe('2026-01-10');
    expect(groups[0]!.place).toBe('Quest Diagnostics');
    expect(groups[0]!.file).toBe('2026-01-10__quest-diagnostics');
    expect(groups[0]!.items[0]).toMatchObject({
      loinc: '718-7',
      analysis: 'Hemoglobin',
      value: 14.2,
      unit: 'g/dL',
      refMin: 13,
      refMax: 17,
    });
  });

  it('reads the printed test name from rawName, not from a legacy name key', () => {
    const groups = parseUploadedResults({
      schema: 3,
      diagnosticReports: [
        {
          lab: 'Lab A',
          collectedAt: '2026-01-10T00:00:00Z',
          observations: [{ loinc: '718-7', name: 'Hemoglobin', value: 14.2 }],
        },
      ],
    });
    expect(groups[0]!.items[0]!.analysis).toBe('');
  });

  it('extracts date from ISO timestamp', () => {
    const groups = parseUploadedResults({
      schema: 3,
      diagnosticReports: [
        {
          lab: 'Lab A',
          collectedAt: '2024-06-15T14:30:00Z',
          observations: [
            {
              rawName: 'Test',
              value: 100,
              unit: 'mg/dL',
            },
          ],
        },
      ],
    });
    expect(groups[0]!.date).toBe('2024-06-15');
  });

  it('handles missing loinc code', () => {
    const groups = parseUploadedResults({
      schema: 3,
      diagnosticReports: [
        {
          lab: 'Lab A',
          collectedAt: '2026-01-10T00:00:00Z',
          observations: [
            {
              rawName: 'Unknown Test',
              value: 50,
              unit: 'units',
            },
          ],
        },
      ],
    });
    expect(groups[0]!.items[0]!.loinc).toBe('');
    expect(groups[0]!.items[0]!.analysis).toBe('Unknown Test');
  });

  it('handles reference ranges with text', () => {
    const groups = parseUploadedResults({
      schema: 3,
      diagnosticReports: [
        {
          lab: 'Lab A',
          collectedAt: '2026-01-10T00:00:00Z',
          observations: [
            {
              loinc: '2093-3',
              rawName: 'Total Cholesterol',
              value: 186.65,
              unit: 'mg/dL',
              referenceRanges: [{ high: 200, text: '< 200.00 Desirable' }],
            },
          ],
        },
      ],
    });
    expect(groups[0]!.items[0]!.refText).toBe('< 200.00 Desirable');
    expect(groups[0]!.items[0]!.refMax).toBe(200);
  });

  it('handles comparator in observation', () => {
    const groups = parseUploadedResults({
      schema: 3,
      diagnosticReports: [
        {
          lab: 'Lab A',
          collectedAt: '2026-01-10T00:00:00Z',
          observations: [
            {
              rawName: 'Test',
              value: 0.5,
              comparator: '<',
              rawValue: '<0.5',
              unit: 'ng/mL',
            },
          ],
        },
      ],
    });
    expect(groups[0]!.items[0]).toMatchObject({
      value: 0.5,
      valueQualifier: '<',
      rawValue: '<0.5',
    });
  });

  it('folds the report identifier into the session id so same-day draws do not collide', () => {
    const groups = parseUploadedResults({
      schema: 3,
      diagnosticReports: [
        {
          lab: 'Lab A',
          collectedAt: '2026-01-10T08:00:00Z',
          identifiers: { visit: 'V-1' },
          observations: [{ loinc: '718-7', rawName: 'Hemoglobin', value: 14.2 }],
        },
        {
          lab: 'Lab A',
          collectedAt: '2026-01-10T16:00:00Z',
          identifiers: { visit: 'V-2' },
          observations: [{ loinc: '718-7', rawName: 'Hemoglobin', value: 13.8 }],
        },
      ],
    });
    expect(groups.map((g) => g.file)).toEqual(['2026-01-10__lab-a__v-1', '2026-01-10__lab-a__v-2']);
  });

  it('sorts multiple reports by date, newest first', () => {
    const groups = parseUploadedResults({
      schema: 3,
      diagnosticReports: [
        {
          lab: 'Lab A',
          collectedAt: '2025-06-01T00:00:00Z',
          observations: [{ rawName: 'Test', value: 100, unit: 'U' }],
        },
        {
          lab: 'Lab B',
          collectedAt: '2026-01-10T00:00:00Z',
          observations: [{ rawName: 'Test', value: 100, unit: 'U' }],
        },
      ],
    });
    expect(groups.map((g) => g.date)).toEqual(['2026-01-10', '2025-06-01']);
  });

  it('rejects v3 with empty diagnosticReports', () => {
    expect(() =>
      parseUploadedResults({
        schema: 3,
        diagnosticReports: [],
      })
    ).toThrow(UploadParseError);
  });

  it('rejects v3 with invalid collectedAt timestamp', () => {
    expect(() =>
      parseUploadedResults({
        schema: 3,
        diagnosticReports: [
          {
            lab: 'Lab A',
            collectedAt: 'not-a-date',
            observations: [{ rawName: 'Test', value: 100, unit: 'U' }],
          },
        ],
      })
    ).toThrow(/invalid collectedAt timestamp/);
  });

  it('rejects v3 with missing observations array', () => {
    expect(() =>
      parseUploadedResults({
        schema: 3,
        diagnosticReports: [
          {
            lab: 'Lab A',
            collectedAt: '2026-01-10T00:00:00Z',
            // missing observations
          },
        ],
      })
    ).toThrow(/missing observations array/);
  });
});

describe('parseUploadedResults — unit normalization at import', () => {
  const envelope = (observations: unknown[]) => ({
    schema: 3,
    diagnosticReports: [{ lab: 'Lab A', collectedAt: '2026-01-10T00:00:00Z', observations }],
  });

  it('attaches the canonical form without touching the printed value or unit', () => {
    const item = parseUploadedResults(
      envelope([{ loinc: '2093-3', rawName: 'Cholesterol', value: 1.86, unit: 'g/L' }])
    )[0]!.items![0]!;
    expect(item.value).toBe(1.86);
    expect(item.unit).toBe('g/L');
    expect(item.canonical?.unit).toBe('mg/dL');
    expect(item.canonical?.value).toBeCloseTo(186, 6);
  });

  it('reads a Cyrillic printed unit into the canonical UCUM spelling', () => {
    const item = parseUploadedResults(
      envelope([{ loinc: '2160-0', rawName: 'Creatinine', value: 0.9, unit: 'мг/дл' }])
    )[0]!.items![0]!;
    expect(item.unit).toBe('мг/дл');
    expect(item.canonical?.unit).toBe('mg/dL');
    expect(item.canonical?.value).toBeCloseTo(0.9, 9);
  });

  it('attaches nothing when a molar value sits under a mass code', () => {
    const item = parseUploadedResults(
      envelope([{ loinc: '2093-3', rawName: 'Cholesterol', value: 4.8, unit: 'mmol/L' }])
    )[0]!.items![0]!;
    expect(item.value).toBe(4.8);
    expect(item.unit).toBe('mmol/L');
    expect(item.canonical).toBeUndefined();
  });

  it('attaches nothing for an unmappable unit or an uncurated code', () => {
    const items = parseUploadedResults(
      envelope([
        { loinc: '718-7', rawName: 'Hemoglobin', value: 14.2, unit: 'blorp/L' },
        { loinc: '1234567-0', rawName: 'Something', value: 1, unit: 'mg/dL' },
      ])
    )[0]!.items!;
    expect(items[0]!.canonical).toBeUndefined();
    expect(items[1]!.canonical).toBeUndefined();
  });
});

// ADR-0012: the version is the string "major.minor". Major 3 is read whatever
// its minor — including a minor this build has never heard of, since a minor
// only ever adds an optional field and unknown fields are ignored — plus the
// legacy bare number 3, which means 3.0.
describe('parseUploadedResults — the accepted schema versions', () => {
  const stampedWith = (version: unknown) => ({
    schema: version,
    diagnosticReports: [
      {
        lab: 'Lab A',
        collectedAt: '2026-01-10T00:00:00Z',
        observations: [{ rawName: 'Test', value: 100, unit: 'U' }],
      },
    ],
  });

  it.each([3, '3.0', '3.1', '3.9', '3.10'])('reads a file stamped %o', (version) => {
    const groups = parseUploadedResults(stampedWith(version));
    expect(groups).toHaveLength(1);
    expect(groups[0]!.items![0]!.value).toBe(100);
  });

  it.each([4, '4.0', '2.9', 1, '3', '3.', '3.01', 3.1, 'abc', '', null, undefined, {}])(
    'refuses a file stamped %o',
    (version) => {
      expect(() => parseUploadedResults(stampedWith(version))).toThrow(/Unrecognized JSON shape/);
    }
  );

  it('refuses an envelope with no schema field at all', () => {
    expect(() =>
      parseUploadedResults({
        diagnosticReports: [
          {
            lab: 'Lab A',
            collectedAt: '2026-01-10T00:00:00Z',
            observations: [{ rawName: 'Test', value: 100 }],
          },
        ],
      })
    ).toThrow(/Unrecognized JSON shape/);
  });
});

describe('parseUploadedResults — rejects everything that is not a v3 envelope', () => {
  const stamped = (version: number) => ({
    schema: version,
    diagnosticReports: [
      {
        lab: 'Lab A',
        collectedAt: '2026-01-10T00:00:00Z',
        observations: [{ rawName: 'Test', value: 100, unit: 'U' }],
      },
    ],
  });

  // ADR-0009: schema 3 is the only shape the parser accepts. Every other shape
  // the project has ever written or read must be refused outright.
  const rejected: [string, unknown][] = [
    ['an envelope stamped schema 1', stamped(1)],
    ['an envelope stamped schema 2', stamped(2)],
    ['an envelope stamped schema 99', stamped(99)],
    [
      'project-bloodtests-v2 canonical draws',
      [
        {
          date: '2026-01-10',
          labName: 'Lab A',
          items: [
            {
              shortName: 'HGB',
              loinc: '718-7',
              original: { value: 14.2, unit: 'g/dL', refText: '13.0-17.0', refMin: 13, refMax: 17 },
              us: { value: 14.2, unit: 'g/dL' },
              si: { value: 142, unit: 'g/L' },
            },
          ],
        },
      ],
    ],
    ['legacy grouped sessions', [{ date: '2025-01-01', place: 'A', items: [{ loinc: '718-7', value: 14 }] }]],
    [
      'legacy flat entries',
      [{ date: '2026-01-10', place: 'Lab A', loinc: '718-7', value: 14.2, unit: 'g/dL' }],
    ],
    ['an empty array', []],
    ['an unrecognized object', [{ foo: 'bar' }]],
    ['an envelope whose diagnosticReports is not an array', { schema: 3, diagnosticReports: {} }],
    ['a primitive', 'not json at all'],
  ];

  it('refuses every non-v3 shape with an UploadParseError', () => {
    for (const [label, input] of rejected) {
      expect(() => parseUploadedResults(input), label).toThrow(UploadParseError);
    }
  });

  it('says "Unrecognized JSON shape" for a wrongly-versioned or legacy file', () => {
    for (const input of [stamped(1), stamped(2), stamped(99), rejected[3]![1], rejected[4]![1], rejected[5]![1]]) {
      expect(() => parseUploadedResults(input)).toThrow(/Unrecognized JSON shape/);
    }
  });
});
