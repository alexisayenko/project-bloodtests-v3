import { describe, it, expect } from 'vitest';
import { isEchoRedundant, testLoincs } from '../src/components/conditions/markers';
import { ALIAS_TO_PRIMARY, ALSO_REFS, DEFAULT_UNITS, SHORT_LABELS } from '../src/data/analyteCatalog';
import { MARKER_LOINC } from '../src/data/computedIndices';
import { MASS_MOLAR_SIBLINGS } from '../src/data/massMolarSiblings';

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
