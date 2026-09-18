import file from '../../public/data/lipoprotein-particles.json';

// Every figure stays as its source printed it; ranges and midpoints are derived, never stored.

export interface Interval {
  min?: number;
  max?: number;
  exclusiveMax?: boolean;
  approximate?: boolean;
  source: string;
}

export interface Figure {
  value: number;
  approximate?: boolean;
  source: string;
}

export const COMPONENTS = ['triglyceride', 'cholesterol', 'phospholipid', 'protein'] as const;
export type Component = (typeof COMPONENTS)[number];

export interface LipoproteinParticle {
  id: string;
  name: string;
  structuralApolipoproteins: string[];
  majorApoproteins: { printed: string[]; source: string };
  diameterNm: Interval;
  densityGPerMl: Interval;
  composition: Partial<Record<Component, Figure[]>>;
  note?: string;
}

export interface LipoproteinSource {
  id: string;
  authors: string;
  title: string;
  publication: string;
  year?: number;
  url: string;
  retrieved: string;
  quote?: string;
  table?: string;
}

const data = file as { particles: LipoproteinParticle[]; sources: LipoproteinSource[] };

export const LIPOPROTEIN_PARTICLES: readonly LipoproteinParticle[] = data.particles;
export const LIPOPROTEIN_SOURCES: readonly LipoproteinSource[] = data.sources;

export interface ShareRange {
  min: number;
  max: number;
  midpoint: number;
  approximate: boolean;
  sources: string[];
}

/** Undefined when no figure is sourced. */
export function shareRange(particle: LipoproteinParticle, component: Component): ShareRange | undefined {
  const figures = particle.composition[component];
  if (!figures?.length) return undefined;
  const values = figures.map((f) => f.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {
    min,
    max,
    midpoint: (min + max) / 2,
    approximate: figures.some((f) => f.approximate),
    sources: [...new Set(figures.map((f) => f.source))],
  };
}

/** Citation order: first appearance across particles in drawing order. */
export function citedSourceIds(particles: readonly LipoproteinParticle[] = LIPOPROTEIN_PARTICLES): string[] {
  const ids: string[] = [];
  const add = (id: string) => {
    if (!ids.includes(id)) ids.push(id);
  };
  for (const p of particles) {
    add(p.majorApoproteins.source);
    add(p.diameterNm.source);
    add(p.densityGPerMl.source);
    for (const component of COMPONENTS) for (const f of p.composition[component] ?? []) add(f.source);
  }
  return ids;
}

/** "Apo A-I" and "ApoA-I" name one apoprotein. */
export const apoKey = (name: string) => name.toLowerCase().replace(/[\s-]/g, '');
