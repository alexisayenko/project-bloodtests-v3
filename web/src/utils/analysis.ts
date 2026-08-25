import type { Analysis, Panel, Lang } from '../types';

export function getAnalysisName(loinc: string, catalog: Record<string, Analysis>, lang: Lang): string {
  const a = catalog[loinc];
  if (!a) return loinc;
  if (lang !== 'en' && a.lang[lang]) return a.lang[lang];
  return a.displayName;
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

export function getOtherLangNames(a: Analysis, lang: Lang): string[] {
  const names: string[] = [];
  if (lang !== 'ru-RU' && a.lang['ru-RU']) names.push(a.lang['ru-RU']);
  if (lang !== 'uk-UA' && a.lang['uk-UA']) names.push(a.lang['uk-UA']);
  if (lang !== 'en') names.unshift(a.displayName);
  return names;
}

export function getResultDisplayName(result: { analysis: string; loinc: string }, catalog: Record<string, Analysis>, lang: Lang): string {
  if (result.analysis) return result.analysis;
  if (result.loinc) return getAnalysisName(result.loinc, catalog, lang);
  return 'Unknown Analysis';
}
