import { readFileSync } from 'node:fs';
import type { Analysis, MonitoringPanelDef, Panel } from '../src/types';

function load<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`../public/data/${name}`, import.meta.url), 'utf8')) as T;
}

export const ANALYSES = load<Analysis[]>('analyses.json');
export const PANELS = load<Panel[]>('panels.json');
export const MONITORING_PANELS = load<MonitoringPanelDef[]>('monitoring-panels.json');
/** Read from disk, not imported, so the conformance suite validates the file itself. */
export const MOLAR_MASS_FILE = load<unknown>('molar-masses.json');
export const LABORATORY_FILE = load<unknown>('laboratories.json');
export const PATHWAY_RANGE_FILE = load<unknown>('pathway-reference-ranges.json');
export const MARTIN_HOPKINS_FILE = load<unknown>('martin-hopkins-ldl-table.json');
export const RECEPTOR_EFFECTS_FILE = load<unknown>('pathway-receptor-effects.json');
export const LIPOPROTEIN_PARTICLE_FILE = load<unknown>('lipoprotein-particles.json');
