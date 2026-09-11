import type { Analysis, Lang } from '../types';

export function getAnalysisName(loinc: string, catalog: Record<string, Analysis>, lang: Lang): string {
  const a = catalog[loinc];
  if (!a) return loinc;
  if (lang !== 'en' && a.lang[lang]) return a.lang[lang];
  return a.friendlyName;
}
