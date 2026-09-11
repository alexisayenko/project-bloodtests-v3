import { describe, it, expect } from 'vitest';
import {
  buildConditions,
  buildPanelsByLoinc,
  indexMatchesQuery,
  isEchoRedundant,
  observationMatchesQuery,
  panelMembershipOf,
  panelRowLoincs,
  primaryLoinc,
  testLoincs,
  type Observation,
} from '../src/components/conditions/markers';
import { ALIAS_TO_PRIMARY, ALSO_REFS, ANALYTE_BY_LOINC, SHORT_NAMES } from '../src/data/analyteCatalog';
import { MARKER_LOINC } from '../src/data/computedIndices';
import { INDEX_DEFS } from '../src/data/indexDefs';
import { MASS_MOLAR_SIBLINGS } from '../src/data/massMolarSiblings';
import { MONITORING_PANELS, PANELS } from './dataFiles';

describe('isEchoRedundant (short-name echo suppression)', () => {
  it('suppresses when the friendly name contains the short name', () => {
    expect(isEchoRedundant('Testosterone, Free (FT)', 'FT')).toBe(true);
  });

  it('ignores case and punctuation ("25OH" vs "(25-OH)")', () => {
    expect(isEchoRedundant('Vitamin D (25-OH)', '25OH')).toBe(true);
  });

  it('recognizes word-by-word abbreviations ("Vit D" ⊂ "Vitamin D (25-OH)")', () => {
    expect(isEchoRedundant('Vitamin D (25-OH)', 'Vit D')).toBe(true);
  });

  it('keeps the echo when the short name genuinely adds information', () => {
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
    expect(testLoincs({ shortName: 'T', friendlyName: '', longCommonName: '', loinc: '14913-8', also: ALSO_REFS['14913-8'] })).toEqual([
      '14913-8',
      '2986-8',
    ]);
  });

  it('every computed-index input LOINC candidate has a primary short name or alias', () => {
    for (const loincs of Object.values(MARKER_LOINC)) {
      const primary = loincs[0]!;
      expect(SHORT_NAMES[primary], `missing short name for ${primary}`).toBeDefined();
    }
  });

});

// The molar twin of a marker the panels already carry must fold into that
// marker's row rather than surface as a separate analyte.
describe('mass/molar sibling aliases', () => {
  const ALIASED_PAIRS: [string, string][] = [
    ['2345-7', '14749-6'],
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
    ['3091-6', '22664-7'],
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
        shortName: SHORT_NAMES[mass]!.shortName,
        friendlyName: '',
        longCommonName: '',
        loinc: mass,
        also: ALSO_REFS[mass],
      });
      expect(loincs).toContain(molar);
    }
  });

  it('has a sibling-table entry for every aliased molar code', () => {
    for (const [, molar] of ALIASED_PAIRS) {
      expect(MASS_MOLAR_SIBLINGS.find((p) => p.molar.loinc === molar), `no sibling entry for ${molar}`).toBeDefined();
    }
  });
});

describe('panelRowLoincs (All Observations panel filter)', () => {
  // The view's buildRows key: every reading folds onto its primary LOINC.
  const rowKey = (rawLoinc: string) => primaryLoinc(rawLoinc);
  const test = (loinc: string): Observation => ({
    shortName: loinc,
    friendlyName: '',
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
    shortName: 'HGB',
    friendlyName: 'Hemoglobin',
    longCommonName: 'Hemoglobin [Mass/volume] in Blood',
    loinc: '718-7',
    also: ALSO_REFS['718-7'],
  };

  it('matches an empty or whitespace-only query against every row, and trims before matching', () => {
    expect(observationMatchesQuery(hgb, '')).toBe(true);
    expect(observationMatchesQuery(hgb, '   ')).toBe(true);
    expect(observationMatchesQuery(hgb, '  hgb  ')).toBe(true);
  });

  it('matches the short name, the friendly name, the LOINC name and the LOINC code', () => {
    expect(observationMatchesQuery(hgb, 'hgb')).toBe(true);
    expect(observationMatchesQuery(hgb, 'HG')).toBe(true); // case-insensitive
    expect(observationMatchesQuery(hgb, 'hemoglob')).toBe(true);
    expect(observationMatchesQuery(hgb, 'mass/volume')).toBe(true);
    expect(observationMatchesQuery(hgb, '718-7')).toBe(true);
  });

  it('matches a Cyrillic name only once a lab has actually printed it, and nothing else', () => {
    expect(observationMatchesQuery(hgb, 'Гемоглобин')).toBe(false);
    expect(observationMatchesQuery(hgb, 'гемоглобин', ['Гемоглобин'])).toBe(true);
    expect(observationMatchesQuery(hgb, 'ferritin', ['Гемоглобин'])).toBe(false);
  });

  it('matches an alias LOINC the row answers for', () => {
    const chol: Observation = {
      shortName: 'TC',
      friendlyName: 'Cholesterol',
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

  it('matches the short name and the friendly name of an index, case-insensitively', () => {
    expect(indexMatchesQuery(def, 'ac')).toBe(true);
    expect(indexMatchesQuery(def, 'atherogenic')).toBe(true);
  });

  it('rejects a query that names another index', () => {
    expect(indexMatchesQuery(def, 'homa')).toBe(false);
  });
});

describe('panel membership of a LOINC (Reference Book, LOINC database)', () => {
  const panelsByLoinc = buildPanelsByLoinc(buildConditions(PANELS, ANALYTE_BY_LOINC, MONITORING_PANELS));

  it('lists every panel that names a code, without repeats', () => {
    const glucose = panelMembershipOf(panelsByLoinc, '2345-7');
    expect(glucose.via).toBeUndefined();
    expect(glucose.panels).toContain('Insulin Resistance');
    expect(glucose.panels).toContain('Kidney Function');
    expect(new Set(glucose.panels).size).toBe(glucose.panels.length);
  });

  it('reports nothing for a primary code no panel names', () => {
    expect(panelMembershipOf(panelsByLoinc, '13458-5')).toEqual({ panels: [] });
  });

  it('falls back to the primary for a variant code the resolver never lists', () => {
    // HbA1c IFCC: Insulin Resistance excludes it by name, yet a reading recorded
    // under it folds into the NGSP row, which that panel does carry.
    const ifcc = panelMembershipOf(panelsByLoinc, '59261-8');
    expect(panelsByLoinc['59261-8']).toBeUndefined();
    expect(ifcc.via).toBe('4548-4');
    expect(ifcc.panels).toEqual(panelMembershipOf(panelsByLoinc, '4548-4').panels);
  });

  it('leaves a variant whose primary is itself unlisted with no panels', () => {
    expect(panelMembershipOf(panelsByLoinc, '25371-6')).toEqual({ panels: [], via: '13458-5' });
  });
});
