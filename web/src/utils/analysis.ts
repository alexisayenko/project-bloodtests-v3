import type { Analysis, Panel, Lang } from '../types';

export function getAnalysisName(loinc: string, catalog: Record<string, Analysis>, lang: Lang): string {
  const a = catalog[loinc];
  if (!a) return loinc;
  if (lang !== 'en' && a.lang[lang]) return a.lang[lang];
  return a.friendlyName;
}

export function getPanelName(p: Panel, lang: Lang): string {
  if (lang !== 'en' && p.lang[lang]) return p.lang[lang];
  return p.name;
}

export function getPanelAnalyses(p: Panel): string[] {
  if (p.sections) {
    return p.sections.flatMap(s => s.loincs);
  }
  return p.loincs || [];
}
