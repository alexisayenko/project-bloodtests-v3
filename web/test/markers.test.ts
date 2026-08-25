import { describe, it, expect } from 'vitest';
import { ALIAS_TO_PRIMARY, ALSO_REFS, SHORT_LABELS, isEchoRedundant, testLoincs } from '../src/components/conditions/markers';
import { MARKER_LOINC } from '../src/data/computedIndices';

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
