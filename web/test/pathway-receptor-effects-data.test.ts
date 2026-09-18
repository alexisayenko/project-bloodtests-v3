import { describe, it, expect } from 'vitest';
import { RECEPTOR_EFFECTS_FILE } from './dataFiles';
import {
  PATHWAY_RECEPTORS,
  RECEPTOR_EFFECT_SOURCES,
  RECEPTOR_EFFECT_SOURCE_BY_ID,
  numberedEffects,
  receptorById,
} from '../src/data/pathwayReceptorEffects';
import { compileSchema, schemaErrors } from './helpers/schema';

const { validate, subschema } = compileSchema('pathway-receptor-effects-1.schema.json');

describe('pathway receptor effects conform to pathway-receptor-effects-1.schema.json', () => {
  it('pathway-receptor-effects.json is a valid effects table', () => {
    expect(schemaErrors(validate, RECEPTOR_EFFECTS_FILE)).toEqual([]);
  });

  it('rejects an effect with an unknown key or no citation, and a citation with no quote', () => {
    const effect = subschema('#/$defs/effect');
    const base = { id: 'muscle', text: 'Muscle', citations: [{ source: 'a', quotes: ['q'] }] };
    expect(effect(base)).toBe(true);
    expect(effect({ ...base, txet: 'Muscle' })).toBe(false);
    expect(effect({ ...base, citations: [] })).toBe(false);
    expect(effect({ ...base, citations: [{ source: 'a', quotes: [] }] })).toBe(false);
  });
});

describe('pathway receptor effects are internally consistent', () => {
  it('covers both receptor nodes, with no receptor, effect or source id listed twice', () => {
    expect(receptorById('ar')).toBeDefined();
    expect(receptorById('er')).toBeDefined();
    const receptors = PATHWAY_RECEPTORS.map((r) => r.id);
    const sources = RECEPTOR_EFFECT_SOURCES.map((s) => s.id);
    expect(receptors).toHaveLength(new Set(receptors).size);
    expect(sources).toHaveLength(new Set(sources).size);
    for (const r of PATHWAY_RECEPTORS) {
      const effects = r.effects.map((e) => e.id);
      expect(effects, r.id).toHaveLength(new Set(effects).size);
    }
  });

  it('every effect cites at least one source, every citation resolves, and every source is cited', () => {
    const cited = new Set<string>();
    for (const r of PATHWAY_RECEPTORS) {
      for (const e of r.effects) {
        expect(e.citations.length, `${r.id}/${e.id}`).toBeGreaterThan(0);
        for (const c of e.citations) {
          expect(RECEPTOR_EFFECT_SOURCE_BY_ID[c.source], `${r.id}/${e.id}: ${c.source}`).toBeDefined();
          cited.add(c.source);
        }
      }
    }
    for (const s of RECEPTOR_EFFECT_SOURCES) expect(cited.has(s.id), `${s.id} is never cited`).toBe(true);
  });

  it('every quote is a short excerpt, under 25 words', () => {
    for (const r of PATHWAY_RECEPTORS) {
      for (const e of r.effects) {
        for (const q of e.citations.flatMap((c) => c.quotes)) {
          expect(q.split(/\s+/).filter(Boolean).length, `${r.id}/${e.id}: ${q}`).toBeLessThan(25);
        }
      }
    }
  });

  it('numbers a card’s sources by first citation, one number per source', () => {
    const ar = numberedEffects(receptorById('ar')!);
    expect(ar.sources.map((s) => s.id)).toEqual([...new Set(receptorById('ar')!.effects.flatMap((e) => e.citations.map((c) => c.source)))]);
    for (const e of ar.effects) for (const n of e.cites) expect(n).toBeGreaterThanOrEqual(1);
    expect(ar.effects[0].cites).toEqual([1, 2]);
  });
});
