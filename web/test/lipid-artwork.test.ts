import { describe, expect, it } from 'vitest';
import { artworkFor } from '../src/components/conditions/lipidArtwork';
import { GLYPH_SIZE } from '../src/components/conditions/lipidParticleGeometry';
import { LIPOPROTEIN_PARTICLES } from '../src/data/lipoproteinParticles';

const nodesIn = (svg: string) => [...svg.matchAll(/data-node="([^"]+)"/g)].map((m) => m[1]);

describe('lipid particle artwork', () => {
  it('carries no text and tags each particle, its TRIG and Chol areas and its apoprotein pill', () => {
    for (const { id, name } of LIPOPROTEIN_PARTICLES) {
      const svg = artworkFor(id, name);
      expect(svg, id).not.toMatch(/<text|<script|href=/);
      const pills = id === 'lpa' ? [`${id}-apo`, `${id}-apoa`] : [`${id}-apo`];
      expect(nodesIn(svg).sort(), id).toEqual([id, `${id}-chol`, `${id}-trig`, ...pills].sort());
    }
  });

  it('sizes each artwork to its step in the diameter order', () => {
    for (const { id, name } of LIPOPROTEIN_PARTICLES) {
      expect(artworkFor(id, name), id).toMatch(new RegExp(`<svg[^>]* width="${GLYPH_SIZE[id]}"`));
    }
    const widths = LIPOPROTEIN_PARTICLES.map((p) => GLYPH_SIZE[p.id]);
    expect(widths).toEqual([...widths].sort((a, b) => b - a));
  });
});
