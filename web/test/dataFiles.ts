import { readFileSync } from 'node:fs';
import type { Analysis, MonitoringPanelDef, Panel } from '../src/types';

function load<T>(name: string): T {
  return JSON.parse(readFileSync(new URL(`../public/data/${name}`, import.meta.url), 'utf8')) as T;
}

export const ANALYSES = load<Analysis[]>('analyses.json');
export const PANELS = load<Panel[]>('panels.json');
export const MONITORING_PANELS = load<MonitoringPanelDef[]>('monitoring-panels.json');
