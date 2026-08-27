import { describe, it, expect } from 'vitest';
import { parseUploadedResults, UploadParseError } from '../src/data/parseUpload';

describe('parseUploadedResults — flat entries', () => {
  it('groups rows into sessions by (date, place), newest first', () => {
    const groups = parseUploadedResults([
      { date: '2026-01-10', place: 'Lab A', loinc: '718-7', value: 14.2, unit: 'g/dL' },
      { date: '2026-01-10', place: 'Lab A', loinc: '2339-0', value: 95, unit: 'mg/dL' },
      { date: '2025-06-01', place: 'Lab B', loinc: '718-7', value: 13.9, unit: 'g/dL' },
    ]);
    expect(groups.map((g) => g.file)).toEqual(['2026-01-10__lab-a', '2025-06-01__lab-b']);
    expect(groups[0]!.itemCount).toBe(2);
    expect(groups[1]!.items[0]!.value).toBe(13.9);
  });

  it('defaults a missing place and skips undated rows', () => {
    const groups = parseUploadedResults([
      { date: '2026-01-10', loinc: '718-7', value: 14 },
      { loinc: '2339-0', value: 95, date: '' },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.place).toBe('Unknown Lab');
  });

  it('coerces numeric strings and keeps rawValue', () => {
    const [g] = parseUploadedResults([
      { date: '2026-01-10', loinc: '718-7', value: '14.2', rawValue: '<14.2', refMin: '13', refMax: '17' },
    ]);
    expect(g!.items[0]).toMatchObject({ value: 14.2, rawValue: '<14.2', refMin: 13, refMax: 17 });
  });
});

describe('parseUploadedResults — grouped sessions', () => {
  it('uses sessions as-is, sorted newest first', () => {
    const groups = parseUploadedResults([
      { date: '2025-01-01', place: 'A', items: [{ loinc: '718-7', value: 14 }] },
      { date: '2026-01-01', place: 'B', items: [] },
    ]);
    expect(groups.map((g) => g.date)).toEqual(['2026-01-01', '2025-01-01']);
    expect(groups[1]!.items[0]!.loinc).toBe('718-7');
  });

  it('slugifies the place into a stable session id', () => {
    const [g] = parseUploadedResults([{ date: '2026-01-01', place: 'Клиника / Downtown №3', items: [] }]);
    expect(g!.file).toBe('2026-01-01__downtown-3');
  });
});

describe('parseUploadedResults — canonical Draws shape', () => {
  it('parses a valid draw into a ResultGroup using labName and original values', () => {
    const [g] = parseUploadedResults([
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
    ]);
    expect(g!.place).toBe('Lab A');
    expect(g!.date).toBe('2026-01-10');
    expect(g!.items[0]).toMatchObject({
      symbol: 'HGB',
      loinc: '718-7',
      value: 14.2,
      unit: 'g/dL',
      refText: '13.0-17.0',
      refMin: 13,
      refMax: 17,
    });
  });

  it('accepts the legacy symbol key as an alias for shortName', () => {
    const [g] = parseUploadedResults([
      {
        date: '2026-01-10',
        labName: 'Lab A',
        items: [{ symbol: 'HGB', original: { value: 14.2 }, us: { value: 14.2 }, si: { value: 142 } }],
      },
    ]);
    expect(g!.items[0]!.symbol).toBe('HGB');
  });

  it('rejects an item missing shortName/analysis/loinc as a failed canonical parse, not an unrecognized shape', () => {
    expect(() =>
      parseUploadedResults([
        {
          date: '2026-01-10',
          labName: 'Lab A',
          items: [{ original: { value: 14.2 }, us: { value: 14.2 }, si: { value: 142 } }],
        },
      ])
    ).toThrow(/item needs at least one of shortName \/ analysis \/ loinc/);
  });

  it('rejects a malformed LOINC code on a recognized canonical shape', () => {
    expect(() =>
      parseUploadedResults([
        {
          date: '2026-01-10',
          labName: 'Lab A',
          items: [{ shortName: 'HGB', loinc: 'not-a-loinc', original: { value: 14.2 } }],
        },
      ])
    ).toThrow(/invalid LOINC code/);
  });
});

describe('parseUploadedResults — v3 envelope', () => {
  it('parses v3 envelope with diagnosticReports', () => {
    const groups = parseUploadedResults({
      schema: 1,
      diagnosticReports: [
        {
          lab: 'Quest Diagnostics',
          collectedAt: '2026-01-10T00:00:00Z',
          observations: [
            {
              loinc: '718-7',
              name: 'Hemoglobin',
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
    expect(groups[0]!.items[0]).toMatchObject({
      loinc: '718-7',
      analysis: 'Hemoglobin',
      value: 14.2,
      unit: 'g/dL',
      refMin: 13,
      refMax: 17,
    });
  });

  it('extracts date from ISO timestamp', () => {
    const groups = parseUploadedResults({
      schema: 1,
      diagnosticReports: [
        {
          lab: 'Lab A',
          collectedAt: '2024-06-15T14:30:00Z',
          observations: [
            {
              name: 'Test',
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
      schema: 1,
      diagnosticReports: [
        {
          lab: 'Lab A',
          collectedAt: '2026-01-10T00:00:00Z',
          observations: [
            {
              name: 'Unknown Test',
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
      schema: 1,
      diagnosticReports: [
        {
          lab: 'Lab A',
          collectedAt: '2026-01-10T00:00:00Z',
          observations: [
            {
              loinc: '2093-3',
              name: 'Total Cholesterol',
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
      schema: 1,
      diagnosticReports: [
        {
          lab: 'Lab A',
          collectedAt: '2026-01-10T00:00:00Z',
          observations: [
            {
              name: 'Test',
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

  it('sorts multiple reports by date, newest first', () => {
    const groups = parseUploadedResults({
      schema: 1,
      diagnosticReports: [
        {
          lab: 'Lab A',
          collectedAt: '2025-06-01T00:00:00Z',
          observations: [{ name: 'Test', value: 100, unit: 'U' }],
        },
        {
          lab: 'Lab B',
          collectedAt: '2026-01-10T00:00:00Z',
          observations: [{ name: 'Test', value: 100, unit: 'U' }],
        },
      ],
    });
    expect(groups.map((g) => g.date)).toEqual(['2026-01-10', '2025-06-01']);
  });

  it('rejects v3 with empty diagnosticReports', () => {
    expect(() =>
      parseUploadedResults({
        schema: 1,
        diagnosticReports: [],
      })
    ).toThrow(UploadParseError);
  });

  it('rejects v3 with invalid collectedAt timestamp', () => {
    expect(() =>
      parseUploadedResults({
        schema: 1,
        diagnosticReports: [
          {
            lab: 'Lab A',
            collectedAt: 'not-a-date',
            observations: [{ name: 'Test', value: 100, unit: 'U' }],
          },
        ],
      })
    ).toThrow(/invalid collectedAt timestamp/);
  });

  it('rejects v3 with missing observations array', () => {
    expect(() =>
      parseUploadedResults({
        schema: 1,
        diagnosticReports: [
          {
            lab: 'Lab A',
            collectedAt: '2026-01-10T00:00:00Z',
            // missing observations
          },
        ] as any,
      })
    ).toThrow(/missing observations array/);
  });
});

describe('parseUploadedResults — rejects', () => {
  it('empty array', () => {
    expect(() => parseUploadedResults([])).toThrow(UploadParseError);
  });

  it('unrecognized shape', () => {
    expect(() => parseUploadedResults([{ foo: 'bar' }])).toThrow(UploadParseError);
  });

  it('entries with no usable dates', () => {
    expect(() => parseUploadedResults([{ date: null, loinc: '718-7' }])).toThrow(UploadParseError);
  });
});
