import { describe, it, expect } from 'vitest';
import { getLatest, getStatus, hasReference, type LatestByLoinc } from '../src/components/conditions/resultsLookup';
import { generateTestData } from '../src/data/generateTestData';
import { buildConditions, PANEL_DEFS, SHORT_LABELS } from '../src/components/conditions/markers';
import { HP_AXIS_HTML } from '../src/components/conditions/hpAxisContent';
import type { Result } from '../src/types';

const result = (partial: Partial<Result>): Result => ({
  loinc: '',
  analysis: '',
  symbol: '',
  section: '',
  value: null,
  rawValue: '',
  valueQualifier: '',
  unit: '',
  refText: '',
  refMin: null,
  refMax: null,
  method: '',
  ...partial,
});

describe('resultsLookup', () => {
  const latest: LatestByLoinc = {
    '14913-8': { result: result({ value: 17, refMin: 10, refMax: 30 }), date: '2026-01-01' },
    '2986-8': { result: result({ value: 5, refMin: 3, refMax: 9 }), date: '2026-06-01' },
    '718-7': { result: result({ value: 20, refMin: 13, refMax: 17 }), date: '2025-01-01' },
    '1992-7': { result: result({ value: 2 }), date: '2025-01-01' },
  };

  it('getLatest picks the newest across a badge and its aliases', () => {
    expect(getLatest(latest, ['14913-8', '2986-8'])!.date).toBe('2026-06-01');
  });

  it('getStatus: never / in-range / out-of-range / unknown', () => {
    expect(getStatus(latest, ['nope'])).toBe('never');
    expect(getStatus(latest, ['14913-8'])).toBe('in-range');
    expect(getStatus(latest, ['718-7'])).toBe('out-of-range');
    expect(getStatus(latest, ['1992-7'])).toBe('unknown');
  });

  it('hasReference needs a value plus at least one bound', () => {
    expect(hasReference(result({ value: 1, refMin: 0 }))).toBe(true);
    expect(hasReference(result({ value: 1 }))).toBe(false);
    expect(hasReference(result({ refMin: 0 }))).toBe(false);
  });
});

describe('generateTestData', () => {
  it('produces 6 dated sessions from the Test Data Lab', () => {
    const groups = generateTestData();
    expect(groups).toHaveLength(6);
    for (const g of groups) {
      expect(g.file).toBe(`generated__${g.date}`);
      expect(g.place).toBe('Test Data Lab');
      expect(g.itemCount).toBe(g.items.length);
    }
  });

  it('gives each LOINC a stable reference range across regenerations', () => {
    const a = generateTestData().flatMap((g) => g.items);
    const b = generateTestData().flatMap((g) => g.items);
    const refA = new Map(a.map((i) => [i.loinc, i.refText]));
    for (const item of b) {
      if (refA.has(item.loinc)) expect(item.refText).toBe(refA.get(item.loinc));
    }
  });

  it('values are non-negative numbers with matching rawValue', () => {
    for (const item of generateTestData().flatMap((g) => g.items)) {
      expect(item.value).toBeGreaterThanOrEqual(0);
      expect(item.rawValue).toBe(String(item.value));
      expect(SHORT_LABELS[item.loinc]).toBeDefined();
    }
  });
});

describe('buildConditions', () => {
  const panels = [
    { id: 'hpg-axis', name: 'HPG Axis', loincs: ['14913-8', '2991-8'] },
    { id: 'thyroid', name: 'Thyroid', sections: [{ name: 's', loincs: ['11580-8'] }] },
    { id: 'glucose-metabolism', name: 'Glucose', loincs: ['2339-0', '1798-8', '59261-8'] },
  ];

  it('resolves panelId panels plus extraLoincs', () => {
    const conditions = buildConditions(panels, {});
    const hypo = conditions.find((c) => c.name === 'Hypogonadism')!;
    expect(hypo.tests.map((t) => t.loinc)).toEqual(
      expect.arrayContaining(['14913-8', '2991-8', '1751-7', '4548-4'])
    );
  });

  it('reads section-based panels and applies excludeLoincs', () => {
    const conditions = buildConditions(panels, {});
    expect(conditions.find((c) => c.name === 'Hypothyroidism')!.tests.map((t) => t.loinc)).toContain('11580-8');
    const ir = conditions.find((c) => c.name === 'Insulin Resistance')!;
    expect(ir.tests.map((t) => t.loinc)).not.toContain('1798-8'); // excluded (pancreatic)
    expect(ir.tests.map((t) => t.loinc)).not.toContain('59261-8'); // excluded (IFCC twin)
  });

  it('always yields one condition per panel definition', () => {
    expect(buildConditions([], {}).map((c) => c.name)).toEqual(PANEL_DEFS.map((d) => d.name));
  });

  it('short labels win over catalog display names', () => {
    const conditions = buildConditions(panels, {
      '14913-8': { loinc: '14913-8', displayName: 'Testosterone (Total)', longCommonName: 'x' },
    });
    const t = conditions.find((c) => c.name === 'Hypogonadism')!.tests.find((x) => x.loinc === '14913-8')!;
    expect(t.short).toBe('T');
    expect(t.full).toBe('Testosterone (Total)');
  });
});

describe('hpAxisContent', () => {
  it('carries the verbatim v2 prose: prolactin section, cascades, source', () => {
    expect(HP_AXIS_HTML).toContain('Prolactin (PRL)');
    expect(HP_AXIS_HTML).toContain('HP axes — feedback loops');
    expect(HP_AXIS_HTML).toContain('Bhasin');
  });
});
