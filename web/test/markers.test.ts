import { describe, it, expect } from 'vitest';
import {
  buildConditions,
  indexMatchesQuery,
  isEchoRedundant,
  observationMatchesQuery,
  panelRowLoincs,
  primaryLoinc,
  testLoincs,
  type Observation,
} from '../src/components/conditions/markers';
import { ALIAS_TO_PRIMARY, ALSO_REFS, DEFAULT_UNITS, SHORT_LABELS } from '../src/data/analyteCatalog';
import { MARKER_LOINC } from '../src/data/computedIndices';
import { INDEX_DEFS } from '../src/data/indexDefs';
import { MASS_MOLAR_SIBLINGS } from '../src/data/massMolarSiblings';
import { MONITORING_PANELS, PANELS } from './dataFiles';

describe('isEchoRedundant (short-label echo suppression)', () => {
  it('suppresses when the full name contains the short label', () => {
    expect(isEchoRedundant('Testosterone, Free (FT)', 'FT')).toBe(true);
  });

  it('ignores case and punctuation ("25OH" vs "(25-OH)")', () => {
    expect(isEchoRedundant('Vitamin D (25-OH)', '25OH')).toBe(true);
  });

  it('recognizes word-by-word abbreviations ("Vit D" ⊂ "Vitamin D (25-OH)")', () => {
    expect(isEchoRedundant('Vitamin D (25-OH)', 'Vit D')).toBe(true);
  });

  it('keeps the echo when the short label genuinely adds information', () => {
    expect(isEchoRedundant('Hemoglobin A1c (NGSP)', 'HbA1c')).toBe(false);
    expect(isEchoRedundant('Sex Hormone-Binding Globulin', 'SHBG')).toBe(false);
  });

  it('respects word order in abbreviation matching', () => {
    expect(isEchoRedundant('D Vitamin', 'Vit D')).toBe(false);
  });
});

describe('marker catalog consistency', () => {
  it('every also-ref alias maps back to its primary', () => {
    for (const [primary, refs] of Object.entries(ALSO_REFS)) {
      for (const ref of refs) {
        expect(ALIAS_TO_PRIMARY[ref.loinc]).toBe(primary);
      }
    }
  });

  it('testLoincs returns the badge LOINC plus its also-refs', () => {
    expect(testLoincs({ short: 'T', full: '', longCommonName: '', loinc: '14913-8', also: ALSO_REFS['14913-8'] })).toEqual([
      '14913-8',
      '2986-8',
    ]);
  });

  it('every computed-index input LOINC candidate has a primary short label or alias', () => {
    for (const loincs of Object.values(MARKER_LOINC)) {
      const primary = loincs[0]!;
      expect(SHORT_LABELS[primary], `missing short label for ${primary}`).toBeDefined();
    }
  });

  it('short labels are unique per LOINC list intent (no accidental duplicates of a LOINC key)', () => {
    const keys = Object.keys(SHORT_LABELS);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// The molar twin of a marker the panels already carry must fold into that
// marker's row rather than surface as a separate analyte.
describe('mass/molar sibling aliases', () => {
  const ALIASED_PAIRS: [string, string][] = [
    ['2339-0', '15074-8'],
    ['2093-3', '14647-2'],
    ['2085-9', '14646-4'],
    ['13457-7', '22748-8'],
    ['13458-5', '25371-6'],
    ['2571-8', '14927-8'],
    ['1975-2', '14631-6'],
    ['1968-7', '14629-0'],
    ['1971-1', '14630-8'],
    ['3024-7', '14920-3'],
    ['17861-6', '2000-8'],
    ['3094-0', '14937-7'],
    ['2160-0', '14682-9'],
    ['3084-1', '14933-6'],
    ['19123-9', '2601-3'],
    ['2777-1', '14879-1'],
  ];

  it('maps each molar code back to its mass primary', () => {
    for (const [mass, molar] of ALIASED_PAIRS) {
      expect([molar, ALIAS_TO_PRIMARY[molar]]).toEqual([molar, mass]);
    }
  });

  it('testLoincs on the mass primary answers for the molar code too', () => {
    for (const [mass, molar] of ALIASED_PAIRS) {
      const loincs = testLoincs({
        short: SHORT_LABELS[mass]!.short,
        full: '',
        longCommonName: '',
        loinc: mass,
        also: ALSO_REFS[mass],
      });
      expect(loincs).toContain(molar);
    }
  });

  it('gives every aliased molar code the sibling table’s molar unit', () => {
    for (const [, molar] of ALIASED_PAIRS) {
      const pair = MASS_MOLAR_SIBLINGS.find((p) => p.molar.loinc === molar);
      expect(pair, `no sibling entry for ${molar}`).toBeDefined();
      expect([molar, DEFAULT_UNITS[molar]]).toEqual([molar, pair!.molar.unit]);
    }
  });
});

describe('panelRowLoincs (All Observations panel filter)', () => {
  // The view's buildRows key: every reading folds onto its primary LOINC.
  const rowKey = (rawLoinc: string) => primaryLoinc(rawLoinc);
  const test = (loinc: string): Observation => ({
    short: loinc,
    full: '',
    longCommonName: '',
    loinc,
    also: ALSO_REFS[loinc],
  });

  it('primaryLoinc folds an alias and passes an unaliased code through', () => {
    expect(primaryLoinc('59261-8')).toBe('4548-4');
    expect(primaryLoinc('4548-4')).toBe('4548-4');
    expect(primaryLoinc('not-a-code')).toBe('not-a-code');
  });

  it('matches a reading recorded under a molar alias of a panel’s mass code', () => {
    const covered = panelRowLoincs([test('2093-3')]);
    expect(covered.has(rowKey('14647-2'))).toBe(true);
    expect(covered.has(rowKey('2093-3'))).toBe(true);
  });

  it('matches when the panel names the alias and the reading uses the primary', () => {
    const covered = panelRowLoincs([test('14647-2')]);
    expect(covered.has(rowKey('2093-3'))).toBe(true);
  });

  it('omits rows the panel does not cover', () => {
    const covered = panelRowLoincs([test('2093-3')]);
    expect(covered.has(rowKey('14913-8'))).toBe(false);
  });

  it('still covers HbA1c under its IFCC code, which the panel itself excludes', () => {
    const ir = buildConditions(PANELS, {}, MONITORING_PANELS).find((c) => c.name === 'Insulin Resistance')!;
    expect(ir.tests.map((t) => t.loinc)).not.toContain('59261-8');
    const covered = panelRowLoincs(ir.tests);
    expect(covered.has(rowKey('59261-8'))).toBe(true);
    expect(covered.has(rowKey('4548-4'))).toBe(true);
  });

  it('every panel’s row keys are primaries, so no row key can miss a fold', () => {
    for (const c of buildConditions(PANELS, {}, MONITORING_PANELS)) {
      for (const key of panelRowLoincs(c.tests)) {
        expect([c.name, key, ALIAS_TO_PRIMARY[key]]).toEqual([c.name, key, undefined]);
      }
    }
  });
});

describe('observationMatchesQuery (All Observations text filter)', () => {
  const hgb: Observation = {
    short: 'HGB',
    full: 'Hemoglobin',
    longCommonName: 'Hemoglobin [Mass/volume] in Blood',
    loinc: '718-7',
    also: ALSO_REFS['718-7'],
  };

  it('matches an empty or whitespace-only query against every row', () => {
    expect(observationMatchesQuery(hgb, '')).toBe(true);
    expect(observationMatchesQuery(hgb, '   ')).toBe(true);
  });

  it('matches the badge label case-insensitively', () => {
    expect(observationMatchesQuery(hgb, 'hgb')).toBe(true);
    expect(observationMatchesQuery(hgb, 'HG')).toBe(true);
  });

  it('matches the displayed name and the official long name', () => {
    expect(observationMatchesQuery(hgb, 'hemoglob')).toBe(true);
    expect(observationMatchesQuery(hgb, 'mass/volume')).toBe(true);
  });

  it('matches the LOINC itself', () => {
    expect(observationMatchesQuery(hgb, '718-7')).toBe(true);
  });

  it('matches a Cyrillic name the lab actually printed', () => {
    expect(observationMatchesQuery(hgb, 'Гемоглобин')).toBe(false);
    expect(observationMatchesQuery(hgb, 'гемоглобин', ['Гемоглобин'])).toBe(true);
  });

  it('trims the query before matching', () => {
    expect(observationMatchesQuery(hgb, '  hgb  ')).toBe(true);
  });

  it('rejects a query that appears nowhere', () => {
    expect(observationMatchesQuery(hgb, 'ferritin', ['Гемоглобин'])).toBe(false);
  });

  it('matches an alias LOINC the row answers for', () => {
    const chol: Observation = {
      short: 'TC',
      full: 'Cholesterol',
      longCommonName: '',
      loinc: '2093-3',
      also: ALSO_REFS['2093-3'],
    };
    for (const ref of chol.also ?? []) {
      expect(observationMatchesQuery(chol, ref.loinc)).toBe(true);
    }
  });
});

describe('indexMatchesQuery (All Observations text filter, index rows)', () => {
  const def = INDEX_DEFS.find((d) => d.key === 'ka')!;

  it('matches every row on an empty query', () => {
    expect(indexMatchesQuery(def, ' ')).toBe(true);
  });

  it('matches the compact and the full index name, case-insensitively', () => {
    expect(indexMatchesQuery(def, 'ac')).toBe(true);
    expect(indexMatchesQuery(def, 'atherogenic')).toBe(true);
  });

  it('rejects a query that names another index', () => {
    expect(indexMatchesQuery(def, 'homa')).toBe(false);
  });
});
