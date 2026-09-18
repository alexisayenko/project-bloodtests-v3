import { describe, it, expect } from 'vitest';
import { tokensFuzzyEqual, groupVocabByLength, fuzzyVocabHits } from '../src/data/fuzzyMatch';

describe('tokensFuzzyEqual', () => {
  it('treats identical tokens as equal whatever their length', () => {
    expect(tokensFuzzyEqual('hb', 'hb')).toBe(true);
    expect(tokensFuzzyEqual('cholesterol', 'cholesterol')).toBe(true);
  });

  it('gives short tokens no slack at all', () => {
    expect(tokensFuzzyEqual('hb', 'hgb')).toBe(false);
    expect(tokensFuzzyEqual('tsh', 'tsg')).toBe(false);
    expect(tokensFuzzyEqual('iron', 'irom')).toBe(false);
  });

  it('allows one edit once both tokens are five characters or longer', () => {
    expect(tokensFuzzyEqual('glucose', 'glucoze')).toBe(true);
    expect(tokensFuzzyEqual('glucose', 'glucse')).toBe(true);
    expect(tokensFuzzyEqual('glucose', 'glucosee')).toBe(true);
    expect(tokensFuzzyEqual('glucose', 'glacoze')).toBe(false);
  });

  it('counts an adjacent transposition as a single edit', () => {
    expect(tokensFuzzyEqual('glucose', 'glucsoe')).toBe(true);
    expect(tokensFuzzyEqual('insulin', 'insuiln')).toBe(true);
  });

  it('allows two edits only when both tokens are nine characters or longer', () => {
    expect(tokensFuzzyEqual('cholesterol', 'cholesteral')).toBe(true);
    expect(tokensFuzzyEqual('cholesterol', 'colesteral')).toBe(true);
    expect(tokensFuzzyEqual('cholesterol', 'kolesteral')).toBe(false);
    expect(tokensFuzzyEqual('creatinin', 'kreatinim')).toBe(true);
    expect(tokensFuzzyEqual('ferritin', 'feritim')).toBe(false);
  });

  it('refuses when the lengths alone differ by more than the cap', () => {
    expect(tokensFuzzyEqual('glucose', 'glucoseeee')).toBe(false);
    expect(tokensFuzzyEqual('hemoglobin', 'hemoglobinaaa')).toBe(false);
  });
});

describe('groupVocabByLength', () => {
  it('buckets tokens by their length, keeping insertion order inside a bucket', () => {
    const byLen = groupVocabByLength(['tsh', 'glucose', 'lipase', 'insulin', 'hb']);
    expect([...byLen.keys()].sort((a, b) => a - b)).toEqual([2, 3, 6, 7]);
    expect(byLen.get(7)).toEqual(['glucose', 'insulin']);
    expect(byLen.get(2)).toEqual(['hb']);
  });
});

describe('fuzzyVocabHits', () => {
  const vocab = groupVocabByLength(['glucose', 'glucoze', 'glucosee', 'glucos', 'gluc', 'lipase', 'cholesterol', 'cholesteral', 'hb', 'hgb']);

  it('returns the near tokens without the exact token itself', () => {
    expect(fuzzyVocabHits('glucose', vocab).sort()).toEqual(['glucos', 'glucosee', 'glucoze']);
  });

  it('skips a bucket whose length difference already exceeds the cap', () => {
    expect(fuzzyVocabHits('gluc', vocab)).toEqual([]);
    expect(fuzzyVocabHits('glucose', vocab)).not.toContain('gluc');
  });

  it('finds nothing for a short token, since short tokens get no slack', () => {
    expect(fuzzyVocabHits('hb', vocab)).toEqual([]);
    expect(fuzzyVocabHits('hgb', vocab)).toEqual([]);
  });

  it('lets a long token reach a two-edit neighbour', () => {
    expect(fuzzyVocabHits('cholesterol', vocab)).toEqual(['cholesteral']);
    expect(fuzzyVocabHits('colesteral', vocab).sort()).toEqual(['cholesteral', 'cholesterol']);
  });
});
