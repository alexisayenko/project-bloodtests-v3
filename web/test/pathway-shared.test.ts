import { describe, expect, it } from 'vitest';
import {
  DASH,
  NO_REFERENCE,
  combinedZones,
  formatBounds,
  keepSources,
  labReference,
  mergeReferences,
  roundedPath,
  valueText,
  withVariants,
  zoneReference,
  type CitedSource,
  type ReferenceInfo,
} from '../src/components/conditions/pathwayShared';
import { indexBands } from '../src/data/computedIndices';
import { INDEX_DEFS } from '../src/data/indexDefs';

const source = (title: string): CitedSource => ({ organization: 'Org', title, url: `https://example.org/${title}` });

describe('formatBounds', () => {
  it('writes a closed interval, or a one-sided bound whose symbol follows inclusivity', () => {
    expect(formatBounds(1, 2, 'g/L', false)).toBe('1 – 2 g/L');
    expect(formatBounds(1, undefined, 'g/L', true)).toBe('≥ 1 g/L');
    expect(formatBounds(1, undefined, 'g/L', false)).toBe('> 1 g/L');
    expect(formatBounds(undefined, 2, undefined, true)).toBe('≤ 2');
    expect(formatBounds(undefined, 2, 'g/L', false)).toBe('< 2 g/L');
    expect(formatBounds(undefined, undefined, 'g/L', true)).toBe(DASH);
  });
});

describe('labReference and valueText', () => {
  it('tags a lab range and keeps its open bounds exclusive', () => {
    expect(labReference({ low: 8.6, unit: 'nmol/L' })).toEqual({ tag: 'lab', headCites: [], lines: [{ text: '> 8.6 nmol/L', cites: [] }], sources: [] });
  });

  it('appends a share only when there is one', () => {
    expect(valueText({ text: '5 nmol/L', status: 'ok' })).toBe('5 nmol/L');
    expect(valueText({ text: '5 nmol/L', status: 'ok', share: '25%' })).toBe('5 nmol/L · 25%');
  });
});

describe('withVariants', () => {
  it('expands a code to its primary and every alias, whichever member it starts from', () => {
    const fromAlias = withVariants('13967-5');
    expect(fromAlias[0]).toBe('13967-5');
    expect(fromAlias).toContain('2942-1');
    expect(new Set(withVariants('2942-1'))).toEqual(new Set(fromAlias));
    expect(withVariants('0000-0')).toEqual(['0000-0']);
  });
});

describe('zoneReference', () => {
  const def = INDEX_DEFS.find((d) => d.key === 'ldlmh')!;

  it('lays out a low-is-good index as three zones placed in the shown unit, citing its references', () => {
    const info = zoneReference(def, indexBands(def), (cut) => ({ value: cut, unit: 'mg/dL' }));
    expect(info.tag).toBe('guide');
    expect(info.lines.map((l) => [l.label, l.text])).toEqual([
      ['Within range', '< 100 mg/dL'],
      ['Borderline', '100 – 160 mg/dL'],
      ['High', '≥ 160 mg/dL'],
    ]);
    expect(info.sources).toHaveLength(def.references.length);
    expect(info.headCites).toEqual(def.references.map((_, i) => i + 1));
  });

  it('lays out a high-is-good band from the top down', () => {
    const info = zoneReference(def, { cut: [10, 5], hi: true }, (cut) => ({ value: cut, unit: '' }));
    expect(info.lines.map((l) => l.text)).toEqual(['≥ 10', '5 – 10', '< 5']);
  });

  it('has no reference without bands', () => {
    expect(zoneReference(def, null, (cut) => ({ value: cut, unit: '' }))).toBe(NO_REFERENCE);
  });
});

describe('mergeReferences and keepSources', () => {
  const a: ReferenceInfo = { headCites: [1], lines: [{ text: 'x', cites: [2] }], sources: [source('A'), source('B')] };
  const b: ReferenceInfo = { headCites: [1, 2], lines: [], sources: [source('B'), source('C')] };

  it('renumbers each block into one deduplicated list in order of first appearance', () => {
    const { infos, sources } = mergeReferences([a, b]);
    expect(sources.map((s) => s.title)).toEqual(['A', 'B', 'C']);
    expect(infos[0].headCites).toEqual([1]);
    expect(infos[0].lines[0].cites).toEqual([2]);
    expect(infos[1].headCites).toEqual([2, 3]);
    expect(infos.every((i) => i.sources.length === 0)).toBe(true);
  });

  it('keeps only the named sources, in the named order, dropping tags whose source was cut', () => {
    const merged = mergeReferences([a, b]);
    const { infos, sources } = keepSources(merged.infos, merged.sources, ['C', 'A']);
    expect(sources.map((s) => s.title)).toEqual(['C', 'A']);
    expect(infos[0].headCites).toEqual([2]);
    expect(infos[0].lines[0].cites).toEqual([]);
    expect(infos[1].headCites).toEqual([1]);
  });
});

describe('combinedZones', () => {
  const zones = (text: string, cite: number): ReferenceInfo => ({
    tag: 'guide',
    headCites: [cite],
    lines: [{ label: 'Within range', text, cites: [cite] }],
    sources: [],
  });

  it('states shared zones once, merging their citations', () => {
    const info = combinedZones([zones('< 100', 1), zones('< 100', 2)], ['F', 'S']);
    expect(info.tag).toBe('guide');
    expect(info.headCites).toEqual([1, 2]);
    expect(info.lines).toEqual([{ label: 'Within range', text: '< 100', cites: [1, 2] }]);
  });

  it('labels each method when zones differ, naming a method with none', () => {
    const info = combinedZones([zones('< 100', 1), { ...NO_REFERENCE }], ['F', 'S']);
    expect(info.lines.map((l) => [l.label, l.text])).toEqual([
      ['F · Within range', '< 100'],
      ['S', 'No reference range'],
    ]);
  });
});

describe('roundedPath', () => {
  it('draws a straight segment unchanged', () => {
    expect(roundedPath('0,0 10,0')).toBe('M0,0 L10,0');
  });

  it('rounds each turn with a quadratic curve clamped to half the shorter leg', () => {
    expect(roundedPath('0,0 100,0 100,100', 10)).toBe('M0,0 L90,0 Q100,0 100,10 L100,100');
    expect(roundedPath('0,0 8,0 8,100', 10)).toBe('M0,0 L4,0 Q8,0 8,4 L8,100');
  });
});
