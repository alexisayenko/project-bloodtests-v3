import file from '../../public/data/pathway-receptor-effects.json';

/**
 * What activating each Hormonal Pathways receptor node does in adult men, read
 * from `pathway-receptor-effects.json` (ADR-0010). Every effect carries at
 * least one cited source with the source's own words.
 */

export interface EffectCitation {
  source: string;
  quotes: string[];
}

export interface ReceptorEffect {
  id: string;
  text: string;
  citations: EffectCitation[];
}

export interface PathwayReceptor {
  id: string;
  name: string;
  ligands: string[];
  effects: ReceptorEffect[];
}

export interface ReceptorEffectSource {
  id: string;
  organization: string;
  title: string;
  year?: number;
  url: string;
  doi?: string;
  pmid?: string;
  retrieved: string;
}

const data = file as { receptors: PathwayReceptor[]; sources: ReceptorEffectSource[] };

export const PATHWAY_RECEPTORS: readonly PathwayReceptor[] = data.receptors;
export const RECEPTOR_EFFECT_SOURCES: readonly ReceptorEffectSource[] = data.sources;
export const RECEPTOR_EFFECT_SOURCE_BY_ID: Readonly<Record<string, ReceptorEffectSource>> = Object.fromEntries(
  data.sources.map((s) => [s.id, s])
);

export function receptorById(id: string): PathwayReceptor | undefined {
  return PATHWAY_RECEPTORS.find((r) => r.id === id);
}

export interface NumberedEffects {
  effects: { id: string; text: string; cites: number[] }[];
  sources: ReceptorEffectSource[];
}

/** The receptor's effects with [n] numbers local to its card, sources numbered by first citation. */
export function numberedEffects(receptor: PathwayReceptor): NumberedEffects {
  const sources: ReceptorEffectSource[] = [];
  const cite = (id: string) => {
    const source = RECEPTOR_EFFECT_SOURCE_BY_ID[id];
    if (!sources.includes(source)) sources.push(source);
    return sources.indexOf(source) + 1;
  };
  const effects = receptor.effects.map((e) => ({ id: e.id, text: e.text, cites: e.citations.map((c) => cite(c.source)) }));
  return { effects, sources };
}
