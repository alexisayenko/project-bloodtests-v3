import { describe, it, expect } from 'vitest';
import { LIPOPROTEIN_PARTICLE_FILE } from './dataFiles';
import { COMPONENTS, LIPOPROTEIN_PARTICLES, LIPOPROTEIN_SOURCES, apoKey, citedSourceIds, shareRange } from '../src/data/lipoproteinParticles';
import { compileSchema, schemaErrors } from './helpers/schema';

const { validate, subschema } = compileSchema('lipoprotein-particles-1.schema.json');

describe('lipoprotein particles conform to lipoprotein-particles-1.schema.json', () => {
  it('lipoprotein-particles.json is a valid particle table', () => {
    expect(schemaErrors(validate, LIPOPROTEIN_PARTICLE_FILE)).toEqual([]);
  });

  it('rejects an unknown key, a figure over 100%, and a source with neither quote nor table', () => {
    const particle = subschema('#/$defs/particle');
    const source = subschema('#/$defs/source');
    const figure = subschema('#/$defs/figure');
    expect(particle({ ...LIPOPROTEIN_PARTICLES[0], size: 1 })).toBe(false);
    expect(figure({ value: 101, source: 'cox-1990' })).toBe(false);
    const tabled = LIPOPROTEIN_SOURCES.find((s) => s.table)!;
    expect(source(Object.fromEntries(Object.entries(tabled).filter(([key]) => key !== 'table')))).toBe(false);
  });
});

describe('lipoprotein particles are internally consistent', () => {
  const sourceIds = new Set(LIPOPROTEIN_SOURCES.map((s) => s.id));

  it('lists the particles in transport order', () => {
    expect(LIPOPROTEIN_PARTICLES.map((p) => p.id)).toEqual(['chylomicron', 'vldl', 'idl', 'ldl', 'lpa', 'hdl']);
  });

  it('every figure cites a known source, and every source is cited', () => {
    for (const p of LIPOPROTEIN_PARTICLES) {
      const cited = [
        p.majorApoproteins.source,
        p.diameterNm.source,
        p.densityGPerMl.source,
        ...COMPONENTS.flatMap((c) => (p.composition[c] ?? []).map((f) => f.source)),
      ];
      for (const id of cited) expect(sourceIds.has(id), `${p.id}: ${id}`).toBe(true);
    }
    expect(new Set(citedSourceIds())).toEqual(sourceIds);
    expect(sourceIds.size).toBe(LIPOPROTEIN_SOURCES.length);
  });

  it('every quote stays under 25 words', () => {
    for (const s of LIPOPROTEIN_SOURCES) {
      if (s.quote) expect(s.quote.trim().split(/\s+/).length, s.id).toBeLessThan(25);
    }
  });

  it('every interval is ordered', () => {
    for (const p of LIPOPROTEIN_PARTICLES) {
      for (const interval of [p.diameterNm, p.densityGPerMl]) {
        if (interval.min !== undefined && interval.max !== undefined) expect(interval.min, p.id).toBeLessThanOrEqual(interval.max);
      }
    }
  });

  it('no particle’s smallest printed shares add up to more than its whole mass, nor its drawn areas', () => {
    for (const p of LIPOPROTEIN_PARTICLES) {
      const ranges = COMPONENTS.map((c) => shareRange(p, c));
      for (const r of ranges) if (r) expect(r.min, p.id).toBeLessThanOrEqual(r.max);
      expect(ranges.reduce((sum, r) => sum + (r?.min ?? 0), 0), p.id).toBeLessThanOrEqual(100);
      const drawn = (shareRange(p, 'triglyceride')?.midpoint ?? 0) + (shareRange(p, 'cholesterol')?.midpoint ?? 0);
      expect(drawn, p.id).toBeLessThanOrEqual(100);
    }
  });

  it('every structural apolipoprotein is one the source lists for that particle', () => {
    for (const p of LIPOPROTEIN_PARTICLES) {
      const listed = new Set(p.majorApoproteins.printed.map(apoKey));
      for (const apo of p.structuralApolipoproteins) expect(listed.has(apoKey(apo)), `${p.id}: ${apo}`).toBe(true);
    }
  });

  it('derives a share range from the printed figures without storing it', () => {
    const ldl = LIPOPROTEIN_PARTICLES.find((p) => p.id === 'ldl')!;
    expect(shareRange(ldl, 'cholesterol')).toEqual({ min: 26, max: 50, midpoint: 38, approximate: false, sources: ['cox-1990', 'statpearls-ldl'] });
    expect(shareRange(LIPOPROTEIN_PARTICLES.find((p) => p.id === 'lpa')!, 'triglyceride')).toBeUndefined();
  });
});
